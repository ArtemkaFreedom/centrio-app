const { ipcMain } = require('electron')
const {
    applyGlobalProxy,
    applyMessengerProxy,
    testProxy
} = require('../services/proxy')
const { wrapIpc } = require('../utils/ipc')

function registerProxyIpc() {
    ipcMain.handle('apply-global-proxy', async (event, proxySettings) => {
        return wrapIpc(async () => {
            await applyGlobalProxy(proxySettings)
            return null
        })
    })

    ipcMain.handle('apply-messenger-proxy', async (event, messengerId, proxySettings) => {
        return wrapIpc(async () => {
            await applyMessengerProxy(messengerId, proxySettings)
            return null
        })
    })

    ipcMain.handle('test-proxy', async (event, proxySettings) => {
        return wrapIpc(async () => {
            return await testProxy(proxySettings)
        })
    })
}

module.exports = registerProxyIpc