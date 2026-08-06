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

// Реальные расширения — платная Pro-фича. Проверка на клиенте (renderer/extensions-ui.js)
// защищает только UI; сама установка/включение идёт через IPC, вызываемый из webview-контента
// в devtools можно дёрнуть window.electronAPI.extInstall/extToggle напрямую — так что источник
// правды (store.cloud.user.plan) проверяется здесь же, в main, а не только в renderer.
function isProUser() {
    try {
        const store = require('../services/store')
        const plan = String(store.get('cloud.user', null)?.plan || 'FREE').toUpperCase()
        return plan !== 'FREE'
    } catch {
        return false
    }
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
        if (!isProUser()) {
            return { success: false, error: 'pro-required' }
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
        if (enabled && !isProUser()) {
            return { success: false, error: 'pro-required' }
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
