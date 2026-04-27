'use strict'

/**
 * Usage tracker — collects app/service time, notifications, messages
 * and flushes them to the API every 5 minutes and on quit.
 */

const store  = require('./store')
const api    = require('./api')

// ── State ─────────────────────────────────────────────────────────
let _focusStart  = Date.now()  // when window was last focused
let _focusAccum  = 0           // ms accumulated while focused
let _isFocused   = true        // assume focused at start

let _notifCount  = 0
let _msgSent     = 0
let _msgReceived = 0

const _serviceAccum = {}       // { 'Telegram': seconds, ... }
let _interval = null

// ── Focus tracking ────────────────────────────────────────────────
function onFocus() {
    if (!_isFocused) {
        _focusStart = Date.now()
        _isFocused  = true
    }
}

function onBlur() {
    if (_isFocused) {
        _focusAccum += Date.now() - _focusStart
        _isFocused   = false
    }
}

function _getFocusedSecs() {
    let ms = _focusAccum
    if (_isFocused) ms += Date.now() - _focusStart
    return Math.floor(ms / 1000)
}

// ── Per-service time (called from IPC handler) ────────────────────
function addServiceTime(serviceName, seconds) {
    if (!serviceName || seconds <= 0) return
    _serviceAccum[serviceName] = (_serviceAccum[serviceName] || 0) + seconds
}

// ── Notification / message counters ──────────────────────────────
function addNotif(count = 1)       { _notifCount    += count }
function addMsgSent(count = 1)     { _msgSent       += count }
function addMsgReceived(count = 1) { _msgReceived   += count }

// ── Flush to API ─────────────────────────────────────────────────
async function flush() {
    try {
        const token = store.get('cloud.accessToken')
        if (!token) return

        const appTime = _getFocusedSecs()

        // Send overall session stats
        if (appTime > 0 || _notifCount > 0 || _msgSent > 0 || _msgReceived > 0) {
            await api.trackStats(token, {
                appTime,
                notifCount:  _notifCount,
                msgSent:     _msgSent,
                msgReceived: _msgReceived,
            })
        }

        // Send per-service time
        for (const [service, secs] of Object.entries(_serviceAccum)) {
            if (secs > 0) {
                await api.trackStats(token, {
                    service,
                    serviceTime: secs,
                    appTime: 0,  // avoid double-counting
                    notifCount: 0,
                })
            }
        }

        // Reset all counters
        _focusAccum  = 0
        _focusStart  = Date.now()
        _notifCount  = 0
        _msgSent     = 0
        _msgReceived = 0
        Object.keys(_serviceAccum).forEach(k => delete _serviceAccum[k])

        console.log('[tracker] flushed stats')
    } catch (err) {
        // Don't crash — tracking is optional
        console.warn('[tracker] flush error:', err.message || err)
    }
}

// ── Start / stop ──────────────────────────────────────────────────
function start() {
    if (_interval) return
    // Flush every minute so data is saved frequently and not lost on crash
    _interval = setInterval(() => {
        flush().catch(() => {})
    }, 60 * 1000)
    console.log('[tracker] started')
}

function stop() {
    if (_interval) {
        clearInterval(_interval)
        _interval = null
    }
}

module.exports = {
    onFocus,
    onBlur,
    addServiceTime,
    addNotif,
    addMsgSent,
    addMsgReceived,
    flush,
    start,
    stop,
}
