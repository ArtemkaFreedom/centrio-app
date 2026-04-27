require('dotenv').config()

const { app, ipcMain, BrowserWindow } = require('electron')
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