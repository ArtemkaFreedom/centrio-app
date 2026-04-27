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
function verifyTotp(token) {
    const secret = process.env.TOTP_SECRET
    if (!secret) return { ok: false, error: 'TOTP_SECRET не настроен на сервере' }
    try {
        const valid = otplib.verify({ type: 'totp', secret, token: String(token).trim() })
        if (!valid) return { ok: false, error: 'Неверный код' }
        const sessionToken = generateToken()
        sessionStore.set(sessionToken, Date.now() + 8 * 60 * 60 * 1000)  // 8 часов
        return { ok: true, token: sessionToken }
    } catch (e) {
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
