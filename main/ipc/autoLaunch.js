const { ipcMain } = require('electron')
const { t } = require('../services/i18n')

let autoLauncher = null
try {
    const AutoLaunch = require('auto-launch')
    const { app } = require('electron')

    autoLauncher = new AutoLaunch({
        name: 'Centrio',
        path: app.getPath('exe')
    })
} catch {
    autoLauncher = null
}

function registerAutoLaunchIpc() {
    ipcMain.on('set-auto-launch', async (event, enabled) => {
        try {
            if (!autoLauncher) throw new Error(t('autoLaunch.unavailable'))
            if (enabled) await autoLauncher.enable()
            else await autoLauncher.disable()
            event.reply('auto-launch-result', { success: true, enabled })
        } catch (err) {
            event.reply('auto-launch-result', { success: false, error: err.message })
        }
    })

    ipcMain.handle('get-auto-launch', async () => {
        try {
            if (!autoLauncher) return false
            return await autoLauncher.isEnabled()
        } catch {
            return false
        }
    })
}

module.exports = registerAutoLaunchIpc