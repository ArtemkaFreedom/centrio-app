const { ipcMain } = require('electron')
const {
    installExtension,
    uninstallExtension,
    toggleExtension,
    loadIntoPartition,
    getInstalledList
} = require('../services/extensions')

function safe(channel, handler) {
    try { ipcMain.removeHandler(channel) } catch {}
    ipcMain.handle(channel, handler)
}

function registerExtensionsIpc() {
    safe('ext:list', async () => {
        try {
            return { success: true, data: getInstalledList() }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:install', async (_, id) => {
        try {
            const manifest = await installExtension(id)
            return { success: true, manifest }
        } catch (e) {
            console.error('[ext] install error:', e.message)
            return { success: false, error: e.message }
        }
    })

    safe('ext:uninstall', async (_, id) => {
        try {
            uninstallExtension(id)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:toggle', async (_, id, enabled) => {
        try {
            toggleExtension(id, enabled)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:apply-to-session', async (_, partition) => {
        try {
            await loadIntoPartition(partition)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })
}

module.exports = registerExtensionsIpc
