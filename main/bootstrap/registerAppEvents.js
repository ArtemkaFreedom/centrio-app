const { shell } = require('electron')
const tracker = require('../services/tracker')

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
