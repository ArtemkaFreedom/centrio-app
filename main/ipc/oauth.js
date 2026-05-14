const { ipcMain, shell } = require('electron')
const store = require('../services/store')
const { OAUTH } = require('../config/constants')
const { createModalWindow } = require('../factory/modalWindow')
const { t } = require('../services/i18n')
const { wrapIpc } = require('../utils/ipc')

// ── Shared pending-auth registry ──────────────────────────────────
// When we open the system browser for OAuth, we store a resolve/reject
// pair here. handleProtocolUrl (protocol.js) calls resolveOAuth() when
// it receives centrio://auth?accessToken=...
let _pending = null

function resolveOAuth(accessToken, refreshToken) {
    if (!_pending) return false
    const { resolve, timer } = _pending
    _pending = null
    clearTimeout(timer)
    resolve({ accessToken, refreshToken })
    return true
}

function rejectOAuth(reason) {
    if (!_pending) return false
    const { reject, timer } = _pending
    _pending = null
    clearTimeout(timer)
    reject(new Error(reason || 'OAuth cancelled'))
    return true
}

module.exports.resolveOAuth = resolveOAuth
module.exports.rejectOAuth  = rejectOAuth

// ── System-browser OAuth helper ───────────────────────────────────
// Opens the given URL in the system browser and waits for the
// centrio://auth?accessToken=... deep link to come back.
function systemBrowserOAuth({ authUrl, timeoutMs = 5 * 60 * 1000 }) {
    return new Promise((resolve, reject) => {
        if (_pending) {
            // Cancel any previous pending auth
            const prev = _pending
            _pending = null
            clearTimeout(prev.timer)
            prev.reject(new Error('New auth started'))
        }

        const timer = setTimeout(() => {
            _pending = null
            reject(new Error(t('oauth.timeout')))
        }, timeoutMs)

        _pending = { resolve, reject, timer }

        // Open system browser — no Electron window needed
        shell.openExternal(authUrl).catch((err) => {
            _pending = null
            clearTimeout(timer)
            reject(err)
        })
    })
}


function registerOAuthIpc({ getMainWindow }) {
    const API_BASE = 'https://api.centrio.me'

    // ── Google — system browser + deep link ──────────────────────
    ipcMain.handle('oauth-google', async () => {
        return wrapIpc(async () => {
            const { accessToken, refreshToken } = await systemBrowserOAuth({
                authUrl: `${API_BASE}/api/auth/google?from=desktop`
            })

            const apiSvc = require('../services/api')
            const result = await apiSvc.me(accessToken)
            const user = result?.data?.user
            if (!user) throw new Error('Failed to get user data')

            return { user, accessToken, refreshToken }
        })
    })

    // ── Yandex — system browser + deep link ──────────────────────
    ipcMain.handle('oauth-yandex', async () => {
        return wrapIpc(async () => {
            const { accessToken, refreshToken } = await systemBrowserOAuth({
                authUrl: `${API_BASE}/api/auth/yandex?from=desktop`
            })

            const apiSvc = require('../services/api')
            const result = await apiSvc.me(accessToken)
            const user = result?.data?.user
            if (!user) throw new Error('Failed to get user data')

            return { user, accessToken, refreshToken }
        })
    })

}

module.exports.registerOAuthIpc = registerOAuthIpc
