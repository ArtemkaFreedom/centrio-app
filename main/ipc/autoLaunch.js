const { ipcMain, app } = require('electron')

let log
try { log = require('electron-log') } catch { log = console }

// BUGFIX ("настройка 'запускать с системой' не работает"): this used to go
// through the third-party `auto-launch` package, which on Windows shells out
// to `reg.exe` via `winreg` and parses its text output. That's an extra,
// fragile moving part (locale-dependent stdout parsing, relies on `reg.exe`
// being reachable) for something Electron already does natively and more
// reliably — app.setLoginItemSettings()/getLoginItemSettings() write/read the
// same HKCU Run key directly through the OS APIs, with no subprocess and no
// text parsing to break. This also removes the failure mode entirely instead
// of just reporting it better.
function registerAutoLaunchIpc() {
    ipcMain.on('set-auto-launch', async (event, enabled) => {
        try {
            app.setLoginItemSettings({ openAtLogin: !!enabled })
            event.reply('auto-launch-result', { success: true, enabled: !!enabled })
        } catch (err) {
            log.error('[autoLaunch] set-auto-launch failed:', err)
            event.reply('auto-launch-result', { success: false, error: err.message })
        }
    })

    ipcMain.handle('get-auto-launch', async () => {
        try {
            return !!app.getLoginItemSettings().openAtLogin
        } catch (err) {
            log.error('[autoLaunch] get-auto-launch failed:', err)
            return false
        }
    })
}

module.exports = registerAutoLaunchIpc