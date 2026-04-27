const store = require('./services/store')
const { clearBadges } = require('./services/badge')
const { PATHS, IPC_CHANNELS } = require('./config/constants')
const { isWindowAlive, safeSendToWindow } = require('./utils/window')
const { createMainBrowserWindow } = require('./factory/browserWindow')

let mainWindow = null
let isQuittingRef = { value: false }

function setIsQuittingRef(ref) {
    isQuittingRef = ref
}

function injectAppLogo(win) {
    if (!isWindowAlive(win)) return

    const logoPath = `file://${String(PATHS.LOGO || '').replace(/\\/g, '/')}`

    win.webContents.executeJavaScript(`
        (() => {
            try {
                const logoImg = document.querySelector('.app-logo')
                if (logoImg) {
                    logoImg.src = ${JSON.stringify(logoPath)}
                }
            } catch {}
        })()
    `).catch((error) => {
        console.warn('[window] injectAppLogo failed:', error?.message || error)
    })
}

function bindWindowEvents(win) {
    win.webContents.on('did-finish-load', () => {
        injectAppLogo(win)
    })

    win.webContents.on('render-process-gone', (_event, details) => {
        console.error('[window] render-process-gone:', details)
    })

    win.webContents.on('unresponsive', () => {
        console.warn('[window] main window became unresponsive')
    })

    win.once('ready-to-show', () => {
        clearBadges(getMainWindow)

        const settings = store.get('settings', {})
        if (settings?.startMinimized) {
            win.minimize()
        } else {
            win.show()
        }
    })

    win.on('focus', () => {
        clearBadges(getMainWindow)
    })

    win.on('close', (e) => {
        if (isQuittingRef.value) return

        const behavior = store.get('settings.closeBehavior', 'tray')

        if (behavior === 'tray') {
            e.preventDefault()
            win.hide()
            return
        }

        if (behavior === 'minimize') {
            e.preventDefault()
            win.minimize()
            return
        }

        isQuittingRef.value = true
    })

    win.on('hide', () => {
        safeSendToWindow(getMainWindow, IPC_CHANNELS.APP_HIDDEN)
    })

    win.on('closed', () => {
        if (mainWindow === win) {
            mainWindow = null
        }
    })
}

function createWindow() {
    if (isWindowAlive(mainWindow)) {
        return mainWindow
    }

    mainWindow = createMainBrowserWindow()
    bindWindowEvents(mainWindow)

    mainWindow.loadFile(PATHS.INDEX_HTML).catch((error) => {
        console.error('[window] failed to load index.html:', error)
    })

    return mainWindow
}

function getMainWindow() {
    return mainWindow
}

function showMainWindow() {
    if (!isWindowAlive(mainWindow)) {
        return createWindow()
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore()
    }

    if (!mainWindow.isVisible()) {
        mainWindow.show()
    }

    mainWindow.focus()
    return mainWindow
}

module.exports = {
    createWindow,
    getMainWindow,
    showMainWindow,
    setIsQuittingRef
}