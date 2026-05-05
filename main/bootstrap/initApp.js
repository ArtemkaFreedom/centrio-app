const { registerShortcuts } = require('../services/shortcuts')
const { initUpdater, checkForUpdates } = require('../services/updater')
const { loadSavedOnStart: loadExtensions } = require('../services/extensions')
const { APP_PROTOCOL } = require('../config/constants')
const tracker        = require('../services/tracker')
const visitorTracker = require('../services/visitor-tracker')

function initApp({
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
}) {
    const singleInstanceOk = initSingleInstance({
        getMainWindow,
        showMainWindow,
        handleProtocolUrl
    })

    if (!singleInstanceOk) {
        return false
    }

    registerProtocol()

    app.whenReady().then(() => {
        createWindow()
        createTray()

        registerIpc({
            getMainWindow,
            showMainWindow,
            updateTrayMenu,
            isQuittingRef
        })

        // ── Start usage tracker ───────────────────────────────────
        tracker.start()
        const win = getMainWindow()
        if (win && !win.isDestroyed()) {
            win.on('focus', () => tracker.onFocus())
            win.on('blur',  () => tracker.onBlur())
        }

        // ── Start visitor tracker (anonymous users only) ──────────
        visitorTracker.start()

        initUpdater(getMainWindow)
        loadExtensions().catch(e => console.warn('[extensions] startup load error:', e.message))

        // ── Первая проверка через 10–20 сек после старта ─────────
        const delay = Math.floor(Math.random() * 10000) + 10000
        setTimeout(() => {
            checkForUpdates().catch((err) => {
                console.error('[initApp] Auto update check failed:', err)
            })
        }, delay)

        // ── Повторная проверка каждые 12 часов ───────────────────
        const TWELVE_HOURS = 12 * 60 * 60 * 1000
        setInterval(() => {
            checkForUpdates().catch((err) => {
                console.error('[initApp] Periodic update check failed:', err)
            })
        }, TWELVE_HOURS)

        registerShortcuts({ getMainWindow, showMainWindow })

        if (process.platform === 'win32') {
            const protocolPrefix = `${APP_PROTOCOL}://`
            const deeplink = process.argv.find(
                (arg) => typeof arg === 'string' && arg.startsWith(protocolPrefix)
            )

            if (deeplink) {
                setTimeout(() => {
                    handleProtocolUrl(deeplink, getMainWindow, showMainWindow)
                }, 1000)
            }
        }
    })

    return true
}

module.exports = initApp