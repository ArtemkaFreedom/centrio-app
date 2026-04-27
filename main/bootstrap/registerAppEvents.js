const tracker = require('../services/tracker')

function registerAppEvents({
    app,
    getMainWindow,
    showMainWindow,
    createWindow,
    unregisterShortcuts,
    handleProtocolUrl,
    isQuittingRef
}) {
    app.on('open-url', (event, url) => {
        event.preventDefault()
        handleProtocolUrl(url, getMainWindow, showMainWindow)
    })

    app.on('before-quit', (event) => {
        if (isQuittingRef._flushed) return  // prevent double-trigger
        event.preventDefault()
        isQuittingRef._flushed = true
        isQuittingRef.value = true
        tracker.stop()
        tracker.flush()
            .catch(() => {})
            .finally(() => app.quit())
    })

    app.on('will-quit', () => {
        unregisterShortcuts()
    })

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