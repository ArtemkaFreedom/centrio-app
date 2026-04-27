const { app } = require('electron')
const { APP_PROTOCOL } = require('../config/constants')

function initSingleInstance({ getMainWindow, showMainWindow, handleProtocolUrl }) {
    const gotLock = app.requestSingleInstanceLock()

    if (!gotLock) {
        app.quit()
        return false
    }

    app.on('second-instance', (event, commandLine) => {
        showMainWindow()

        const protocolPrefix = `${APP_PROTOCOL}://`
        const protocolArg = commandLine.find(
            (arg) => typeof arg === 'string' && arg.startsWith(protocolPrefix)
        )

        if (protocolArg) {
            handleProtocolUrl(protocolArg, getMainWindow, showMainWindow)
        }
    })

    return true
}

module.exports = {
    initSingleInstance
}