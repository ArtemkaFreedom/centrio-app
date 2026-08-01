const { ipcMain, shell, app, BrowserWindow, session, powerMonitor } = require('electron')

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

function registerWindowIpc({ getMainWindow, isQuittingRef }) {
    const store = require('../services/store')
    // expose getMainWindow for popup-window handler
    const _getMainWindow = getMainWindow
    safeOn('minimize-window', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender) || getMainWindow()
        if (win && !win.isDestroyed()) {
            win.minimize()

            // Check for lock on minimize
            const { isPasswordEnabled } = require('../services/store')
            const settings = store.get('settings', {})
            const security = store.get('security', {})

            if ((settings.lockOnHide || security.lockOnHide) && isPasswordEnabled()) {
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
            const { isPasswordEnabled } = require('../services/store')
            const settings = store.get('settings', {})
            const security = store.get('security', {})

            if ((settings.lockOnHide || security.lockOnHide) && isPasswordEnabled()) {
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

        // Only allow safe external protocols
        const ALLOWED_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:']
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
            // Разрешаем кастомную session ТОЛЬКО для chrome-extension:// URL и только
            // для partition реально существующего мессенджера — иначе игнорируем opts.partition,
            // чтобы этот generic-канал нельзя было использовать для открытия произвольного
            // URL в произвольной persisted-сессии.
            const webPreferences = {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true
            }

            if (typeof url === 'string' && url.startsWith('chrome-extension://') && typeof opts.partition === 'string') {
                const messengers = store.get('messengers', []) || []
                const isKnownPartition = messengers.some((m) => m && m.id && `persist:${m.id}` === opts.partition)
                if (isKnownPartition) {
                    webPreferences.session = session.fromPartition(opts.partition)
                }
            }

            const popup = new BrowserWindow({
                width: w, height: h, x, y,
                title: opts.name || 'Centrio',
                resizable: true, minimizable: false, maximizable: false,
                alwaysOnTop: true, skipTaskbar: true, show: false,
                webPreferences
            })

            popup.setMenuBarVisibility(false)

            popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
                if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
                    shell.openExternal(newUrl).catch(() => {})
                }
                return { action: 'deny' }
            })

            popup.webContents.on('will-navigate', (event, navUrl) => {
                if (navUrl.startsWith('about:')) return
                event.preventDefault()
                if (navUrl.startsWith('http://') || navUrl.startsWith('https://')) {
                    shell.openExternal(navUrl).catch(() => {})
                }
            })

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