const { shell, session: electronSession, webContents: allWebContents } = require('electron')
const tracker  = require('../services/tracker')
const registry = require('../ext-tabs-registry')
const { getBridgeId, getPendingPopup } = require('../services/extensions')

let log
try { log = require('electron-log') } catch { log = console }

// ── chrome.tabs.query patch ───────────────────────────────────────────────────
function injectTabsPatch(contents) {
    try {
        const t   = registry.getActiveTab()
        const tab = t ? JSON.stringify({
            id: t.id || 1, index: t.index || 0, windowId: 1,
            active: true, highlighted: true, pinned: false,
            incognito: false, selected: true,
            url: t.url || '', title: t.title || t.url || '',
            status: 'complete', favIconUrl: '',
        }) : 'null'
        log.info(`[ext-popup] injecting tabs patch, registry tab=${t ? t.url : 'none'}`)
        const script = [
            '(function(){',
            'var _t=' + tab + ';',
            'function _real(t){return t&&t.url&&t.url.indexOf("chrome-extension://")!==0&&t.url!=="about:blank";}',
            'function _get(){return _t?[_t]:[];}',
            'function _patch(){',
            '  if(typeof chrome==="undefined"||!chrome||!chrome.tabs||!chrome.tabs.query){return false;}',
            '  if(chrome.tabs.query.__cp){return true;}',
            '  var _oq=chrome.tabs.query.bind(chrome.tabs);',
            '  function _run(qi){return new Promise(function(res){',
            '    try{_oq(qi,function(r){res((r||[]).filter(_real));});}catch(e){res([]);}',
            '  });}',
            '  function _q(qi,cb){',
            '    var go=function(){return _run(qi).then(function(r){return r.length?r:_get();});};',
            '    if(typeof cb==="function"){go().then(cb).catch(function(){cb(_get());});}',
            '    else{return go();}',
            '  }',
            '  _q.__cp=true;',
            '  try{Object.defineProperty(chrome.tabs,"query",{value:_q,writable:true,configurable:true});}',
            '  catch(e){try{chrome.tabs.query=_q;}catch(e2){}}',
            '  if(chrome.tabs.getCurrent){chrome.tabs.getCurrent=function(cb){var r=_get()[0];if(typeof cb==="function"){cb(r);}else{return Promise.resolve(r);}}}',
            '  console.error("[centrio] tabs patched url=" + (_t?_t.url:"none"));',
            '  return true;',
            '}',
            'var ok=_patch();',
            'if(!ok){[0,50,150,400,800].forEach(function(d){setTimeout(_patch,d);})}',
            '})()',
        ].join('\n')
        contents.executeJavaScript(script)
            .catch(e => log.warn('[ext-popup] tabs patch injection error:', e.message))
    } catch (e) {
        log.warn('[ext-popup] injectTabsPatch error:', e.message)
    }
}

// ── Shared popup window setup ─────────────────────────────────────────────────
function setupPopupWindow(win, w, h, getMainWindow) {
    // Guard: called from both did-create-window (attachBgPageHandler) and
    // the browser-window-created catch-all. Second call is a no-op.
    if (win._centrioSetupDone) return
    win._centrioSetupDone = true
    try { win.setSize(w, h) }             catch (e) {}
    try { win.setMinimumSize(200, 200) }  catch (e) {}
    try { win.setResizable(true) }        catch (e) {}
    try { win.setMinimizable(false) }     catch (e) {}
    try { win.setMaximizable(false) }     catch (e) {}
    try { win.setSkipTaskbar(true) }      catch (e) {}
    try { win.setMenuBarVisibility(false) } catch (e) {}
    try { win.setAlwaysOnTop(true) }      catch (e) {}
    try {
        const mainWin = getMainWindow()
        if (mainWin && !mainWin.isDestroyed()) {
            const [mx, my] = mainWin.getPosition()
            const [mw, mh] = mainWin.getSize()
            win.setPosition(mx + mw - w - 20, my + mh - h - 60)
        }
    } catch (e) { log.warn('[ext-popup] positioning error:', e.message) }

    win.webContents.on('did-navigate', (_e, navUrl) => {
        log.info(`[ext-popup] popup did-navigate url=${navUrl}`)
        if (navUrl && navUrl.startsWith('chrome-extension://')) injectTabsPatch(win.webContents)
    })
    win.webContents.on('dom-ready', () => {
        const curUrl = win.webContents.getURL()
        log.info(`[ext-popup] popup dom-ready url=${curUrl}`)
        if (curUrl.startsWith('chrome-extension://')) injectTabsPatch(win.webContents)
    })
    win.webContents.on('did-fail-load', (_e, code, desc, failedUrl) => {
        log.error(`[ext-popup] popup did-fail-load ${code} ${desc} url=${failedUrl}`)
    })
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
        const tag = ['log','info','warn','error','debug'][level] || level
        log.info(`[ext-popup][${tag}] ${message}  (${sourceId}:${line})`)
    })
    win.webContents.on('render-process-gone', (_e, details) => {
        log.error(`[ext-popup] popup render-process-gone reason=${details.reason}`)
    })
    // Route http(s) child windows to the system browser; allow extension URLs.
    win.webContents.setWindowOpenHandler(({ url: newUrl }) => {
        if (newUrl.startsWith('chrome-extension://') || newUrl.startsWith('centrio-ext://')) {
            return { action: 'allow' }
        }
        if (newUrl.startsWith('http://') || newUrl.startsWith('https://')) {
            shell.openExternal(newUrl).catch(() => {})
        }
        return { action: 'deny' }
    })
    // Block in-popup navigation to web URLs (extensions sometimes link to settings
    // pages on https sites — open in system browser instead).
    win.webContents.on('will-navigate', (event, navUrl) => {
        if (navUrl.startsWith('chrome-extension://') || navUrl.startsWith('centrio-ext://')) return
        if (navUrl.startsWith('about:')) return
        event.preventDefault()
        if (navUrl.startsWith('http://') || navUrl.startsWith('https://')) {
            shell.openExternal(navUrl).catch(() => {})
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
    // ── Extension popup windows ───────────────────────────────────────────────
    // Strategy A (primary): Find target extension's OWN background page WebContents
    // and execute window.open(popupUrl) from its JS context (ipc/window.js).
    // Initiator = chrome-extension://targetId, target = chrome-extension://targetId
    // → same-extension → ExtensionNavigationThrottle ALWAYS PROCEED.
    //
    // Strategy B (fallback for MV3): Bridge bg page (chrome-extension://bridgeId)
    // calls window.open(popupUrl) directly. Target extension's manifest is patched
    // with extension_ids:[bridgeId] in WAR → throttle cross-extension check passes.
    //
    // In both strategies, window.open goes through setWindowOpenHandler (below),
    // the new window is created in persist:ext-popup, and did-create-window sets
    // it up via setupPopupWindow.

    // ── chrome.windows.create catch-all ────────────────────────────────────
    // Bridge calls chrome.windows.create({type:'popup', url:'chrome-extension://...'})
    // which creates a top-level BrowserWindow natively. Electron's bg-page
    // did-create-window doesn't always fire for this API, so we watch every
    // new window: if it loads a chrome-extension:// URL in persist:ext-popup,
    // run setupPopupWindow (positioning, console capture, link routing).
    // CRITICAL: do NOT call session.fromPartition() at module-init time —
    // before app.whenReady() it throws in Electron 36, killing the rest of
    // this function (so app.on('web-contents-created') below never registers).
    // Lazy-resolve inside the listener instead.
    let _targetSession = null
    function getTargetSession() {
        if (_targetSession) return _targetSession
        try { _targetSession = electronSession.fromPartition('persist:ext-popup') } catch (e) {
            log.warn('[ext-popup] fromPartition error:', e.message)
        }
        return _targetSession
    }
    app.on('browser-window-created', (_e, win) => {
        // Skip the relay helper window (used internally to open popups from
        // bridge extension origin — it should stay hidden).
        if (win._centrioIsRelay) return

        // Only watch windows that are navigating to a chrome-extension:// URL.
        // We can't filter by session here because the window now inherits the
        // opener's session (which could be persist:ext-popup OR a messenger
        // session depending on which bg page opened the popup).
        // We apply the session check lazily in onNavigate below.
        // session objects don't have a .partition property — compare directly
        let _sessLabel = 'other'
        try {
            const _ts = getTargetSession()
            if (_ts && win.webContents.session === _ts) _sessLabel = 'persist:ext-popup'
            else if (win.webContents.session === electronSession.defaultSession) _sessLabel = 'default'
        } catch {}
        log.info(`[ext-popup] catch-all: new BrowserWindow sess=${_sessLabel}`)
        const wc = win.webContents
        // Diagnostic: log every navigation event so we can see if throttle blocks.
        wc.on('did-start-navigation', (_evt, navUrl, _isInPlace, isMainFrame) => {
            if (isMainFrame) log.info(`[ext-popup] catch-all did-start-navigation url=${navUrl}`)
        })
        wc.on('did-fail-load', (_evt, code, desc, failedUrl, isMainFrame) => {
            if (isMainFrame) log.error(`[ext-popup] catch-all did-fail-load ${code} ${desc} url=${failedUrl}`)
        })
        let setupDone = false
        const onNavigate = (_evt, navUrl) => {
            if (setupDone) return
            if (!navUrl) return
            if (!navUrl.startsWith('chrome-extension://')) return
            setupDone = true
            log.info(`[ext-popup] catch-all setup for ${navUrl}`)
            const pending = getPendingPopup()
            const w = (pending && pending.width)  || 400
            const h = (pending && pending.height) || 600
            setupPopupWindow(win, w, h, getMainWindow)
        }
        wc.on('did-navigate', onNavigate)
        wc.on('did-frame-navigate', (_evt, navUrl, _httpCode, _httpStatus, isMainFrame) => {
            if (isMainFrame) onNavigate(_evt, navUrl)
        })
    })

    function attachBgPageHandler(contents) {
        try {
            contents.setWindowOpenHandler((details) => {
                const url = (details && details.url) || ''
                log.info(`[ext-popup] bg setWindowOpenHandler url=${url}`)
                // CRITICAL: return 'allow' with NO webPreferences/partition override.
                // When overrideBrowserWindowOptions specifies a different partition,
                // Electron creates the window in a new renderer process and calls
                // loadURL from the browser (main) process — browser-initiated nav.
                // ExtensionNavigationThrottle blocks ALL browser-initiated navigations
                // to chrome-extension:// URLs, including same-extension ones.
                //
                // By NOT overriding partition, the new window inherits the opener's
                // session (persist:ext-popup for bridge, same for own-context bg page).
                // The navigation is then renderer-initiated from the bg page's origin
                // → throttle: same-extension → PROCEED; cross-extension + WAR → PROCEED.
                //
                // Window styling (size, position, etc.) is applied in did-create-window.
                return { action: 'allow' }
            })
            contents.on('did-create-window', (win, details) => {
                const url = (details && details.url) || ''
                const opts = (details && details.options) || {}
                let _wSessLabel = 'other'
                try {
                    const _ts2 = getTargetSession()
                    if (_ts2 && win.webContents.session === _ts2) _wSessLabel = 'persist:ext-popup'
                    else if (win.webContents.session === electronSession.defaultSession) _wSessLabel = 'default'
                } catch {}
                log.info(`[ext-popup] backgroundPage did-create-window url=${url} sess=${_wSessLabel}`)
                if (url.startsWith('chrome-extension://')) {
                    const pending = getPendingPopup()
                    const w = (pending && pending.width)  || opts.width  || 400
                    const h = (pending && pending.height) || opts.height || 600
                    setupPopupWindow(win, w, h, getMainWindow)
                    // Ensure the window is visible (Electron may not auto-show
                    // when setWindowOpenHandler returns {action:'allow'} without
                    // overrideBrowserWindowOptions).
                    if (!win.isVisible()) { win.show(); win.focus() }
                    return
                }
                // about:blank — legacy fallback path (no longer the primary route)
                if (url === 'about:blank') {
                    const pending = getPendingPopup()
                    if (!pending || !pending.url) {
                        log.warn('[ext-popup] about:blank popup but no pending target URL')
                        return
                    }
                    const targetUrl = pending.url
                    const w = pending.width  || opts.width  || 400
                    const h = pending.height || opts.height || 600
                    setupPopupWindow(win, w, h, getMainWindow)
                    if (!win.isVisible()) { win.show(); win.focus() }
                    win.webContents.once('dom-ready', () => {
                        const script = `(function(){
                            try {
                                var origin = location.origin;
                                var hasOpener = !!window.opener;
                                var hasFn = !!(window.opener && window.opener._navigatePopup);
                                if (hasFn) {
                                    window.opener._navigatePopup(window, ${JSON.stringify(targetUrl)});
                                    return 'ok:origin=' + origin;
                                }
                                return 'fail:opener=' + hasOpener + ':fn=' + hasFn + ':origin=' + origin;
                            } catch(e) {
                                return 'error:' + e.name + ':' + e.message;
                            }
                        })()`
                        win.webContents.executeJavaScript(script)
                            .then(result => log.info(`[ext-popup] opener-navigate result: ${result}`))
                            .catch(e  => log.error(`[ext-popup] opener-navigate error: ${e.message}`))
                    })
                }
            })
        } catch (e) {
            log.warn('[ext-popup] attachBgPageHandler error:', e.message)
        }
    }

    // Retroactively attach to any backgroundPage webContents already created
    // before this listener was registered (e.g. bridge bg page from
    // loadSavedOnStart() which runs in app.whenReady()).
    app.whenReady().then(() => {
        try {
            const all = allWebContents.getAllWebContents()
            for (const wc of all) {
                try {
                    const t = wc.getType ? wc.getType() : 'unknown'
                    if (t === 'backgroundPage') {
                        log.info(`[ext-popup] retro-attaching to existing bg page ${wc.getURL()}`)
                        attachBgPageHandler(wc)
                    }
                } catch {}
            }
        } catch (e) { log.warn('[ext-popup] retro-attach error:', e.message) }
    })

    app.on('web-contents-created', (_ev, contents) => {
        const type = contents.getType ? contents.getType() : 'unknown'
        log.info(`[ext-popup] web-contents-created type=${type}`)

        // ── Background pages: attach popup window-open handler ────────────────
        if (type === 'backgroundPage') {
            attachBgPageHandler(contents)
            return
        }

        // (legacy duplicated branch retained below disabled by early return)
        if (false && type === 'backgroundPage') {
            // CRITICAL: explicit setWindowOpenHandler with action:'allow' so
            // Electron actually navigates the new window to the requested URL.
            // Without a handler, Electron's default behavior for bg-page-
            // initiated window.open creates an empty BrowserWindow that
            // ignores the URL parameter (only inherits about:blank).
            // With action:'allow', Electron creates the window AND issues a
            // navigation request whose initiator is the bg page (extension
            // origin) → ExtensionNavigationThrottle PROCEED.
            contents.setWindowOpenHandler((details) => {
                const url = (details && details.url) || ''
                log.info(`[ext-popup] bg setWindowOpenHandler url=${url}`)
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        width: 400, height: 600,
                        title: 'Расширение',
                        resizable: true,
                        minimizable: false,
                        maximizable: false,
                        alwaysOnTop: true,
                        skipTaskbar: true,
                        autoHideMenuBar: true,
                        webPreferences: {
                            partition: 'persist:ext-popup',
                            contextIsolation: true,
                            sandbox: false,
                            webSecurity: true,
                        }
                    }
                }
            })
            contents.on('did-create-window', (win, details) => {
                const url = (details && details.url) || ''
                const opts = (details && details.options) || {}
                log.info(`[ext-popup] backgroundPage did-create-window url=${url}`)

                // Native path: bridge used chrome.windows.create / window.open
                // directly with a chrome-extension:// URL → window opens at
                // target URL natively (no opener dance, no centrio-ext shim).
                if (url.startsWith('chrome-extension://')) {
                    const pending = getPendingPopup()
                    const w = (pending && pending.width)  || opts.width  || 400
                    const h = (pending && pending.height) || opts.height || 600
                    setupPopupWindow(win, w, h, getMainWindow)
                    return
                }

                // Legacy fallback: about:blank + opener._navigatePopup chain.
                // Kept in case chrome.windows.create / direct window.open fail.
                if (url === 'about:blank') {
                    const pending = getPendingPopup()
                    if (!pending || !pending.url) {
                        log.warn('[ext-popup] about:blank popup but no pending target URL')
                        return
                    }
                    const targetUrl = pending.url
                    const w = pending.width  || opts.width  || 400
                    const h = pending.height || opts.height || 600

                    setupPopupWindow(win, w, h, getMainWindow)

                    win.webContents.once('dom-ready', () => {
                        const script = `(function(){
                            try {
                                var origin = location.origin;
                                var hasOpener = !!window.opener;
                                var hasFn = !!(window.opener && window.opener._navigatePopup);
                                if (hasFn) {
                                    window.opener._navigatePopup(window, ${JSON.stringify(targetUrl)});
                                    return 'ok:origin=' + origin;
                                }
                                return 'fail:opener=' + hasOpener + ':fn=' + hasFn + ':origin=' + origin;
                            } catch(e) {
                                return 'error:' + e.name + ':' + e.message;
                            }
                        })()`
                        win.webContents.executeJavaScript(script)
                            .then(result => log.info(`[ext-popup] opener-navigate result: ${result}`))
                            .catch(e  => log.error(`[ext-popup] opener-navigate error: ${e.message}`))
                    })
                }
            })
            return
        }

        // ── All other WebContents: normal deny with extension exceptions ───────
        // The relay BrowserWindow is handled by extensions.js — skip here.
        const relayBrowserWin = contents.getOwnerBrowserWindow && contents.getOwnerBrowserWindow()
        if (relayBrowserWin && relayBrowserWin._centrioIsRelay) return

        contents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('chrome-extension://') || url.startsWith('centrio-ext://')) {
                log.info(`[ext-popup] setWindowOpenHandler → allow ext ${url}`)
                return { action: 'allow' }
            }
            return { action: 'deny' }
        })

        contents.on('did-create-window', (win, details) => {
            const url = (details && details.url) || ''
            if (!url.startsWith('chrome-extension://') && !url.startsWith('centrio-ext://')) return
            log.info(`[ext-popup] did-create-window url=${url}`)
            const opts = (details && details.options) || {}
            setupPopupWindow(win, opts.width || 400, opts.height || 600, getMainWindow)
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
        tracker.flush()
            .catch(() => {})
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
