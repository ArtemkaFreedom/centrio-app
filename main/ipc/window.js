const { ipcMain, shell, app, BrowserWindow } = require('electron')

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
            const popup = new BrowserWindow({
                width:           opts.width  || 400,
                height:          opts.height || 600,
                resizable:       true,
                minimizable:     false,
                maximizable:     false,
                fullscreenable:  false,
                title:           opts.title || 'Centrio',
                autoHideMenuBar: true,
                backgroundColor: '#1e1e1e',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: false,
                    partition: opts.partition || undefined
                }
            })

            popup.webContents.on('will-navigate', (e, navUrl) => {
                if (!navUrl.startsWith('chrome-extension://')) {
                    e.preventDefault()
                    shell.openExternal(navUrl).catch(() => {})
                }
            })

            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (!newUrl.startsWith('chrome-extension://')) {
                    shell.openExternal(newUrl).catch(() => {})
                    return { action: 'deny' }
                }
                return { action: 'allow' }
            })

            popup.loadURL(url)
            popup.once('ready-to-show', () => popup.show())
            return { success: true }
        } catch (e) {
            console.error('[popup-window] error:', e.message)
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