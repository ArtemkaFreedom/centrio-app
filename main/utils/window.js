function isWindowAlive(win) {
    return !!win && !win.isDestroyed()
}

function withWindow(getWindow, callback) {
    const win = typeof getWindow === 'function' ? getWindow() : getWindow
    if (!isWindowAlive(win)) return null
    return callback(win)
}

function safeSendToWindow(getWindow, channel, payload) {
    return withWindow(getWindow, (win) => {
        win.webContents.send(channel, payload)
        return true
    }) || false
}

function focusWindow(getWindow) {
    return withWindow(getWindow, (win) => {
        if (win.isMinimized()) win.restore()
        if (!win.isVisible()) win.show()
        win.focus()
        return true
    }) || false
}

module.exports = {
    isWindowAlive,
    withWindow,
    safeSendToWindow,
    focusWindow
}