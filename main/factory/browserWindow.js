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
    const isMac = process.platform === 'darwin'

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
        // На macOS используем hiddenInset — traffic lights остаются,
        // но titlebar прозрачный. На Win/Linux — полностью кастомный frame.
        frame: isMac,
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        titlebarAppearsTransparent: isMac,
        trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
        webPreferences: {
            preload: path.resolve(__dirname, '..', '..', 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webviewTag: true,
            spellcheck: false
        }
    })

    // Сохраняем размер с дебаунсом: resize стреляет десятки раз в секунду при
    // перетаскивании — синхронная запись в стор на каждый кадр давала просадки и
    // лишний дисковый I/O. Пишем только через 300мс после остановки.
    let resizeSaveTimer = null
    win.on('resize', () => {
        if (resizeSaveTimer) clearTimeout(resizeSaveTimer)
        resizeSaveTimer = setTimeout(() => {
            try {
                const [width, height] = win.getSize()
                store.set('window.width', width)
                store.set('window.height', height)
            } catch {}
        }, 300)
    })

    win.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' }
    })

    return win
}

module.exports = {
    createMainBrowserWindow
}