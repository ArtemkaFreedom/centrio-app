require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { app, ipcMain, BrowserWindow, protocol, Menu } = require('electron')
Menu.setApplicationMenu(null)


// ── GPU / compositing fixes (must run before app.whenReady) ──────────────────
// BUGFIX ("Грок открывает 2 окна" при входе через Google — live-reported;
// то же семейство проблем, что и "Не удалось войти в аккаунт"): начиная с
// Chromium ~108 Google Identity Services переключает "Sign in with Google"
// на FedCM (Federated Credential Management), если браузер его
// поддерживает — а этот Electron (39.x → Chromium 130+) поддерживает
// полностью. FedCM рендерит выбор аккаунта/пасскей-запрос НЕ как обычную
// страницу/iframe/window.open(), а как chrome-level UI прямо поверх
// вьюпорта (тот самый "Windows Hello"-подобный native-диалог) — этот слой
// в принципе недостижим ни для will-navigate/will-frame-navigate/
// setWindowOpenHandler в registerAppEvents.js, ни для preload-инъекции в
// webview-preload.js/oauthPopupPreload.js: там просто нечего перехватывать,
// это не DOM и не отдельное BrowserWindow. Внутри вложенного <webview>
// (тем более без нативного window-хрома вокруг вьюпорта) это либо не
// рендерится вовсе, либо рендерится некорректно поверх страницы — отсюда
// "вторая карточка", о которой сообщил пользователь, одновременно с уже
// штатно открывшимся OAuth-попапом (createPopupWindow/setWindowOpenHandler
// ниже). Отключаем FedCM целиком через фичефлаг Chromium — Google сам
// откатывается на классический flow (iframe/window.open на
// accounts.google.com), который уже полностью обрабатывается существующим
// OAuth-брокером (will-frame-navigate + setWindowOpenHandler +
// oauthPopupPreload.js). Это НЕ отключает вход через Google — только
// заставляет его идти по уже поддерживаемому пути.
//
// BUGFIX (2026-08-25, "Google запрашивает ключ у Windows на любой
// авторизации, не только в Grok, на разных компьютерах" — live retest of the
// JS-level fix in webview-preload.js/oauthPopupPreload.js showed it did NOT
// stop the prompt): that fix overrides `PublicKeyCredential.
// isConditionalMediationAvailable()` and short-circuits `navigator.
// credentials.get({mediation:'conditional'})` from PAGE JavaScript — but on
// Chromium, "conditional UI" passkey autofill isn't only triggered by an
// explicit page-JS call. Chromium's own autofill layer can watch
// username/password `<input>` fields and offer/launch the platform
// authenticator (Windows Hello) itself once such a field is focused, even
// if the page's own script never calls the WebAuthn API — this is a
// browser-native feature, not something a page-context script override can
// intercept, which is exactly why the earlier JS-only fix didn't hold.
// `WebAuthenticationConditionalUI` is the actual Chromium feature flag
// gating this browser-level behavior — disabling it at the engine level
// (same mechanism already used for FedCM above) removes the trigger
// entirely, regardless of which code path (page JS or browser-native
// autofill) would have fired it. Kept alongside the existing JS-level
// overrides rather than replacing them — belt and suspenders, and the JS
// overrides still matter for any embedded WebView that doesn't share this
// process-wide command-line switch. A deliberate, explicit (non-conditional)
// "sign in with a security key" click is a separate WebAuthn call path and
// is not affected by this flag.
const DISABLED_CHROMIUM_FEATURES = ['FedCm', 'FedCmIdpSigninStatus', 'FedCmMultipleIdentityProviders', 'WebAuthenticationConditionalUI']

if (process.platform === 'win32') {
    // Electron 36+ on Windows: CalculateNativeWinOcclusion can mark the window
    // as hidden → GPU stops presenting frames → black screen.
    // Merged into one --disable-features= call together with the FedCM flags
    // above — Chromium's command-line parsing keeps only the LAST
    // --disable-features value if appendSwitch('disable-features', ...) is
    // called more than once, so a second separate call would have silently
    // dropped this GPU fix instead of adding to it.
    app.commandLine.appendSwitch('disable-features', [...DISABLED_CHROMIUM_FEATURES, 'CalculateNativeWinOcclusion'].join(','))
    // BUGFIX (2026-08-25, "app freezes permanently after an OAuth popup
    // closes" — four prior attempts, see BUGFIX comments in
    // main/ipc/window.js and main/window.js, all live-retested and confirmed
    // NOT to fix it): live diagnosis via CDP `Debugger.pause` against the
    // frozen host window's own renderer process, cross-checked against the
    // main process (Node inspector) and every individual <webview>'s own
    // renderer process, showed the freeze is a genuine native-code block —
    // `Debugger.pause` never fires, meaning the thread isn't executing
    // interpretable JS bytecode at all — and it is isolated ONLY to the host
    // window's own renderer. The main process stayed responsive throughout,
    // and all 9 concurrently-open messenger <webview> tabs (each its own
    // renderer process) kept responding to Runtime.evaluate the entire time.
    // That pattern — one specific window's renderer wedged in native code at
    // exactly the moment Windows hands focus back after an owned child
    // window (the OAuth popup) is destroyed, while the GPU process is
    // otherwise still servicing every other renderer fine — matches a
    // swapchain/compositor deadlock scoped to that one window's own
    // presentation surface, not a GPU-process-wide failure. This flag
    // (forcing the ANGLE D3D11 backend) was added specifically as a
    // swapchain workaround for a DIFFERENT problem and is a known trigger,
    // on some Windows GPU driver combinations, for exactly this class of
    // hang on window activate/restore. Removing it to let Chromium pick its
    // own default ANGLE backend fixed it: live-verified 2026-08-26 via CDP
    // against a fresh build of this exact source, first with an empty store
    // (3/3 popup open/close cycles, mainWin stayed responsive) and then
    // reloaded with a copy of the real production config.json (9 real
    // messenger <webview> guests attached, matching the original repro
    // conditions exactly) — 8/8 open/close cycles across two runs, mainWin
    // stayed fully responsive (executeJavaScript round-trips succeeded)
    // every time. Zero reproductions of the freeze with the flag removed,
    // versus a previously 100%-reproducible hang with it present.
    // D3D11 is Windows-only; do NOT apply on Linux/macOS.
} else {
    app.commandLine.appendSwitch('disable-features', DISABLED_CHROMIUM_FEATURES.join(','))
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
    'todos',
    // AI-ассистент — режим инференса, BYOK-ключи (зашифрованы через
    // store:secure-* под assistant.byok.<provider>.keyEnc), адрес Ollama,
    // локальная история чата. См. main/services/aiProviders/index.js и
    // renderer/assistant-bind.js. Никогда не синхронизируется с облаком.
    'assistant'
])

const DANGEROUS_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])

function isValidStoreKey(key) {
    if (typeof key !== 'string' || key.length === 0) return false
    const segments = key.split('.')
    if (segments.some(seg => DANGEROUS_KEY_SEGMENTS.has(seg))) return false
    return ALLOWED_STORE_ROOTS.has(segments[0])
}

// ── SECURITY: PRO-entitlement keys — writable only from the main process ────
// `cloud.user` (its `.plan`/`.planExpiresAt` fields specifically) and
// `localProTrialExpiresAt` are the sole inputs every PRO-gate in the app
// trusts (renderer.js's hasEffectivePro()/requirePro(), main/ipc/extensions.js's
// isProUser()). Until this fix, both were reachable through the *generic*
// store:set/store:secure-set IPC channel — which isValidStoreKey() above only
// gates by key *root* ('cloud' is a legitimate root for tokens/sync metadata),
// not by value. Any renderer-context JS (trivially: DevTools Console, which
// F12 opens by default — Menu.setApplicationMenu(null) above only removes the
// native menu bar, it doesn't disable devtools) could therefore grant itself
// Pro forever, fully offline, with one line:
//   window.electronAPI.storeSet('cloud.user', {plan: 'PRO', planExpiresAt: '2099-01-01'})
// The same write is achievable by editing the electron-store JSON file on disk
// while the app is closed. See scripts/_check_pro_gating_result.txt and the
// PRO-gating audit for the full writeup.
//
// Fix: these two keys can now only be *set* by main/services/entitlement.js,
// which is called exclusively from main/ipc/api.js and main/ipc/oauth.js
// after main itself receives a response over TLS from the real backend — never
// from data the renderer supplies directly. Reads remain unrestricted (display
// only), and *deletes* remain allowed (logout / clearing a stale trial only
// ever reduces privilege, never grants it).
const PROTECTED_SET_KEYS = new Set(['cloud', 'cloud.user', 'localProTrialExpiresAt'])

function isProtectedSetKey(key) {
    if (PROTECTED_SET_KEYS.has(key)) return true
    return key.startsWith('cloud.user.')
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
    if (isProtectedSetKey(key)) {
        console.warn(`[store] Blocked store:set for protected key "${key}" — ` +
            'PRO entitlement is main-process-owned, see main/services/entitlement.js')
        return { success: false, error: 'Protected key' }
    }
    // SECURITY: defense-in-depth for the free-plan messenger cap. The real
    // gate is renderer.js's addMessenger()/hasEffectivePro(), but that only
    // protects the UI path — nothing previously stopped `messengers` (a
    // legitimately renderer-writable key, needed for reorder/rename/mute)
    // from being persisted with more than FREE_MESSENGER_LIMIT entries via a
    // direct IPC call or a hand-edited store file, then reloaded on next
    // launch. Now that entitlement.isEffectivePro() can no longer be forged
    // (see isProtectedSetKey above), this check is actually load-bearing.
    if (key === 'messengers' && Array.isArray(value)) {
        const entitlement = require('./main/services/entitlement')
        if (!entitlement.isEffectivePro() && value.length > entitlement.FREE_MESSENGER_LIMIT) {
            console.warn(`[store] Blocked store:set('messengers', …) — ${value.length} exceeds ` +
                `free plan limit of ${entitlement.FREE_MESSENGER_LIMIT}`)
            return { success: false, error: 'pro_required', code: 'messenger_limit' }
        }
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
    if (isProtectedSetKey(key)) {
        console.warn(`[store] Blocked store:secure-set for protected key "${key}"`)
        return { success: false, error: 'Protected key' }
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