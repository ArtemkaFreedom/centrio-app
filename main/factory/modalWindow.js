const { BrowserWindow } = require('electron')
const { PATHS, APP_NAME } = require('../config/constants')

function createModalWindow({
    parent = null,
    width = 600,
    height = 700,
    title = APP_NAME,
    modal = true,
    show = true
}) {
    return new BrowserWindow({
        width,
        height,
        parent,
        modal,
        show,
        icon: PATHS.ICON,
        title,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })
}

module.exports = {
    createModalWindow
}