const { ipcMain, shell, app, BrowserWindow, session, powerMonitor } = require('electron')
const pinHash = require('../services/pinHash')

let log
try { log = require('electron-log') } catch { log = console }

function safeOn(channel, listener) {
    ipcMain.removeAllListeners(channel)
    ipcMain.on(channel, listener)
}

function safeHandle(channel, handler) {
    try {
        ipcMain.removeHandler(channel)
    } catch {}
    ipcMain.handle(channel, handler)
}

// BUGFIX (security regression): both call sites below used to do
// `const { isPasswordEnabled } = require('../services/store')` — but
// main/services/store.js only exports the raw electron-store instance, it has
// no `isPasswordEnabled` export. That destructure silently evaluated to
// `undefined`, so `isPasswordEnabled()` threw a TypeError inside an
// ipcMain.on handler every time a user with "lock on minimize/hide" enabled
// actually minimized or hid the window — meaning the lock screen never
// appeared for them at all. Mirrors the equivalent (working) check in
// renderer/lock.js's own isPasswordEnabled().
function isPasswordEnabled(security) {
    return security?.enabled === true && !!security?.hash
}

function registerWindowIpc({ getMainWindow, isQuittingRef }) {
    const store = require('../services/store')
    // expose getMainWindow for popup-window handler
    const _getMainWindow = getMainWindow
    safeOn('minimize-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) {
            win.minimize()

            // Check for lock on minimize
            const settings = store.get('settings', {})
            const security = store.get('security', {})

            if ((settings.lockOnHide || security.lockOnHide) && isPasswordEnabled(security)) {
                win.webContents.send('show-lock-screen')
            }
        }
    })

    safeOn('maximize-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (!win || win.isDestroyed()) return

        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
    })

    safeOn('close-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) win.close()
    })

    safeOn('quit-app', (_event, relaunch = false) => {
        isQuittingRef.value = true
        if (relaunch) app.relaunch()
        app.quit()
    })

    safeOn('hide-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) {
            win.hide()

            // Check for lock on hide (tray behavior)
            const settings = store.get('settings', {})
            const security = store.get('security', {})

            if ((settings.lockOnHide || security.lockOnHide) && isPasswordEnabled(security)) {
                win.webContents.send('show-lock-screen')
            }
        }
    })

    safeOn('toggle-fullscreen', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) {
            win.setFullScreen(!win.isFullScreen())
        }
    })

    safeOn('set-app-zoom', (event, level) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (!win || win.isDestroyed()) return

        const zoomLevel = Number(level)
        if (!Number.isFinite(zoomLevel)) return
        // Clamp to a safe range: Electron allows -8 to 8, we restrict further
        const clamped = Math.max(-3, Math.min(3, zoomLevel))
        win.webContents.setZoomLevel(clamped)
    })

    safeOn('open-url', async (_event, url) => {
        if (!url || typeof url !== 'string') return

        // Only allow safe external protocols.
        // 'tg:' added for the deep-link fallback path (renderer/messengers.js,
        // webview-preload.js): when a user clicks a tg://resolve?domain=...
        // link and no Telegram tab is open in-app, we hand off to whatever the
        // OS has registered for tg:// (mirrors normal browser behavior) instead
        // of silently dropping it. Still an explicit allowlist entry, not a
        // wildcard — every other scheme remains blocked exactly as before.
        const ALLOWED_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:', 'tg:']
        try {
            const parsed = new URL(url)
            if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
                console.warn('[security] open-url blocked — disallowed scheme:', parsed.protocol, url)
                return
            }
        } catch {
            console.warn('[security] open-url blocked — invalid URL:', url)
            return
        }

        try {
            await shell.openExternal(url)
        } catch (error) {
            console.error('open-url error:', error)
        }
    })

    safeHandle('open-popup-window', async (_event, url, opts = {}) => {
        try {
            const w = opts.width  || 400
            const h = opts.height || 600

            const mainWin = _getMainWindow()
            let x, y
            if (mainWin && !mainWin.isDestroyed()) {
                const [mx, my] = mainWin.getPosition()
                const [mw, mh] = mainWin.getSize()
                x = mx + mw - w - 20
                y = my + mh - h - 60
            }

            // Расширения (напр. Translate popup) грузятся в per-messenger сессию
            // (persist:<messengerId>), см. main/services/extensions.js. Без явного
            // указания той же session partition popup открылся бы в defaultSession —
            // расширение там не загружено, chrome.tabs не увидит webview мессенджера.
            // Разрешаем кастомную session ТОЛЬКО для partition реально существующего
            // мессенджера — иначе игнорируем opts.partition, чтобы этот generic-канал
            // нельзя было использовать для открытия произвольного URL в произвольной
            // persisted-сессии.
            //
            // BUGFIX (item #1 — popups falling through to the external browser):
            // this partition-sharing used to be gated on `url.startsWith('chrome-extension://')`,
            // so any regular http(s) window.open() from a messenger webview (call/
            // meeting windows, share dialogs, "sign in with X" popups, ...) never
            // qualified and fell through to shell.openExternal() in a logged-out
            // default browser profile instead. The scheme check added no real
            // security value on its own (the partition allowlist below is what
            // actually prevents session hijacking) — dropped it so any URL can
            // share a *known* messenger's own partition.
            const webPreferences = {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            }

            let isSharedMessengerSession = false
            if (typeof opts.partition === 'string') {
                const messengers = store.get('messengers', []) || []
                const isKnownPartition = messengers.some((m) => m && m.id && `persist:${m.id}` === opts.partition)
                if (isKnownPartition) {
                    webPreferences.session = session.fromPartition(opts.partition)
                    isSharedMessengerSession = true
                }
            }

            // ── OAuth broker mode (item #6, renderer/webview-tabs-bind.js) ──
            // Google (and most other providers) refuse to complete sign-in
            // inside an Electron <webview> guest page — it gets detected as
            // an embedded browser and rejected outright ("This browser or
            // app may not be secure"), which is why "Sign in with Google"
            // clicked inside a messenger webview used to just hang. A real
            // popup BrowserWindow sharing the messenger's session (see
            // isSharedMessengerSession above) passes that detection as long
            // as it also presents a normal desktop Chrome UA. opts.returnHost
            // is validated as a bare hostname — it is only ever compared
            // against navigation targets below, never used to build a URL or
            // navigate anywhere itself.
            const isOAuthBroker = isSharedMessengerSession &&
                typeof opts.returnHost === 'string' &&
                /^[a-z0-9.-]+$/i.test(opts.returnHost)

            const popup = new BrowserWindow({
                width: w, height: h, x, y,
                title: opts.name || 'Centrio',
                resizable: true, minimizable: false, maximizable: false,
                alwaysOnTop: true, skipTaskbar: true, show: false,
                webPreferences
            })

            popup.setMenuBarVisibility(false)

            if (isOAuthBroker) {
                // Same UA the messenger webviews themselves send (see
                // renderer/webview-tabs-bind.js addWebview) — the default
                // Electron popup UA alone is enough to trip some providers'
                // embedded-browser detection.
                popup.webContents.setUserAgent(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                )
            }

            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (isOAuthBroker) return { action: 'deny' } // no nested popups needed for an OAuth flow
                if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
                    shell.openExternal(newUrl).catch(() => {})
                }
                return { action: 'deny' }
            })

            // Once the provider's flow redirects back to the messenger's own
            // origin (opts.returnHost), the OAuth broker's job is done: close
            // the popup and tell the renderer so it can reload the messenger
            // tab and pick up the session that just got authenticated.
            const maybeFinishOAuth = (navUrl) => {
                if (!isOAuthBroker) return false
                try {
                    const { hostname } = new URL(navUrl)
                    if (hostname !== opts.returnHost && !hostname.endsWith(`.${opts.returnHost}`)) return false
                } catch {
                    return false
                }

                if (mainWin && !mainWin.isDestroyed()) {
                    mainWin.webContents.send('oauth-popup-done', { partition: opts.partition })
                }
                if (!popup.isDestroyed()) popup.close()
                return true
            }

            popup.webContents.on('will-navigate', (event, navUrl) => {
                if (isOAuthBroker) {
                    // Unlike the plain-popup branch below, an OAuth flow
                    // legitimately needs multiple full navigations (consent
                    // screens, 2FA, callback redirects) to complete —
                    // preventDefault()-ing all of them (like the branch below
                    // always did) is what made this broker dead on arrival
                    // before. Only step in once navigation reaches the return
                    // host.
                    //
                    // SECURITY (defense-in-depth, per review): still block
                    // navigation to any non-http(s) scheme. Nothing in a
                    // legitimate OAuth redirect chain needs file:/chrome:/
                    // other privileged schemes, and this popup otherwise has
                    // no app-level scheme guard of its own (unlike normal
                    // BrowserWindow creation, which only restricts window.open
                    // targets, not in-place navigation).
                    if (!navUrl.startsWith('http://') && !navUrl.startsWith('https://')) {
                        event.preventDefault()
                        return
                    }
                    maybeFinishOAuth(navUrl)
                    return
                }

                if (navUrl.startsWith('about:')) return
                event.preventDefault()
                if (navUrl.startsWith('http://') || navUrl.startsWith('https://')) {
                    shell.openExternal(navUrl).catch(() => {})
                }
            })

            if (isOAuthBroker) {
                // Some providers finish via a client-side redirect
                // (history.replaceState/location.hash) once already back on
                // their own origin, rather than a full navigation — both
                // need the same completion check.
                popup.webContents.on('did-navigate', (_event, navUrl) => maybeFinishOAuth(navUrl))
                popup.webContents.on('did-navigate-in-page', (_event, navUrl) => maybeFinishOAuth(navUrl))
            }

            popup.once('ready-to-show', () => {
                popup.show()
                popup.focus()
            })

            popup.loadURL(url)
                .catch(e => log.error('[popup] loadURL failed:', e.message))

            return { success: true }
        } catch (e) {
            log.error('[popup] error:', e.message)
            return { success: false, error: e.message }
        }
    })

    safeOn('open-translate-window', (_event, text) => {
        try {
            const url = `https://translate.google.com/?sl=auto&tl=ru&text=${encodeURIComponent(text || '')}&op=translate`
            const mainWin = _getMainWindow()
            let x, y
            if (mainWin && !mainWin.isDestroyed()) {
                const [mx, my] = mainWin.getPosition()
                const [mw, mh] = mainWin.getSize()
                x = mx + Math.floor((mw - 800) / 2)
                y = my + Math.floor((mh - 600) / 2)
            }
            const popup = new BrowserWindow({
                width: 800, height: 600, x, y,
                title: 'Translate',
                resizable: true, minimizable: true, maximizable: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    // SECURITY: sandbox wasn't set here (unlike the equivalent
                    // open-popup-window handler above), leaving this renderer
                    // running without Chromium's OS-level sandbox for no reason —
                    // translate.google.com needs no Node/Electron API access.
                    sandbox: true,
                    partition: 'persist:translate'
                }
            })
            popup.setMenuBarVisibility(false)
            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (newUrl.startsWith('https://translate.google')) return { action: 'allow' }
                shell.openExternal(newUrl).catch(() => {})
                return { action: 'deny' }
            })
            popup.loadURL(url).catch(e => log.error('[translate] loadURL failed:', e.message))
        } catch (e) {
            log.error('[translate] error:', e.message)
        }
    })

    safeHandle('get-window-visibility-state', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()

        if (!win || win.isDestroyed()) {
            return {
                visible: false,
                focused: false,
                minimized: false
            }
        }

        return {
            visible: win.isVisible(),
            focused: win.isFocused(),
            minimized: win.isMinimized()
        }
    })

    safeHandle('app:getVersion', () => {
        return app.getVersion()
    })

    // ── Screen-lock PIN hashing (see main/services/pinHash.js) ─────────────
    // Done here in the main process, not in the renderer, because the
    // renderer runs with nodeIntegration:false + contextIsolation:true and
    // has no way to reach Node's `crypto` module (scryptSync) for a real KDF.
    // The renderer only ever handles the plaintext PIN transiently in memory
    // during entry — it never computes or stores the hash itself.
    safeHandle('security:hash-pin', (_event, pin) => {
        if (typeof pin !== 'string' || pin.length === 0) {
            throw new Error('Invalid PIN')
        }
        return pinHash.hashPin(pin)
    })

    // Verifies a PIN against store.get('security').hash. Transparently
    // migrates old-format (pre-scrypt) hashes to the new format on a
    // successful match — see verifyPin()'s `needsMigration` contract in
    // pinHash.js. Never throws on a wrong PIN; returns { valid: false }.
    safeHandle('security:verify-pin', (_event, pin) => {
        if (typeof pin !== 'string' || pin.length === 0) return { valid: false }

        const security = store.get('security', {}) || {}
        const result = pinHash.verifyPin(pin, security.hash)

        if (result.valid && result.needsMigration) {
            try {
                store.set('security', { ...security, hash: pinHash.hashPin(pin) })
            } catch (e) {
                log.error('[security] PIN hash migration failed:', e.message)
            }
        }

        return { valid: result.valid }
    })

    // ── Автоблокировка при бездействии ────────────────────────────────────
    // Используем powerMonitor.getSystemIdleTime() — это OS-level счётчик
    // (секунды с последнего ввода мыши/клавиатуры во всей системе), а не
    // DOM-события в renderer. Это принципиально важно: активность ВНУТРИ
    // <webview> (переписка в мессенджере) не долетает до host-документа
    // как обычное DOM-событие (webview — изолированный гостевой процесс),
    // поэтому слушать mousemove/keydown на renderer document давало бы
    // ложные блокировки прямо во время набора сообщения. OS-level idle
    // time не имеет этой проблемы — он видит ввод независимо от того,
    // какой процесс/фрейм принял фокус.
    let lastIdleLockSentAt = 0
    setInterval(() => {
        try {
            const security = store.get('security', {}) || {}
            const minutes = Number(security.lockOnIdleMinutes) || 0
            if (minutes <= 0) return
            if (!security.enabled || !security.hash) return

            const win = getMainWindow()
            if (!win || win.isDestroyed()) return

            const idleSeconds = powerMonitor.getSystemIdleTime()
            if (idleSeconds < minutes * 60) return

            // Не спамим show-lock-screen чаще раза в минуту — пока пользователь
            // не пошевелит мышью, idleSeconds продолжит расти и мы будем сюда
            // попадать на каждом тике интервала.
            const now = Date.now()
            if (now - lastIdleLockSentAt < 60000) return
            lastIdleLockSentAt = now

            win.webContents.send('show-lock-screen')
        } catch (e) {
            log.error('[idle-lock] check failed:', e.message)
        }
    }, 20000)
}

module.exports = registerWindowIpc