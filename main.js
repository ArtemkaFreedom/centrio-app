require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { app, ipcMain, BrowserWindow, protocol, Menu } = require('electron')
Menu.setApplicationMenu(null)


// ── GPU / compositing fixes (must run before app.whenReady) ──────────────────
// Electron 36.9+ on Windows: CalculateNativeWinOcclusion can incorrectly mark
// the window as hidden → GPU stops presenting frames → black screen while
// mouse hit-testing still works (content is rendered but not shown).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
// Force ANGLE D3D11 backend — avoids swapchain issues on some GPU drivers.
app.commandLine.appendSwitch('use-angle', 'd3d11')
// ─────────────────────────────────────────────────────────────────────────────

// Логирование необработанных ошибок главного процесса
function _writeCrashLog(label, err) {
    try {
        const logDir = app.isReady()
            ? app.getPath('userData')
            : path.join(process.env.APPDATA || '', 'Centrio')
        const logFile = path.join(logDir, 'crash.log')
        const line = `[${new Date().toISOString()}] ${label}: ${err?.stack || err}\n`
        fs.appendFileSync(logFile, line, 'utf8')
        console.error(line)
    } catch {}
}

process.on('uncaughtException', (err) => {
    _writeCrashLog('uncaughtException', err)
})

process.on('unhandledRejection', (reason) => {
    _writeCrashLog('unhandledRejection', reason)
})

// Ошибки из рендерера (window.onerror / unhandledrejection)
ipcMain.on('renderer-error-log', (_event, data) => {
    _writeCrashLog('renderer-js', JSON.stringify(data))
})

// Рендерер просит перестроить tray-меню на текущем языке (после смены языка)
ipcMain.on('update-tray-menu', () => { updateTrayMenu() })

const { APP_USER_MODEL_ID } = require('./main/config/constants')

const {
    createWindow,
    getMainWindow,
    showMainWindow,
    setIsQuittingRef
} = require('./main/window')

const {
    initTray,
    createTray,
    updateTrayMenu
} = require('./main/tray')

const { unregisterShortcuts } = require('./main/services/shortcuts')
const { registerProtocol, handleProtocolUrl } = require('./main/services/protocol')
const { initSingleInstance } = require('./main/services/singleInstance')
const store = require('./main/services/store')

const registerIpc = require('./main/bootstrap/registerIpc')
const registerAppEvents = require('./main/bootstrap/registerAppEvents')
const initApp = require('./main/bootstrap/initApp')

const isQuittingRef = { value: false }
setIsQuittingRef(isQuittingRef)

initTray({
    getMainWindow,
    showMainWindow,
    isQuittingRef
})

app.setAppUserModelId(APP_USER_MODEL_ID)

function safeHandle(channel, handler) {
    try {
        ipcMain.removeHandler(channel)
    } catch {}
    ipcMain.handle(channel, handler)
}

safeHandle('store:get', async (_event, key, def) => {
    try {
        return store.get(key, def)
    } catch (error) {
        console.error(`store:get error for key "${key}"`, error)
        return def
    }
})

safeHandle('store:set', async (_event, key, value) => {
    try {
        store.set(key, value)
        return { success: true }
    } catch (error) {
        console.error(`store:set error for key "${key}"`, error)
        return { success: false, error: error.message }
    }
})

safeHandle('store:clear-all', async () => {
    try {
        store.clear()
        return { success: true }
    } catch (error) {
        console.error('store:clear-all error:', error)
        return { success: false, error: error.message }
    }
})

safeHandle('store:delete', async (_event, key) => {
    try {
        store.delete(key)
        return { success: true }
    } catch (error) {
        console.error(`store:delete error for key "${key}"`, error)
        return { success: false, error: error.message }
    }
})

const started = initApp({
    app,
    createWindow,
    createTray,
    registerIpc,
    getMainWindow,
    showMainWindow,
    updateTrayMenu,
    isQuittingRef,
    registerProtocol,
    initSingleInstance,
    handleProtocolUrl
})

if (started) {
    registerAppEvents({
        app,
        getMainWindow,
        showMainWindow,
        createWindow,
        unregisterShortcuts,
        handleProtocolUrl,
        isQuittingRef
    })
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        return
    }

    showMainWindow()
})