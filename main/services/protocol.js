const { app } = require('electron')
const { APP_PROTOCOL, IPC_CHANNELS } = require('../config/constants')
const { t } = require('./i18n')
const { safeSendToWindow } = require('../utils/window')

function registerProtocol() {
    try {
        if (process.defaultApp) {
            if (process.argv.length >= 2) {
                app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [process.argv[1]])
            }
        } else {
            app.setAsDefaultProtocolClient(APP_PROTOCOL)
        }
    } catch (e) {
        console.error(`${t('protocol.handlerError')}:`, e)
    }
}

function handleProtocolUrl(url, getMainWindow, showMainWindow) {
    if (!url) return

    try {
        // ── centrio://auth?accessToken=...&refreshToken=... ───────
        // Resolves a pending systemBrowserOAuth() promise in oauth.js
        if (url.startsWith(`${APP_PROTOCOL}://auth`)) {
            const urlObj   = new URL(url)
            const token    = urlObj.searchParams.get('accessToken')
            const refresh  = urlObj.searchParams.get('refreshToken') || ''
            const error    = urlObj.searchParams.get('error')

            // Lazy-require to avoid circular deps
            const { resolveOAuth, rejectOAuth } = require('../ipc/oauth')

            if (token) {
                const handled = resolveOAuth(token, refresh)
                if (handled) {
                    // Bring app to front so user sees they're logged in
                    showMainWindow()
                    return
                }
            } else if (error) {
                rejectOAuth(error)
                return
            }
        }
    } catch (e) {
        console.error('[protocol] handleProtocolUrl parse error:', e)
    }

    // ── All other protocol URLs → send to renderer ────────────────
    showMainWindow()
    safeSendToWindow(getMainWindow, IPC_CHANNELS.PROTOCOL_URL, url)
}

module.exports = {
    registerProtocol,
    handleProtocolUrl
}
