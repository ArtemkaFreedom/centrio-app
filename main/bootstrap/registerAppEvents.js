const { shell } = require('electron')
const { fileURLToPath } = require('url')
const path = require('path')
const tracker = require('../services/tracker')
const store = require('../services/store')
const { getWebviewPreloadPath } = require('../ipc/api')

// Normalizes a preload value (file:// URL or plain path, as seen in either
// webPreferences.preload or our own getWebviewPreloadPath() output) down to a
// comparable absolute filesystem path. Comparing normalized paths instead of
// raw strings avoids false-positive blocks from harmless formatting
// differences (URL-encoding, drive-letter case on Windows, trailing slash)
// between what we generated and what Electron reports back.
function normalizePreloadPath(value) {
    if (typeof value !== 'string' || !value) return null
    try {
        const p = value.startsWith('file://') ? fileURLToPath(value) : value
        return path.resolve(p).toLowerCase()
    } catch {
        return null
    }
}

let log
try { log = require('electron-log') } catch { log = console }

function registerAppEvents({
    app,
    getMainWindow,
    showMainWindow,
    createWindow,
    unregisterShortcuts,
    handleProtocolUrl,
    isQuittingRef
}) {
    app.on('browser-window-created', (_e, win) => {
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                shell.openExternal(url).catch(() => {})
            }
            return { action: 'deny' }
        })
    })

    // SECURITY: validate every <webview> attachment before Electron creates the
    // guest process. Without this, a compromised/exploited main-window renderer
    // (XSS, supply-chain bug in a bundled dep, etc.) could attach a webview with
    // attacker-controlled webPreferences (e.g. nodeIntegration:true or a
    // malicious preload script) or point it at an arbitrary session partition
    // (e.g. another messenger's persisted cookies), since the renderer builds
    // <webview> elements itself via DOM APIs (renderer/messengers.js,
    // renderer/webview-tabs-bind.js) and the host process otherwise trusts
    // whatever attributes it declared. This is the standard Electron mitigation
    // (see Electron security checklist §12, "verify webview options before
    // creation") and was previously missing entirely. Every legitimate webview
    // in this app uses partition `persist:<messenger.id>` for a messenger that
    // actually exists in the store and the app's own webview-preload.js — both
    // are cheap to check here and let us fail closed (deny attachment) on any
    // mismatch instead of guessing.
    app.on('web-contents-created', (_e, contents) => {
        contents.on('will-attach-webview', (event, webPreferences, params) => {
            try {
                const partition = params.partition || webPreferences.partition || ''
                const messengers = store.get('messengers', []) || []
                const isKnownPartition = messengers.some((m) => m && m.id && `persist:${m.id}` === partition)

                let expectedPreload = null
                try { expectedPreload = getWebviewPreloadPath() } catch (err) {
                    log.error('[security] will-attach-webview: failed to resolve expected preload path:', err.message)
                }

                const normalizedExpected = normalizePreloadPath(expectedPreload)
                const normalizedActual = normalizePreloadPath(webPreferences.preload)
                const preloadOk = !!normalizedExpected && normalizedExpected === normalizedActual

                if (!isKnownPartition || !preloadOk) {
                    log.warn('[security] will-attach-webview blocked — unexpected partition or preload', {
                        partition,
                        preload: webPreferences.preload
                    })
                    event.preventDefault()
                    return
                }

                // Re-assert safe defaults regardless of what the guest page/DOM declared.
                webPreferences.nodeIntegration = false
                webPreferences.nodeIntegrationInSubFrames = false
                webPreferences.contextIsolation = true
                webPreferences.preload = expectedPreload
            } catch (err) {
                log.error('[security] will-attach-webview validation error, denying attach:', err.message)
                event.preventDefault()
            }
        })
    })

    app.on('open-url', (event, url) => {
        event.preventDefault()
        handleProtocolUrl(url, getMainWindow, showMainWindow)
    })

    app.on('before-quit', (event) => {
        if (isQuittingRef._flushed) return
        event.preventDefault()
        isQuittingRef._flushed = true
        isQuittingRef.value = true
        tracker.stop()

        // tracker.flush() makes a network call (see api.js/trackStats) that,
        // before this fix, had no timeout anywhere in the chain — a stalled
        // connection (dead network, VPN torn down mid-quit) meant `before-quit`
        // could hang forever and the app would never actually exit. Race it
        // against a hard deadline so quitting is never blocked on the network.
        const FLUSH_DEADLINE_MS = 4000
        const deadline = new Promise((resolve) => setTimeout(resolve, FLUSH_DEADLINE_MS))

        Promise.race([tracker.flush().catch(() => {}), deadline])
            .finally(() => app.quit())
    })

    app.on('will-quit', () => { unregisterShortcuts() })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    })

    app.on('activate', () => {
        const win = getMainWindow()
        if (!win || win.isDestroyed()) createWindow()
        else showMainWindow()
    })
}

module.exports = registerAppEvents
