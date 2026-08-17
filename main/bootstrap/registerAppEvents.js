const { shell, session, ipcMain } = require('electron')
const { fileURLToPath } = require('url')
const path = require('path')
const tracker = require('../services/tracker')
const store = require('../services/store')
const { getWebviewPreloadPath, waitForPendingSyncPush } = require('../ipc/api')
const { wireSessionDownloads } = require('../ipc/downloads')
const { attachServiceWorkerNotifBridge } = require('../services/swNotifPatcher')

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

// ── Детект site-уведомлений (Notification / SW showNotification) ───────────
// Тот же баг, что и с непрочитанными выше: изначально перехват
// window.Notification / ServiceWorkerRegistration.showNotification жил в
// webview-preload.js (patchNotification()), но preload-атрибут <webview>
// подтверждённо не исполняется на этой версии Electron ни для одного
// мессенджера (см. диагностику в комментарии над UNREAD_DETECT_SCRIPT) — это
// был полностью мёртвый код, ни разу не сработавший, отсюда и баг "уведомления
// не появляются в центре уведомлений" даже для настоящих входящих сообщений.
// Чиним тем же рабочим каналом: executeJavaScript на dom-ready. Патчить нужно
// на КАЖДЫЙ dom-ready (не один раз за весь contents), потому что навигация
// внутри <webview> — это новый document/window, и патч (как и window.Notification)
// сбрасывается вместе с ним; сам патч идемпотентен внутри одной страницы через
// флаг window.__centrioNotifPatched. Реального ipcRenderer в этом мире нет
// (contextIsolation), поэтому перехваченные вызовы складываются в очередь
// window.__centrioPendingNotifs и забираются pull-опросом — тем же паттерном,
// что и счётчик непрочитанных.
const NOTIF_PATCH_SCRIPT = `(function() {
    if (window.__centrioNotifPatched) return 'already-patched'
    window.__centrioNotifPatched = true
    window.__centrioPendingNotifs = window.__centrioPendingNotifs || []

    function queue(title, options) {
        try {
            // options.data — многие PWA кладут туда путь/ссылку на конкретный
            // диалог/сообщение (используется в их же 'notificationclick'). Если
            // формат узнаваемый — тащим дальше как кандидат в actionUrl, чтобы
            // клик по записи в центре уведомлений мог открыть именно этот чат,
            // а не просто вкладку мессенджера.
            var rawData = options && options.data
            var url = null
            if (typeof rawData === 'string') url = rawData
            else if (rawData && typeof rawData === 'object') {
                url = rawData.url || rawData.link || rawData.deepLink || rawData.href || null
            }

            window.__centrioPendingNotifs.push({
                title: String(title || ''),
                body: String((options && options.body) || ''),
                tag: String((options && options.tag) || ''),
                icon: (options && options.icon) || '',
                url: url ? String(url) : ''
            })
        } catch (e) {}
    }

    try {
        var OriginalNotification = window.Notification
        if (OriginalNotification) {
            var PatchedNotification = function (title, options) {
                queue(title, options)
                return new OriginalNotification(title, options)
            }
            PatchedNotification.prototype = OriginalNotification.prototype
            try {
                Object.defineProperty(PatchedNotification, 'permission', {
                    get: function () { return OriginalNotification.permission }
                })
            } catch (e) {
                PatchedNotification.permission = OriginalNotification.permission
            }
            PatchedNotification.requestPermission = OriginalNotification.requestPermission
                ? OriginalNotification.requestPermission.bind(OriginalNotification)
                : function () { return Promise.resolve('granted') }
            window.Notification = PatchedNotification
        }
    } catch (e) {}

    try {
        if (window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype.showNotification) {
            var origShow = ServiceWorkerRegistration.prototype.showNotification
            ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
                queue(title, options)
                return origShow.call(this, title, options)
            }
        }
    } catch (e) {}

    return 'patched'
})()`

const NOTIF_DRAIN_SCRIPT = `(function() {
    if (!window.__centrioPendingNotifs || !window.__centrioPendingNotifs.length) return []
    return window.__centrioPendingNotifs.splice(0, window.__centrioPendingNotifs.length)
})()`

const NOTIF_POLL_MS = 2000

// ── Диагностика "аудиосообщения иногда не воспроизводятся" (репорт: WhatsApp
// Web и Яндекс Мессенджер, перемежающийся характер) ─────────────────────────
// Статический разбор кода приложения (adblock-паттерны в
// main/services/adblock.js, отсутствие permission-хендлера для медиа, стандартные
// атрибуты <webview>, отсутствие перехвата <audio>/.play() в webview-preload.js,
// CDP-мост для SW-уведомлений в main/services/swNotifPatcher.js) не нашёл ни
// одной точки в РАСШИРЕНИИ приложения, которая могла бы блокировать
// воспроизведение медиа — единственный правдоподобный источник именно
// ПЕРЕМЕЖАЮЩИХСЯ сбоев (не блокировка целиком, а "иногда") — сетевой слой
// (VPN/прокси-туннель, см. main/services/proxy.js) или сам мессенджер/CDN.
// Дальше без воспроизводимого случая двигаться нельзя — вместо угадывания
// добавляем пассивный диагностический хук тем же подтверждённо рабочим каналом
// (executeJavaScript on dom-ready), что и счётчик непрочитанных/уведомления
// выше — preload-атрибут <webview> для этого не годится (см. комментарий над
// UNREAD_DETECT_SCRIPT). 'error'/'stalled' на <audio>/<video> не всплывают —
// слушаем в фазе capture на document. Следующее реальное воспроизведение бага
// запишет code/message/networkState/src в лог главного процесса.
const MEDIA_DIAG_PATCH_SCRIPT = `(function() {
    if (window.__centrioMediaDiagPatched) return 'already-patched'
    window.__centrioMediaDiagPatched = true
    window.__centrioPendingMediaErrors = window.__centrioPendingMediaErrors || []

    function isMedia(el) {
        return el && (el.tagName === 'AUDIO' || el.tagName === 'VIDEO')
    }

    function report(type, el) {
        try {
            var err = el.error
            window.__centrioPendingMediaErrors.push({
                type: type,
                src: String(el.currentSrc || el.src || ''),
                code: err ? err.code : null,
                message: err && err.message ? String(err.message) : '',
                networkState: el.networkState,
                readyState: el.readyState
            })
            // Не даём очереди расти бесконечно, если сбоев сразу много
            if (window.__centrioPendingMediaErrors.length > 20) {
                window.__centrioPendingMediaErrors.splice(0, window.__centrioPendingMediaErrors.length - 20)
            }
        } catch (e) {}
    }

    document.addEventListener('error', function (e) {
        if (isMedia(e.target)) report('error', e.target)
    }, true)
    document.addEventListener('stalled', function (e) {
        if (isMedia(e.target)) report('stalled', e.target)
    }, true)

    return 'patched'
})()`

const MEDIA_DIAG_DRAIN_SCRIPT = `(function() {
    if (!window.__centrioPendingMediaErrors || !window.__centrioPendingMediaErrors.length) return []
    return window.__centrioPendingMediaErrors.splice(0, window.__centrioPendingMediaErrors.length)
})()`

const MEDIA_DIAG_POLL_MS = 3000

function startMediaDiagPolling(contents, getMainWindow) {
    const messengerId = findMessengerIdForSession(contents.session)

    const poll = () => {
        if (contents.isDestroyed()) return
        contents.executeJavaScript(MEDIA_DIAG_DRAIN_SCRIPT).then((items) => {
            if (!Array.isArray(items) || !items.length) return
            items.forEach((item) => {
                log.warn(
                    `[media-diag] messenger=${messengerId || '?'} ${item.type} ` +
                    `src=${item.src} code=${item.code} message="${item.message}" ` +
                    `networkState=${item.networkState} readyState=${item.readyState}`
                )
            })
        }).catch(() => {})
    }

    const timer = setInterval(poll, MEDIA_DIAG_POLL_MS)
    contents.once('destroyed', () => clearInterval(timer))
}

function startNotifPolling(contents, getMainWindow) {
    const messengerId = findMessengerIdForSession(contents.session)
    if (!messengerId) return

    const poll = () => {
        if (contents.isDestroyed()) return
        contents.executeJavaScript(NOTIF_DRAIN_SCRIPT).then((items) => {
            if (!Array.isArray(items) || !items.length) return
            const win = getMainWindow()
            if (!win || win.isDestroyed()) return
            items.forEach((payload) => {
                win.webContents.send('messenger-site-notification', messengerId, payload)
            })
        }).catch(() => {})
    }

    const timer = setInterval(poll, NOTIF_POLL_MS)
    contents.once('destroyed', () => clearInterval(timer))
}

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

// BUGFIX ("настройка звука уведомлений (и в целом любая настройка) не
// сохраняется — откатывается после перезапуска"): renderer's auto-cloud-sync
// (notifySyncedStoreWrite() in renderer.js) debounces the push by 1500ms so a
// burst of writes doesn't spam the network. If the app quits inside that
// window, scheduleAutoCloudSync() never even fires — main's pendingSyncPush
// (see waitForPendingSyncPush() below) stays empty, so before-quit has
// nothing to wait for. Local disk is correct, the cloud copy is stale, and
// the very next launch's cloudSyncPull() silently overwrites local with that
// stale value. Ask the renderer to flush its debounced push immediately and
// wait for its ack (bounded) before proceeding — this closes the race at the
// source instead of only covering pushes that already started.
function flushRendererCloudSync(getMainWindow) {
    return new Promise((resolve) => {
        const win = getMainWindow?.()
        if (!win || win.isDestroyed()) {
            resolve()
            return
        }

        const ACK_TIMEOUT_MS = 5000
        let settled = false

        const finish = () => {
            if (settled) return
            settled = true
            ipcMain.removeListener('app-quitting-flushed', finish)
            resolve()
        }

        ipcMain.once('app-quitting-flushed', finish)
        setTimeout(finish, ACK_TIMEOUT_MS)

        try {
            win.webContents.send('app-quitting')
        } catch {
            finish()
        }
    })
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

        // BUGFIX ("при скачивании открывает окно пустое белое" — live-
        // reproduced for a MAX file attachment: the popup opened by
        // webview-tabs-bind.js's 'new-window' handler → open-popup-window
        // already has its own hide()+close-on-done fix in
        // main/ipc/window.js, but that only covers popups THIS app
        // deliberately creates. When a <webview> guest calls
        // window.open()/target=_blank for what turns out to be a direct
        // file-download link and nothing intercepts it first (the guest's
        // own webContents has no setWindowOpenHandler — only top-level
        // BrowserWindows get one, right above), Electron falls back to
        // silently auto-creating a brand new, completely blank
        // BrowserWindow and navigating it straight to the download URL.
        // That window has nothing to render (the response is a file, not
        // HTML) and nothing else in the app ever closes it, so it's left
        // sitting there indefinitely — stuck behind the native Save-As
        // dialog Electron shows whenever no save path was set. This
        // listener is a safety net that catches EVERY new BrowserWindow
        // in the app, whichever path created it, and applies the exact
        // same hide()-now/close()-on-'done' pattern already proven for the
        // explicit open-popup-window flow: hide() is synchronous and wins
        // the race against the native dialog (Windows won't let a window
        // close while it still owns an open modal); close() only runs
        // once the download item's 'done' event fires, well after any
        // save dialog has resolved. Scoped to downloadWebContents ===
        // win.webContents so it can't react to unrelated downloads
        // elsewhere in a shared persist:<messengerId> session, and the
        // listener is removed on 'closed' so it can't leak onto the
        // session for the rest of the app's lifetime.
        const onSessionDownload = (_event, item, downloadWebContents) => {
            if (downloadWebContents !== win.webContents) return
            if (!win.isDestroyed()) win.hide()
            if (item) {
                item.once('done', () => {
                    if (!win.isDestroyed()) win.close()
                })
            } else if (!win.isDestroyed()) {
                win.close()
            }
        }
        try {
            const winSession = win.webContents.session
            winSession.on('will-download', onSessionDownload)
            win.once('closed', () => {
                try { winSession.removeListener('will-download', onSessionDownload) } catch {}
            })
        } catch {}
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

            // CDP-мост для Service Worker realm (см. main/services/swNotifPatcher.js)
            // — покрывает push-уведомления, которые мессенджер показывает изнутри
            // своего SW (self.registration.showNotification), а не со страницы.
            // Прикрепляем один раз на весь contents (не на dom-ready): CDP-таргет
            // webview переживает внутренние навигации, Target.setAutoAttach сам
            // подхватывает новые service_worker-таргеты по мере их появления.
            try {
                const messengerId = findMessengerIdForSession(contents.session)
                attachServiceWorkerNotifBridge(contents, messengerId, getMainWindow)
            } catch (err) {
                log.error('[sw-notif] failed to attach bridge:', err.message)
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
            let notifPollingStarted = false
            let mediaDiagPollingStarted = false
            contents.on('dom-ready', () => {
                if (!unreadPollingStarted) {
                    unreadPollingStarted = true
                    startUnreadPolling(contents, getMainWindow)
                }

                // Патч window.Notification/SW showNotification нужно ставить
                // заново на КАЖДЫЙ dom-ready (не один раз за весь contents) —
                // навигация внутри <webview> создаёт новый document/window, и
                // прошлый патч исчезает вместе с ним. Сам скрипт идемпотентен
                // внутри одной страницы (флаг window.__centrioNotifPatched).
                contents.executeJavaScript(NOTIF_PATCH_SCRIPT).catch(() => {})

                if (!notifPollingStarted) {
                    notifPollingStarted = true
                    startNotifPolling(contents, getMainWindow)
                }

                // Диагностика бага "аудиосообщения иногда не воспроизводятся"
                // (WhatsApp Web / Яндекс Мессенджер) — см. комментарий над
                // MEDIA_DIAG_PATCH_SCRIPT. Тот же паттерн, что и NOTIF_PATCH_SCRIPT
                // выше: патч ставим на каждый dom-ready (новый document/window
                // при внутренней навигации), опрос очереди — один раз на contents.
                contents.executeJavaScript(MEDIA_DIAG_PATCH_SCRIPT).catch(() => {})

                if (!mediaDiagPollingStarted) {
                    mediaDiagPollingStarted = true
                    startMediaDiagPolling(contents, getMainWindow)
                }
            })

            // BUGFIX ("ссылки открываются в новом окне Centrio, обычно
            // открывались в браузере"): a <webview> guest's own webContents
            // never got a setWindowOpenHandler — only top-level
            // BrowserWindows do (see 'browser-window-created' above). The
            // <webview> tag's DOM 'new-window' event (still wired in
            // renderer/messengers.js and renderer/webview-tabs-bind.js for
            // backwards compatibility) no longer fires on this Electron
            // version — setWindowOpenHandler on the guest's own webContents
            // is the only mechanism Chromium still calls. Without it, EVERY
            // window.open()/target=_blank click from inside a messenger
            // (a shared link, "open in new tab", etc.) fell through to
            // Electron's default behavior: silently auto-creating a real,
            // fully-rendering BrowserWindow right inside Centrio instead of
            // handing off to the OS default browser like a normal desktop
            // app.
            //
            // We can't just deny() outright here: some of these
            // window.open() calls are actually file downloads in disguise
            // (see the 'browser-window-created' BUGFIX above, live-
            // reproduced for a MAX attachment) — denying would suppress the
            // network request before it ever fires 'will-download', silently
            // breaking those downloads. So: allow the window to be created
            // (so a real download can still start and get picked up by the
            // existing will-download safety net below), but hide it
            // immediately and, unless it turns out to be a download, hand
            // the URL to the OS default browser and close it as soon as it
            // tries to actually navigate/render — mirroring the existing
            // hide-now/close-later pattern already proven for downloads,
            // just triggered by "this became a real page" instead of "this
            // became a download".
            contents.setWindowOpenHandler(() => ({ action: 'allow' }))

            contents.on('did-create-window', (childWindow) => {
                if (childWindow.isDestroyed()) return
                childWindow.hide()

                let isDownload = false
                const childSession = childWindow.webContents.session
                const onChildDownload = (_evt, _item, downloadWebContents) => {
                    if (downloadWebContents === childWindow.webContents) isDownload = true
                }
                try { childSession.on('will-download', onChildDownload) } catch {}

                childWindow.webContents.once('did-navigate', (_evt, navUrl) => {
                    if (isDownload || childWindow.isDestroyed()) return
                    if (!navUrl || navUrl === 'about:blank') return
                    shell.openExternal(navUrl).catch(() => {})
                    childWindow.close()
                })

                childWindow.once('closed', () => {
                    try { childSession.removeListener('will-download', onChildDownload) } catch {}
                })
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

                // BUGFIX (root cause of "webview-preload.js never runs in guest
                // pages" — previously mis-diagnosed as an Electron 39 platform
                // limitation, see the dom-ready/executeJavaScript workaround
                // above): webPreferences.preload is a *native* Electron option
                // consumed by web_contents_preferences.cc, which requires a
                // plain absolute filesystem path and rejects anything that
                // fails base::FilePath::IsAbsolute() — a file:// URL string does
                // NOT qualify. Assigning the file:// URL here silently failed
                // preload injection while logging "preload script must have
                // absolute path" once per messenger webview at startup (matches
                // main.log exactly: 8 occurrences for 8 webviews). preloadOk
                // above still passed because normalizePreloadPath() converts
                // both sides back to a path before comparing, masking the
                // mismatch. getWebviewPreloadPath() returns a file:// URL
                // because that's the format the <webview preload="..."> HTML
                // attribute expects (renderer/messengers.js,
                // renderer/webview-tabs-bind.js) — but this native
                // webPreferences assignment needs the raw filesystem path.
                webPreferences.preload = expectedPreload.startsWith('file://')
                    ? fileURLToPath(expectedPreload)
                    : expectedPreload
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
        //
        // BUGFIX ("сайдбар не сохраняется" / "возвращает старый сайдбар"):
        // also wait for any in-flight cloud sync push (renderer's
        // cloudSyncPush() in sidebar-dnd-bind.js / split.js is fire-and-forget
        // on the renderer side). Without this, a reorder or preset save
        // immediately followed by closing the window (closeBehavior:"quit")
        // could get its push killed mid-request — local disk already has the
        // correct order, but the stale cloud copy survives and overwrites it
        // right back on the next launch's cloudSyncPull(). See
        // main/ipc/api.js waitForPendingSyncPush() for the other half, and
        // flushRendererCloudSync() above for the debounce-window race it
        // still didn't cover (e.g. notification sound toggle reverting).
        // Deadline bumped from 4000 to 6000ms to give the renderer-flush
        // round trip (send 'app-quitting' → renderer pushes → ack) room to
        // land before we give up and quit anyway.
        const FLUSH_DEADLINE_MS = 6000
        const deadline = new Promise((resolve) => setTimeout(resolve, FLUSH_DEADLINE_MS))

        Promise.race([
            Promise.all([
                tracker.flush().catch(() => {}),
                flushRendererCloudSync(getMainWindow)
                    .then(() => waitForPendingSyncPush())
                    .catch(() => {})
            ]),
            deadline
        ]).finally(() => app.quit())
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
