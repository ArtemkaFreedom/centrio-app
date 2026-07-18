const crypto  = require('crypto')
const otplib  = require('otplib')
const QRCode  = require('qrcode')

// ── Сессионные токены: token -> expiresAt ────────────────────────────────────
const sessionStore = new Map()

function generateToken() { return crypto.randomBytes(32).toString('hex') }

// Периодическая очистка просроченных сессий
setInterval(() => {
    const now = Date.now()
    for (const [k, v] of sessionStore) { if (v < now) sessionStore.delete(k) }
}, 60_000)

// ── Rate limiting / lockout для /verify-totp ──────────────────────────────────
// Защита от брутфорса 6-значного TOTP-кода: без этого злоумышленник может
// перебирать коды без ограничений на эндпоинте, охраняющем весь /api/admin/*.
// В памяти (без внешних зависимостей) — по ключу клиента (IP).
const MAX_ATTEMPTS       = 5
const ATTEMPT_WINDOW_MS  = 5 * 60 * 1000   // считаем попытки в окне 5 минут
const LOCKOUT_MS         = 15 * 60 * 1000  // блокировка на 15 минут после превышения

const attemptStore = new Map()  // key -> { count, windowStart, lockedUntil }

setInterval(() => {
    const now = Date.now()
    for (const [k, v] of attemptStore) {
        if ((!v.lockedUntil || v.lockedUntil < now) && (now - v.windowStart) > ATTEMPT_WINDOW_MS) {
            attemptStore.delete(k)
        }
    }
}, 60_000)

function getLockoutStatus(key) {
    const entry = attemptStore.get(key)
    if (!entry) return { locked: false }
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
        return { locked: true, retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000) }
    }
    return { locked: false }
}

function registerFailedAttempt(key) {
    const now = Date.now()
    let entry = attemptStore.get(key)
    if (!entry || (now - entry.windowStart) > ATTEMPT_WINDOW_MS) {
        entry = { count: 0, windowStart: now, lockedUntil: 0 }
    }
    entry.count += 1
    if (entry.count >= MAX_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_MS
    }
    attemptStore.set(key, entry)
}

function clearAttempts(key) {
    attemptStore.delete(key)
}

// ── Получить QR-код (data URL) для первичной настройки ───────────────────────
async function getQrDataUrl() {
    const secret = process.env.TOTP_SECRET
    const uri = otplib.generateURI({
        type:   'totp',
        label:  'Centrio Admin',
        issuer: 'Centrio',
        secret
    })
    return QRCode.toDataURL(uri, { width: 240, margin: 2, color: { dark: '#000', light: '#fff' } })
}

// ── Проверить TOTP-код ────────────────────────────────────────────────────────
// clientKey — идентификатор клиента (обычно IP), для rate limiting/lockout
function verifyTotp(token, clientKey) {
    const key = clientKey || 'unknown'

    const lockStatus = getLockoutStatus(key)
    if (lockStatus.locked) {
        return {
            ok: false,
            error: `Слишком много неверных попыток. Повторите через ${lockStatus.retryAfterSec} сек.`,
            locked: true,
            retryAfterSec: lockStatus.retryAfterSec
        }
    }

    const secret = process.env.TOTP_SECRET
    if (!secret) return { ok: false, error: 'TOTP_SECRET не настроен на сервере' }
    try {
        const valid = otplib.verify({ type: 'totp', secret, token: String(token).trim() })
        if (!valid) {
            registerFailedAttempt(key)
            return { ok: false, error: 'Неверный код' }
        }
        clearAttempts(key)
        const sessionToken = generateToken()
        sessionStore.set(sessionToken, Date.now() + 8 * 60 * 60 * 1000)  // 8 часов
        return { ok: true, token: sessionToken }
    } catch (e) {
        registerFailedAttempt(key)
        return { ok: false, error: 'Ошибка проверки кода' }
    }
}

// ── Проверить валидность сессионного токена ──────────────────────────────────
function checkSession(token) {
    if (!token) return false
    const exp = sessionStore.get(token)
    if (!exp) return false
    if (Date.now() > exp) { sessionStore.delete(token); return false }
    return true
}

module.exports = { getQrDataUrl, verifyTotp, checkSession }

