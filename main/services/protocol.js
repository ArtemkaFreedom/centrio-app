const { app } = require('electron')
const { APP_PROTOCOL, SUPPORTED_PROTOCOLS, IPC_CHANNELS } = require('../config/constants')
const { t } = require('./i18n')
const { safeSendToWindow } = require('../utils/window')

function registerProtocol() {
    for (const protocol of SUPPORTED_PROTOCOLS) {
        try {
            if (process.defaultApp) {
                if (process.argv.length >= 2) {
                    app.setAsDefaultProtocolClient(protocol, process.execPath, [process.argv[1]])
                }
            } else {
                app.setAsDefaultProtocolClient(protocol)
            }
        } catch (e) {
            console.error(`${t('protocol.handlerError')}:`, e)
        }
    }
}

// Used by initApp.js (cold-start argv) and singleInstance.js (second-instance
// commandLine) to find the deep-link argument among a process's raw argv —
// now that we register more than one scheme (see SUPPORTED_PROTOCOLS above),
// both call sites need to recognize any of them, not just `centrio://`.
function isProtocolUrl(str) {
    if (typeof str !== 'string') return false
    // Case-insensitive to match the case-insensitive tg://resolve check
    // below — Windows argv (cold-start/second-instance) could otherwise
    // silently drop an uppercase-scheme deep link that macOS's 'open-url'
    // event (which doesn't go through this function) would still catch.
    const lower = str.toLowerCase()
    return SUPPORTED_PROTOCOLS.some((p) => lower.startsWith(`${p}://`))
}

function handleProtocolUrl(url, getMainWindow, showMainWindow) {
    if (!url) return

    try {
        // ── centrio://auth?accessToken=...&refreshToken=...&state=... ─────
        // Resolves a pending systemBrowserOAuth() promise in oauth.js.
        // This branch ALWAYS returns once it recognizes the URL as an auth
        // callback — a token/error should never fall through to the generic
        // "send raw URL to renderer" path below, whether or not it was
        // accepted (an unsolicited or nonce-mismatched callback is exactly
        // the kind of thing that must NOT be handed to the renderer).
        if (url.startsWith(`${APP_PROTOCOL}://auth`)) {
            const urlObj   = new URL(url)
            const token    = urlObj.searchParams.get('accessToken')
            const refresh  = urlObj.searchParams.get('refreshToken') || ''
            const state    = urlObj.searchParams.get('state') || ''
            const error    = urlObj.searchParams.get('error')

            // Lazy-require to avoid circular deps
            const { resolveOAuth, rejectOAuth } = require('../ipc/oauth')

            if (token) {
                const handled = resolveOAuth(token, refresh, state)
                if (handled) {
                    // Bring app to front so user sees they're logged in
                    showMainWindow()
                } else {
                    console.warn('[protocol] Ignored centrio://auth callback: no matching pending OAuth attempt')
                }
                return
            } else if (error) {
                rejectOAuth(error)
                return
            }

            // auth:// URL with neither token nor error — malformed/unexpected,
            // still don't let it fall through to the renderer.
            return
        }

        // ── tg://resolve?domain=username — Telegram deep link clicked
        // OUTSIDE the app (another browser/app), handed to us by the OS
        // because we're now registered as a tg:// handler (see
        // registerProtocol above). Unlike the in-webview version of this
        // feature (webview-preload.js → renderer/webview-tabs-bind.js),
        // there is no DOM/webview state here in main — so we only do a
        // coarse shape check and forward the raw URL to the renderer,
        // which re-validates the `domain` value and owns the actual
        // "find an open Telegram tab and load it there" decision via the
        // SAME translateDeepLinkUrl()/routeDeepLink() used for in-app
        // clicks (single source of truth for that validation, not
        // duplicated here). We deliberately do NOT try to handle other
        // tg:// forms (tg://msg, tg://user, ...) — unrecognized ones fall
        // through to the generic branch below like any other protocol URL.
        if (/^tg:\/\/resolve(\?|$)/i.test(url)) {
            showMainWindow()
            safeSendToWindow(getMainWindow, IPC_CHANNELS.DEEP_LINK_ROUTE, { service: 'telegram', href: url })
            return
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
    handleProtocolUrl,
    isProtocolUrl
}
