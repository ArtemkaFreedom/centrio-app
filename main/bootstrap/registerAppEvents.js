const { shell, session } = require('electron')
const { fileURLToPath } = require('url')
const path = require('path')
const tracker = require('../services/tracker')
const store = require('../services/store')
const { getWebviewPreloadPath } = require('../ipc/api')
const { wireSessionDownloads } = require('../ipc/downloads')

// Normalizes a preload value (file:// URL or plain path, as seen in either
// webPreferences.preload or our own getWebviewPreloadPath() output) down to a
// comparable absolute filesystem path. Comparing normalized paths instead of
// raw strings avoids false-positive blocks from harmless formatting
// differences (URL-encoding, drive-letter case on Windows, trailing slash)
// between what we generated and what Electron reports back.
function normalizePreloadPath(value) {
    if (typeof value !== 'string' || !value) return null
    try {
        const p = value.startsWith('file://') ? fileURLToPath(value) : value
        return path.resolve(p).toLowerCase()
    } catch {
        return null
    }
}

let log
try { log = require('electron-log') } catch { log = console }

// ── Детект непрочитанных ────────────────────────────────────────────────────
// BUGFIX ("бейджи непрочитанных не появляются"): изначально это делалось из
// webview-preload.js (атрибут preload у <webview>). Диагностика подтвердила,
// что этот механизм на текущей версии Electron (39.x) для <webview> тегов не
// исполняется вообще — ни console.log, ни созданный им DOM-узел ни разу не
// появились на гостевой странице, хотя will-attach-webview репортит
// preloadOk:true с верным путём к файлу. contents.executeJavaScript() на
// dom-ready — подтверждённо рабочий альтернативный канал инъекции (тот же
// тест с видимым DOM-маркером сработал через него сразу) — поэтому детект
// строится на нём: реального Node/ipcRenderer в этом мире нет (contextIsolation
// не даёт), поэтому просто вычисляем число и забираем его через возвращаемое
// значение промиса, без событий изнутри страницы.
const UNREAD_DETECT_SCRIPT = `(function() {
    function parsePositiveInt(v) {
        if (v == null) return null
        var t = String(v).trim()
        if (!t) return null
        var m = t.match(/\\d+/)
        if (!m) return null
        var n = parseInt(m[0], 10)
        if (!isFinite(n) || n < 0 || n >= 10000) return null
        return n
    }
    function isVisible(el) {
        if (!el) return false
        var s = window.getComputedStyle(el)
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false
        var r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
    }
    function fromTitle(title) {
        if (!title) return null
        var m = title.match(/^\\((\\d+)\\)\\s*/); if (m) return parseInt(m[1], 10) || 0
        m = title.match(/\\((\\d+)\\)\\s*$/); if (m) return parseInt(m[1], 10) || 0
        m = title.match(/^(\\d+)\\b/); if (m) return parseInt(m[1], 10) || 0
        m = title.match(/(\\d+)\\s+unread/i); if (m) return parseInt(m[1], 10) || 0
        return null
    }
    function scanSelectors(selectors) {
        for (var i = 0; i < selectors.length; i++) {
            var els
            try { els = document.querySelectorAll(selectors[i]) } catch (e) { continue }
            for (var j = 0; j < els.length; j++) {
                var el = els[j]
                if (!isVisible(el)) continue
                var ariaNum = parsePositiveInt(el.getAttribute('aria-label'))
                if (typeof ariaNum === 'number' && ariaNum > 0) return ariaNum
                var text = (el.textContent || '').trim()
                if (text.length > 6) continue
                var num = parsePositiveInt(text)
                if (typeof num === 'number' && num > 0) return num
            }
        }
        return null
    }
    var hostname = location.hostname || ''
    var titleCount = fromTitle(document.title || '')
    var selectors = hostname.indexOf('telegram') !== -1
        ? ['[aria-label*="unread" i]', '.ListItem-badge', '.badge', '.Badge', '.counter', '.Counter', '[class*="unread" i]', '[class*="badge" i]', '[data-testid*="unread" i]', '[data-testid*="badge" i]']
        : ['.unread-count', '.badge-counter', '.chat-unread-count', '.conversations-badge', '[aria-label*="unread" i]', '[class*="unread" i]', '[class*="badge-count" i]', '[class*="unreadcount" i]', '[data-testid*="unread" i]', '[data-testid*="badge" i]']
    var domCount = scanSelectors(selectors)
    if (typeof titleCount === 'number' && titleCount > 0) return titleCount
    if (typeof domCount === 'number' && domCount > 0) return domCount
    return 0
})()`

const UNREAD_POLL_MS = 5000

function findMessengerIdForSession(targetSession) {
    try {
        const messengers = store.get('messengers', []) || []
        for (const m of messengers) {
            if (m && m.id && session.fromPartition(`persist:${m.id}`) === targetSession) return m.id
        }
    } catch {}
    return null
}

function startUnreadPolling(contents, getMainWindow) {
    const messengerId = findMessengerIdForSession(contents.session)
    if (!messengerId) return

    let lastSent = -1
    const sendIfChanged = (count) => {
        const n = Number.isFinite(count) && count >= 0 ? count : 0
        if (n === lastSent) return
        lastSent = n
        const win = getMainWindow()
        if (win && !win.isDestroyed()) win.webContents.send('messenger-unread-count', messengerId, n)
    }
    const poll = () => {
        if (contents.isDestroyed()) return
        contents.executeJavaScript(UNREAD_DETECT_SCRIPT).then(sendIfChanged).catch(() => {})
    }

    poll()
    const timer = setInterval(poll, UNREAD_POLL_MS)
    contents.once('destroyed', () => clearInterval(timer))
}

function registerAppEvents({
    app,
    getMainWindow,
    showMainWindow,
    createWindow,
    unregisterShortcuts,
    handleProtocolUrl,
    isQuittingRef
}) {
    app.on('browser-window-created', (_e, win) => {
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                shell.openExternal(url).catch(() => {})
            }
            return { action: 'deny' }
        })
    })

    // SECURITY: validate every <webview> attachment before Electron creates the
    // guest process. Without this, a compromised/exploited main-window renderer
    // (XSS, supply-chain bug in a bundled dep, etc.) could attach a webview with
    // attacker-controlled webPreferences (e.g. nodeIntegration:true or a
    // malicious preload script) or point it at an arbitrary session partition
    // (e.g. another messenger's persisted cookies), since the renderer builds
    // <webview> elements itself via DOM APIs (renderer/messengers.js,
    // renderer/webview-tabs-bind.js) and the host process otherwise trusts
    // whatever attributes it declared. This is the standard Electron mitigation
    // (see Electron security checklist §12, "verify webview options before
    // creation") and was previously missing entirely. Every legitimate webview
    // in this app uses partition `persist:<messenger.id>` for a messenger that
    // actually exists in the store and the app's own webview-preload.js — both
    // are cheap to check here and let us fail closed (deny attachment) on any
    // mismatch instead of guessing.
    app.on('web-contents-created', (_e, contents) => {
        // Каждый мессенджер живёт в своей персистентной сессии
        // (persist:<messenger.id>), поэтому 'will-download' нужно подключать
        // отдельно к сессии каждого webview — сессия главного окна не видит
        // загрузки, инициированные внутри мессенджеров (файлы из чатов и т.д.)
        if (contents.getType() === 'webview') {
            try { wireSessionDownloads(contents.session, getMainWindow) } catch (err) {
                log.error('[downloads] failed to wire webview session:', err.message)
            }

            // Непрочитанные сообщения — детект через executeJavaScript on
            // dom-ready (см. startUnreadPolling выше), не через preload:
            // preload-атрибут <webview> подтверждённо не исполняется на этой
            // версии Electron (диагностика: ни console.log, ни созданный им
            // DOM-узел ни разу не появились на гостевой странице, хотя
            // will-attach-webview ниже репортит верный путь к файлу),
            // executeJavaScript — подтверждённо рабочая альтернатива. dom-ready
            // может сработать повторно при перезагрузке страницы — не
            // запускаем второй параллельный интервал поверх уже идущего.
            let unreadPollingStarted = false
            contents.on('dom-ready', () => {
                if (unreadPollingStarted) return
                unreadPollingStarted = true
                startUnreadPolling(contents, getMainWindow)
            })
        }

        contents.on('will-attach-webview', (event, webPreferences, params) => {
            try {
                const partition = params.partition || webPreferences.partition || ''
                const messengers = store.get('messengers', []) || []
                const isKnownPartition = messengers.some((m) => m && m.id && `persist:${m.id}` === partition)

                let expectedPreload = null
                try { expectedPreload = getWebviewPreloadPath() } catch (err) {
                    log.error('[security] will-attach-webview: failed to resolve expected preload path:', err.message)
                }

                const normalizedExpected = normalizePreloadPath(expectedPreload)
                const normalizedActual = normalizePreloadPath(webPreferences.preload)
                const preloadOk = !!normalizedExpected && normalizedExpected === normalizedActual

                if (!isKnownPartition || !preloadOk) {
                    log.warn('[security] will-attach-webview blocked — unexpected partition or preload', {
                        partition,
                        preload: webPreferences.preload
                    })
                    event.preventDefault()
                    return
                }

                // Re-assert safe defaults regardless of what the guest page/DOM declared.
                webPreferences.nodeIntegration = false
                webPreferences.nodeIntegrationInSubFrames = false
                webPreferences.contextIsolation = true
                webPreferences.preload = expectedPreload
            } catch (err) {
                log.error('[security] will-attach-webview validation error, denying attach:', err.message)
                event.preventDefault()
            }
        })
    })

    app.on('open-url', (event, url) => {
        event.preventDefault()
        handleProtocolUrl(url, getMainWindow, showMainWindow)
    })

    app.on('before-quit', (event) => {
        if (isQuittingRef._flushed) return
        event.preventDefault()
        isQuittingRef._flushed = true
        isQuittingRef.value = true
        tracker.stop()

        // tracker.flush() makes a network call (see api.js/trackStats) that,
        // before this fix, had no timeout anywhere in the chain — a stalled
        // connection (dead network, VPN torn down mid-quit) meant `before-quit`
        // could hang forever and the app would never actually exit. Race it
        // against a hard deadline so quitting is never blocked on the network.
        const FLUSH_DEADLINE_MS = 4000
        const deadline = new Promise((resolve) => setTimeout(resolve, FLUSH_DEADLINE_MS))

        Promise.race([tracker.flush().catch(() => {}), deadline])
            .finally(() => app.quit())
    })

    app.on('will-quit', () => { unregisterShortcuts() })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit()
    })

    app.on('activate', () => {
        const win = getMainWindow()
        if (!win || win.isDestroyed()) createWindow()
        else showMainWindow()
    })
}

module.exports = registerAppEvents
