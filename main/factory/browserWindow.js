const path = require('path')
const { BrowserWindow } = require('electron')
const store = require('../services/store')
const { PATHS } = require('../config/constants')

function getSavedBounds() {
    return {
        width: store.get('window.width', 1440),
        height: store.get('window.height', 960)
    }
}

function createMainBrowserWindow() {
    const bounds = getSavedBounds()

    const win = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        minWidth: 1100,
        minHeight: 720,
        show: false,
        backgroundColor: '#111827',
        autoHideMenuBar: true,
        title: 'Centrio',
        icon: PATHS.ICON,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.resolve(__dirname, '..', '..', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
            spellcheck: false
        }
    })

    win.on('resize', () => {
        try {
            const [width, height] = win.getSize()
            store.set('window.width', width)
            store.set('window.height', height)
        } catch {}
    })

    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' }
    })

    return win
}

module.exports = {
    createMainBrowserWindow
}