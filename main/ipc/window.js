const { ipcMain, shell, app, BrowserWindow } = require('electron')
const registry = require('../ext-tabs-registry')

let log
try { log = require('electron-log') } catch { log = console }

function safeOn(channel, listener) {
    ipcMain.removeAllListeners(channel)
    ipcMain.on(channel, listener)
}

function safeHandle(channel, handler) {
    try {
        ipcMain.removeHandler(channel)
    } catch {}
    ipcMain.handle(channel, handler)
}

function registerWindowIpc({ getMainWindow, isQuittingRef }) {
    // expose getMainWindow for popup-window handler
    const _getMainWindow = getMainWindow
    safeOn('minimize-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) win.minimize()
    })

    safeOn('maximize-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (!win || win.isDestroyed()) return

        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
    })

    safeOn('close-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) win.close()
    })

    safeOn('quit-app', (_event, relaunch = false) => {
        isQuittingRef.value = true
        if (relaunch) app.relaunch()
        app.quit()
    })

    safeOn('hide-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) win.hide()
    })

    safeOn('toggle-fullscreen', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) {
            win.setFullScreen(!win.isFullScreen())
        }
    })

    safeOn('set-app-zoom', (event, level) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (!win || win.isDestroyed()) return

        const zoomLevel = Number(level)
        if (!Number.isFinite(zoomLevel)) return

        win.webContents.setZoomLevel(zoomLevel)
    })

    safeOn('open-url', async (_event, url) => {
        if (!url || typeof url !== 'string') return

        try {
            await shell.openExternal(url)
        } catch (error) {
            console.error('open-url error:', error)
        }
    })

    safeHandle('open-popup-window', async (_event, url, opts = {}) => {
        try {
            const w = opts.width  || 380
            const h = opts.height || 560

            if (url && url.startsWith('chrome-extension://')) {
                const {
                    findExtensionBgPage,
                    setPendingPopup,
                    openViaBridge,
                    openViaSW,
                    getBridgeId,
                } = require('../services/extensions')

                // ── Strategy 1: own-context window.open ─────────────────────
                // ExtensionNavigationThrottle ALWAYS allows same-extension
                // navigations. By finding the target extension's own background
                // page and calling window.open(popupUrl) from its JS context,
                // the navigation initiator becomes chrome-extension://targetId
                // (same as the destination) → throttle PROCEED, no WAR check.
                // Works for MV2 extensions with a persistent background page.
                const extIdMatch = url.match(/^chrome-extension:\/\/([^/]+)\//)
                const targetExtId = extIdMatch && extIdMatch[1]
                const bridgeId = getBridgeId()

                if (targetExtId && targetExtId !== bridgeId) {
                    const bgWc = findExtensionBgPage(targetExtId)
                    if (bgWc) {
                        log.info(`[ext-popup] own-context: found bg page for ${targetExtId}`)
                        setPendingPopup(url, w, h)
                        try {
                            const features = `width=${w},height=${h}`
                            const result = await bgWc.executeJavaScript(
                                `(function(){
                                    try {
                                        window.open(${JSON.stringify(url)}, '_blank', ${JSON.stringify(features)});
                                        return 'ok';
                                    } catch(e) {
                                        return 'err:' + e.message;
                                    }
                                })()`
                            )
                            log.info(`[ext-popup] own-context result: ${result}`)
                            return { success: true, route: 'own-context' }
                        } catch (e) {
                            log.warn('[ext-popup] own-context execute failed:', e.message)
                        }
                    } else {
                        log.info(`[ext-popup] no bg page found for ${targetExtId}, using bridge`)
                    }
                }

                // ── Strategy 2: SW message → chrome.windows.create ──────────
                // Bridge sends {__centrio_open: url} to the target extension's
                // service worker (patched during install by patchExtensionSW).
                // The SW calls chrome.windows.create from its own extension
                // context (same-extension) → throttle always allows.
                // This is the primary fallback for MV3 extensions.
                setPendingPopup(url, w, h)
                log.info(`[ext-popup] SW approach for ${targetExtId}: ${url}`)
                const swOk = await openViaSW(targetExtId, url, w, h)
                if (swOk) return { success: true, route: 'sw-message' }
                log.warn('[ext-popup] SW approach failed, trying bridge direct')

                // ── Strategy 3: bridge direct window.open ─────────────────────
                // Bridge background page (chrome-extension://bridgeId) opens the
                // popup URL via window.open.  Requires the target extension's WAR
                // to include extension_ids:[bridgeId].
                // Last resort before the BrowserWindow fallback.
                log.info(`[ext-popup] bridge direct: ${url}`)
                const ok = await openViaBridge(url, w, h)
                if (ok) return { success: true, route: 'bridge' }
                log.warn('[ext-popup] bridge unavailable, falling back to BrowserWindow')
            }

            const mainWin = _getMainWindow()
            const partition = 'persist:ext-popup'
            let targetUrl = url

            if (targetUrl && targetUrl.startsWith('chrome-extension://')) {
                // ExtensionNavigationThrottle blocks browser-initiated navigations to chrome-extension://
                // URLs in Electron 36. We fall back to our custom centrio-ext:// scheme which
                // serves the same files but bypasses the throttle.
                targetUrl = targetUrl.replace('chrome-extension://', 'centrio-ext://')
                log.info(`[ext-popup] strategies failed, using fallback with custom protocol: ${targetUrl}`)
            }

            let x, y
            if (mainWin && !mainWin.isDestroyed()) {
                const [mx, my] = mainWin.getPosition()
                const [mw, mh] = mainWin.getSize()
                x = mx + mw - w - 20
                y = my + mh - h - 60
            }

            const popup = new BrowserWindow({
                width: w, height: h, x, y,
                title: opts.name || 'Расширение',
                resizable: true, minimizable: false, maximizable: false,
                alwaysOnTop: true, skipTaskbar: true, show: false,
                webPreferences: {
                    partition,
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: false,
                    webSecurity: false, // Required for many extensions to work when served via custom protocol
                    allowRunningInsecureContent: true,
                }
            })

            popup.setMenuBarVisibility(false)

            popup.webContents.on('did-start-loading', () => {
                log.info(`[ext-popup] did-start-loading url=${popup.webContents.getURL()}`)
            })
            popup.webContents.on('did-finish-load', () => {
                log.info(`[ext-popup] did-finish-load url=${popup.webContents.getURL()}`)
            })
            popup.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
                log.error(`[ext-popup] did-fail-load ${code} ${desc} url=${failedUrl}`)
            })
            popup.webContents.on('console-message', (_e, level, message, line, sourceId) => {
                const tag = ['log','info','warn','error','debug'][level] || level
                log.info(`[ext-popup][${tag}] ${message}  (${sourceId}:${line})`)
            })
            popup.webContents.on('render-process-gone', (_e, details) => {
                log.error(`[ext-popup] render-process-gone reason=${details.reason}`)
            })

            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (newUrl.startsWith('chrome-extension://')) return { action: 'allow' }
                if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
                    shell.openExternal(newUrl).catch(() => {})
                }
                return { action: 'deny' }
            })
            popup.webContents.on('will-navigate', (event, navUrl) => {
                if (navUrl.startsWith('chrome-extension://')) return
                if (navUrl.startsWith('about:')) return
                event.preventDefault()
                if (navUrl.startsWith('http://') || navUrl.startsWith('https://')) {
                    shell.openExternal(navUrl).catch(() => {})
                }
            })

            popup.once('ready-to-show', () => {
                popup.show()
                popup.focus()
            })

            log.info(`[ext-popup] loadURL: ${targetUrl} in ${partition}`)
            popup.loadURL(targetUrl)
                .catch(e => log.error('[ext-popup] loadURL failed:', e.message))

            return { success: true, route: 'fallback' }
        } catch (e) {
            log.error('[ext-popup] error:', e.message)
            return { success: false, error: e.message }
        }
    })

    safeHandle('get-window-visibility-state', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()

        if (!win || win.isDestroyed()) {
            return {
                visible: false,
                focused: false,
                minimized: false
            }
        }

        return {
            visible: win.isVisible(),
            focused: win.isFocused(),
            minimized: win.isMinimized()
        }
    })

    safeHandle('app:getVersion', () => {
        return app.getVersion()
    })
}

module.exports = registerWindowIpc