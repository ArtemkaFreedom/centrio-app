const { ipcMain, shell, app, BrowserWindow } = require('electron')

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
    const store = require('../services/store')
    // expose getMainWindow for popup-window handler
    const _getMainWindow = getMainWindow
    safeOn('minimize-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) {
            win.minimize()

            // Check for lock on minimize
            const { isPasswordEnabled } = require('../services/store')
            const settings = store.get('settings', {})
            const security = store.get('security', {})

            if ((settings.lockOnHide || security.lockOnHide) && isPasswordEnabled()) {
                win.webContents.send('show-lock-screen')
            }
        }
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
        if (win && !win.isDestroyed()) {
            win.hide()

            // Check for lock on hide (tray behavior)
            const { isPasswordEnabled } = require('../services/store')
            const settings = store.get('settings', {})
            const security = store.get('security', {})

            if ((settings.lockOnHide || security.lockOnHide) && isPasswordEnabled()) {
                win.webContents.send('show-lock-screen')
            }
        }
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
            const w = opts.width  || 400
            const h = opts.height || 600

            const mainWin = _getMainWindow()
            let x, y
            if (mainWin && !mainWin.isDestroyed()) {
                const [mx, my] = mainWin.getPosition()
                const [mw, mh] = mainWin.getSize()
                x = mx + mw - w - 20
                y = my + mh - h - 60
            }

            const popup = new BrowserWindow({
                width: w, height: h, x, y,
                title: opts.name || 'Centrio',
                resizable: true, minimizable: false, maximizable: false,
                alwaysOnTop: true, skipTaskbar: true, show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                }
            })

            popup.setMenuBarVisibility(false)

            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
                    shell.openExternal(newUrl).catch(() => {})
                }
                return { action: 'deny' }
            })

            popup.webContents.on('will-navigate', (event, navUrl) => {
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

            popup.loadURL(url)
                .catch(e => log.error('[popup] loadURL failed:', e.message))

            return { success: true }
        } catch (e) {
            log.error('[popup] error:', e.message)
            return { success: false, error: e.message }
        }
    })

    safeOn('open-translate-window', (_event, text) => {
        try {
            const url = `https://translate.google.com/?sl=auto&tl=ru&text=${encodeURIComponent(text || '')}&op=translate`
            const mainWin = _getMainWindow()
            let x, y
            if (mainWin && !mainWin.isDestroyed()) {
                const [mx, my] = mainWin.getPosition()
                const [mw, mh] = mainWin.getSize()
                x = mx + Math.floor((mw - 800) / 2)
                y = my + Math.floor((mh - 600) / 2)
            }
            const popup = new BrowserWindow({
                width: 800, height: 600, x, y,
                title: 'Translate',
                resizable: true, minimizable: true, maximizable: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    partition: 'persist:translate'
                }
            })
            popup.setMenuBarVisibility(false)
            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (newUrl.startsWith('https://translate.google')) return { action: 'allow' }
                shell.openExternal(newUrl).catch(() => {})
                return { action: 'deny' }
            })
            popup.loadURL(url).catch(e => log.error('[translate] loadURL failed:', e.message))
        } catch (e) {
            log.error('[translate] error:', e.message)
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