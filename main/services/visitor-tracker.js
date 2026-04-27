'use strict'

/**
 * Visitor tracker — отслеживает анонимных пользователей (без входа в аккаунт).
 * Отправляет пинг на сервер с анонимным UUID при каждом запуске.
 */

const { app }  = require('electron')
const store    = require('./store')
const https    = require('https')
const http     = require('http')

const API_URL       = 'https://api.centrio.me'
const PING_INTERVAL = 5 * 60 * 1000  // 5 минут

let _interval = null

// ── Получить или создать анонимный ID ─────────────────────────────
function getVisitorId () {
    let id = store.get('visitorId')
    if (!id) {
        id = generateUUID()
        store.set('visitorId', id)
    }
    return id
}

function generateUUID () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

// ── Проверить: пользователь вошёл? ────────────────────────────────
function isLoggedIn () {
    const token = store.get('cloud.accessToken')
    return !!token
}

// ── Получить кол-во мессенджеров из store ─────────────────────────
function getMessengersCount () {
    try {
        const messengers = store.get('messengers', [])
        return Array.isArray(messengers) ? messengers.length : 0
    } catch { return 0 }
}

// ── Отправить запрос ──────────────────────────────────────────────
function post (endpoint, body) {
    return new Promise((resolve) => {
        try {
            const data   = JSON.stringify(body)
            const urlStr = API_URL + endpoint
            const mod    = urlStr.startsWith('https') ? https : http
            const urlObj = new URL(urlStr)

            const req = mod.request({
                hostname: urlObj.hostname,
                port:     urlObj.port || (urlStr.startsWith('https') ? 443 : 80),
                path:     urlObj.pathname,
                method:   'POST',
                headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            }, (res) => {
                res.resume()  // drain response
                resolve(res.statusCode)
            })

            req.on('error', () => resolve(null))
            req.setTimeout(8000, () => { req.destroy(); resolve(null) })
            req.write(data)
            req.end()
        } catch { resolve(null) }
    })
}

// ── Пинг ──────────────────────────────────────────────────────────
async function ping () {
    if (isLoggedIn()) return   // авторизованные пользователи не нужны здесь
    try {
        await post('/api/visitors/ping', {
            visitorId:       getVisitorId(),
            platform:        process.platform,
            appVersion:      app.getVersion(),
            messengersCount: getMessengersCount()
        })
    } catch {}
}

// ── Регистрация новой сессии ──────────────────────────────────────
async function registerSession () {
    if (isLoggedIn()) return
    try {
        await post('/api/visitors/session', {
            visitorId:  getVisitorId(),
            platform:   process.platform,
            appVersion: app.getVersion()
        })
    } catch {}
}

// ── Start / stop ──────────────────────────────────────────────────
function start () {
    if (_interval) return
    // Регистрируем сессию при запуске
    registerSession().catch(() => {})
    // Периодический пинг
    _interval = setInterval(() => {
        ping().catch(() => {})
    }, PING_INTERVAL)
}

function stop () {
    if (_interval) {
        clearInterval(_interval)
        _interval = null
    }
}

// Пересмотреть при авторизации/деавторизации: остановить пинги когда юзер вошёл
function onAuthStateChange () {
    if (isLoggedIn()) {
        stop()
    } else {
        start()
    }
}

module.exports = { start, stop, onAuthStateChange, getVisitorId }
