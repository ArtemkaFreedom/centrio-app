// IPC-хендлеры для реальных Chrome-расширений (сейчас: Google Переводчик).
// Каналы уже объявлены (были мёртвыми/no-op) в preload.js и renderer/webview-tabs-bind.js —
// здесь только регистрируем реальную реализацию.

const { ipcMain } = require('electron')
const ext = require('../services/extensions')

let log
try { log = require('electron-log') } catch { log = console }

function safeHandle(channel, handler) {
    try {
        ipcMain.removeHandler(channel)
    } catch {}
    ipcMain.handle(channel, handler)
}

function registerExtensionsIpc() {
    safeHandle('ext:list', () => {
        try {
            return { success: true, catalog: ext.getCatalogForUi() }
        } catch (err) {
            log.error('[ipc/extensions] ext:list error:', err.message)
            return { success: false, error: err.message, catalog: [] }
        }
    })

    safeHandle('ext:install', async (_event, key) => {
        if (typeof key !== 'string' || !ext.CATALOG[key]) {
            return { success: false, error: 'unknown-extension' }
        }
        return ext.installExtension(key)
    })

    safeHandle('ext:uninstall', async (_event, key) => {
        if (typeof key !== 'string' || !ext.CATALOG[key]) {
            return { success: false, error: 'unknown-extension' }
        }
        return ext.uninstallExtension(key)
    })

    safeHandle('ext:toggle', async (_event, key, enabled) => {
        if (typeof key !== 'string' || !ext.CATALOG[key]) {
            return { success: false, error: 'unknown-extension' }
        }
        return ext.setEnabledEverywhere(key, !!enabled)
    })

    // Вызывается при каждом создании webview (renderer/webview-tabs-bind.js:addWebview) —
    // должен быть дешёвым и безопасным no-op, если ничего не включено/не установлено.
    safeHandle('ext:apply-to-session', async (_event, partition) => {
        if (typeof partition !== 'string') {
            return { success: true, loaded: [] }
        }
        return ext.applyToSession(partition)
    })
}

module.exports = registerExtensionsIpc
