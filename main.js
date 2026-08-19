require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { app, ipcMain, BrowserWindow, protocol, Menu } = require('electron')
Menu.setApplicationMenu(null)


// ── GPU / compositing fixes (must run before app.whenReady) ──────────────────
if (process.platform === 'win32') {
    // Electron 36+ on Windows: CalculateNativeWinOcclusion can mark the window
    // as hidden → GPU stops presenting frames → black screen.
    app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
    // Force ANGLE D3D11 backend — avoids swapchain issues on some GPU drivers.
    // D3D11 is Windows-only; do NOT apply on Linux/macOS.
    app.commandLine.appendSwitch('use-angle', 'd3d11')
}
if (process.platform === 'linux') {
    // On Linux (especially VMs / Ubuntu without full GPU support) the GPU
    // sandbox can cause an immediate crash. Disable it for stability.
    app.commandLine.appendSwitch('no-sandbox')
    app.commandLine.appendSwitch('disable-gpu-sandbox')
}
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

// ── SECURITY: settings-key schema for store:get/set/delete ──────────────────
// The renderer can call these handlers with an arbitrary key string. Without
// validation, a compromised/exploited renderer (or a bug in a bundled webview
// preload) could read/write electron-store keys never meant to be renderer-
// controlled, or attempt a prototype-pollution-style key (`__proto__`,
// `constructor`, `prototype`) against the underlying conf/lodash path setter.
// Allowlist is built from every store key actually read/written by renderer
// code (renderer.js's `store` shim + renderer/*.js) — keep in sync when a new
// setting is introduced. electron-store supports dot-notation for nested
// values (e.g. "settings.language"), so we only need to allowlist the root
// segment before the first dot.
const ALLOWED_STORE_ROOTS = new Set([
    'settings', 'security', 'cloud', 'extensionsState', 'foldersEnabled',
    'menuCollapsed', 'messengers', 'mutedMessengers', 'globalMuteAll',
    'globalProxy', 'sidebarOrder', 'vpnAppModes', 'vpnActiveLink',
    'vpnSubUrl', 'vpnSubLinks', 'tabZoomLevel', 'appZoomLevel', 'folders',
    'dividers', 'lockOnStartup', 'pinEnabled', 'pinHash', 'split',
    // BUGFIX ("пресеты в сплитах не сохраняются"): these keys were added to
    // split.js/renderer.js well after this allowlist was written for the
    // store:get/set/delete IPC gate. store:set silently returned
    // { success: false } for any key not in this set (see isValidStoreKey
    // below), and the renderer's store.set() shim never inspects that
    // return value — so every splitPresets/pref write was dropped on the
    // floor with zero error surfaced anywhere, no matter how many times the
    // save button was clicked or how the renderer-side save flow was fixed.
    'splitPresets', 'splitLeftPctPref', 'gridRowPctPref', 'gridSidePctPref',
    // BUGFIX ("выбранный мессенджер не сохраняется между перезапусками"):
    // switchTab() in renderer.js needs to persist the active tab id so it can
    // be restored on next launch — same disease as the splitPresets bug above
    // (store:set silently rejected for any key missing from this allowlist).
    'activeTabId',
    // Онбординг-экран первого запуска (renderer/onboarding-auth.js) — same
    // disease as the two bugs above: a new persisted key added without also
    // adding it here silently never gets read or written.
    'onboardingAuthSeen',
    // 14-day Pro trial for onboarding users without an account — see
    // api-device-trial-redeem in main/ipc/api.js and the requirePro()/
    // addMessenger() checks in renderer.js.
    'localProTrialExpiresAt',
    // Expandable left sidebar (icon-only <-> icon+label, Franz-style) —
    // renderer.js applySidebarCollapsed()
    'sidebarBarExpanded',
    // Todos panel in the right sidebar — renderer/todos-bind.js, purely
    // local, never synced to the server.
    'todos'
])

const DANGEROUS_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function isValidStoreKey(key) {
    if (typeof key !== 'string' || key.length === 0) return false
    const segments = key.split('.')
    if (segments.some(seg => DANGEROUS_KEY_SEGMENTS.has(seg))) return false
    return ALLOWED_STORE_ROOTS.has(segments[0])
}

safeHandle('store:get', async (_event, key, def) => {
    if (!isValidStoreKey(key)) {
        console.warn(`[store] Blocked store:get for disallowed key "${key}"`)
        return def
    }
    try {
        return store.get(key, def)
    } catch (error) {
        console.error(`store:get error for key "${key}"`, error)
        return def
    }
})

safeHandle('store:set', async (_event, key, value) => {
    if (!isValidStoreKey(key)) {
        console.warn(`[store] Blocked store:set for disallowed key "${key}"`)
        return { success: false, error: 'Disallowed key' }
    }
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
    if (!isValidStoreKey(key)) {
        console.warn(`[store] Blocked store:delete for disallowed key "${key}"`)
        return { success: false, error: 'Disallowed key' }
    }
    try {
        store.delete(key)
        return { success: true }
    } catch (error) {
        console.error(`store:delete error for key "${key}"`, error)
        return { success: false, error: error.message }
    }
})

// ── Encrypted store (safeStorage) ────────────────────────────────────────────
const { encryptValue, decryptValue } = require('./main/services/secureStore')

safeHandle('store:secure-set', async (_event, key, value) => {
    if (!isValidStoreKey(key)) {
        console.warn(`[store] Blocked store:secure-set for disallowed key "${key}"`)
        return { success: false, error: 'Disallowed key' }
    }
    try {
        store.set(key, encryptValue(value))
        return { success: true }
    } catch (error) {
        console.error(`store:secure-set error for key "${key}"`, error)
        return { success: false, error: error.message }
    }
})

safeHandle('store:secure-get', async (_event, key, def) => {
    if (!isValidStoreKey(key)) {
        console.warn(`[store] Blocked store:secure-get for disallowed key "${key}"`)
        return def ?? null
    }
    try {
        const raw = store.get(key, null)
        if (raw === null || raw === undefined) return def ?? null
        return decryptValue(raw) ?? def ?? null
    } catch (error) {
        console.error(`store:secure-get error for key "${key}"`, error)
        return def ?? null
    }
})

safeHandle('store:secure-delete', async (_event, key) => {
    if (!isValidStoreKey(key)) {
        console.warn(`[store] Blocked store:secure-delete for disallowed key "${key}"`)
        return { success: false, error: 'Disallowed key' }
    }
    try {
        store.delete(key)
        return { success: true }
    } catch (error) {
        console.error(`store:secure-delete error for key "${key}"`, error)
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