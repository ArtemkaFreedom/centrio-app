const { ipcMain } = require('electron')
const { clearBadges } = require('../services/badge')
const { focusWindow } = require('../utils/window')

function registerBadgeIpc({ getMainWindow, updateTrayMenu }) {
    ipcMain.on('update-badge', (event, count) => {
        updateTrayMenu(Math.max(0, Number(count) || 0))
        clearBadges(getMainWindow)
    })

    ipcMain.on('notification-clicked', () => {
        focusWindow(getMainWindow)
    })
}

module.exports = registerBadgeIpc