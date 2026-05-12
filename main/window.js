const fs   = require('fs')
const path = require('path')
const store = require('./services/store')
const { clearBadges } = require('./services/badge')
const { PATHS, IPC_CHANNELS } = require('./config/constants')
const { isWindowAlive, safeSendToWindow } = require('./utils/window')
const { createMainBrowserWindow } = require('./factory/browserWindow')

async function _tryRestoreVpn(win) {
    try {
        const { session } = require('electron')
        const fs2 = require('fs')
        const vpn  = require('./services/store')
        const link = vpn.get('vpnActiveLink', null)
        if (!link) return

        const vpnMgr = require('../vpn-manager')
        const st = vpnMgr.getStatus()
        if (st.active) return  // уже подключён

        const binPath = vpnMgr.getSingboxPath()
        if (!fs2.existsSync(binPath)) return

        if (link.startsWith('http://') || link.startsWith('https://')) return  // подписки не восстанавливаем

        let parsed
        try { parsed = vpnMgr.parseVpnLink(link) } catch { return }

        console.info('[VPN] auto-restore: starting sing-box...')
        await vpnMgr.startProxy(parsed, (line) => {
            if (win && !win.isDestroyed()) win.webContents.send('vpn-log', line)
        })

        // Применяем прокси — теперь все сессии уже инициализированы
        const { applyProxyToSession } = require('./services/proxy')
        const store2 = require('./services/store')
        const messengers = store2.get('messengers', [])
        const modes = store2.get('vpnAppModes', {}) || {}
        const proxyOn = { enabled: true, type: 'socks5', host: '127.0.0.1', port: vpnMgr.PROXY_PORT }

        await applyProxyToSession(session.defaultSession, proxyOn)
        for (const m of messengers) {
            if (!m || !m.id) continue
            try {
                const enabled = modes[m.id] !== false
                const settings = enabled ? proxyOn : { enabled: false }
                const ses = session.fromPartition(`persist:${m.id}`)
                await applyProxyToSession(ses, settings)
            } catch (e) {
                console.warn('[VPN] auto-restore proxy apply error:', e.message)
            }
        }

        console.info('[VPN] auto-restore: done, proxy applied')

        // Уведомляем рендерер
        if (win && !win.isDestroyed()) {
            win.webContents.send('vpn-restored', vpnMgr.getStatus())
        }
    } catch (e) {
        console.warn('[VPN] auto-restore failed:', e.message)
        try {
            const store3 = require('./services/store')
            store3.set('vpnActiveLink', null)
        } catch {}
    }
}

function _appendCrashLog(label, detail) {
    try {
        const { app } = require('electron')
        const logDir  = app.getPath('userData')
        const logFile = path.join(logDir, 'crash.log')
        const line    = `[${new Date().toISOString()}] ${label}: ${JSON.stringify(detail)}\n`
        fs.appendFileSync(logFile, line, 'utf8')
    } catch {}
}

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
    let _lastCrashTime = 0
    let _crashCount = 0

    win.webContents.on('did-finish-load', () => {
        _crashCount = 0
        injectAppLogo(win)
        // VPN авто-восстановление — запускаем через 3 сек после загрузки окна
        // (когда вебвью и сессии уже инициализированы)
        setTimeout(() => _tryRestoreVpn(win), 3000)
    })

    win.webContents.on('render-process-gone', (_event, details) => {
        console.error('[window] render-process-gone:', details)
        _appendCrashLog('render-process-gone', details)

        if (details.reason === 'clean-exit') return

        const now = Date.now()
        const sinceLastCrash = now - _lastCrashTime
        _lastCrashTime = now
        _crashCount++

        if (_crashCount > 5) {
            console.error('[window] crash loop detected — stopping auto-reload')
            _appendCrashLog('crash-loop-stopped', { count: _crashCount })
            return
        }

        // Если крашей много подряд быстро — ждём дольше
        const delay = sinceLastCrash < 3000 ? 5000 : 1500

        console.warn(`[window] renderer crashed (${details.reason}), attempt ${_crashCount}, reload in ${delay}ms`)

        setTimeout(() => {
            if (!win.isDestroyed()) {
                // reload() не работает после render-process-gone в Electron 36 — используем loadFile
                win.loadFile(PATHS.INDEX_HTML).catch(e => {
                    console.error('[window] loadFile after crash failed:', e)
                })
            }
        }, delay)
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

    // Prevent GPU frame throttling (fixes "black webview, mouse sees content" issue
    // that can occur when Windows marks the window as occluded).
    try { win.webContents.setBackgroundThrottling(false) } catch {}

    win.on('focus', () => {
        clearBadges(getMainWindow)
        // Force GPU compositor to present frames immediately on focus —
        // guards against the CalculateNativeWinOcclusion stale-frame bug.
        try { win.webContents.invalidate() } catch {}
    })

    win.on('show', () => {
        try { win.webContents.invalidate() } catch {}
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