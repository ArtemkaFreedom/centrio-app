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