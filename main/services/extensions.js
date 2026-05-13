const { session, app, webContents, BrowserWindow } = require('electron')
const path = require('path')
const fs   = require('fs')
const http  = require('http')
const https = require('https')
const store = require('./store')

// ── MV2 bridge extension ──────────────────────────────────────────────────────
// A bundled MV2 extension with a persistent background page.
// Its origin is chrome-extension://bridgeId — ExtensionNavigationThrottle allows
// extension→extension navigations, so window.open('chrome-extension://...') from
// the bridge background page succeeds where all other approaches are blocked.
//
// Path resolution: in a packaged app the files are in app.asar.unpacked/ because
// session.loadExtension() uses Chromium native code which cannot read ASAR archives.
// We try the unpacked path first, then fall back to the source-tree path (dev mode).
const _bridgeUnpacked = path.join(process.resourcesPath || '', 'app.asar.unpacked', 'main', 'ext-bridge')
const BRIDGE_DIR = fs.existsSync(path.join(_bridgeUnpacked, 'manifest.json'))
    ? _bridgeUnpacked
    : path.join(__dirname, '..', 'ext-bridge')
let   _bridgeId  = null   // filled in after first loadExtension call

function getBridgeId() { return _bridgeId }

// Find bridge background WebContents — any session works because the target
// extension is loaded in all sessions. Returns null if bridge isn't ready yet.
// NOTE: Only considers backgroundPage type — relay.html and other regular
// windows at the bridge URL must NOT be returned (they don't have _centrioOpenPopup).
function getBridgeWebContents(preferredPartition) {
    if (!_bridgeId) return null
    const prefix = `chrome-extension://${_bridgeId}/`
    const all = webContents.getAllWebContents()
    const matches = all.filter(wc => {
        if (wc.isDestroyed()) return false
        try {
            if (!wc.getURL().startsWith(prefix)) return false
            // Must be the extension background page, not relay or other windows
            return (wc.getType ? wc.getType() : '') === 'backgroundPage'
        } catch { return false }
    })
    if (!matches.length) return null
    // Prefer the bridge instance running in the requested partition (popups
    // opened from bg page inherit its session — we want persist:ext-popup so
    // popup storage/cookies are isolated from messenger sessions).
    if (preferredPartition) {
        const want = session.fromPartition(preferredPartition)
        const found = matches.find(wc => {
            try { return wc.session === want } catch { return false }
        })
        if (found) return found
    }
    return matches[0]
}

// ── Relay BrowserWindow ───────────────────────────────────────────────────────
// A regular (non-backgroundPage) BrowserWindow loaded at the bridge extension
// URL in persist:ext-popup.  Unlike backgroundPage WebContents, a regular
// window's window.open() correctly inherits the opener's session — so popups
// opened from here land in persist:ext-popup where all extensions are loaded.
//
// Created lazily after the bridge extension is loaded (so bridgeId is known).
let _relayWin = null   // BrowserWindow
let _relayWc  = null   // its webContents
let _relayReady = false

function getRelayWebContents() {
    if (_relayWc && !_relayWc.isDestroyed() && _relayReady) return _relayWc
    return null
}

async function ensureRelayWindow() {
    if (!_bridgeId) return null
    // Return if already alive and ready.
    if (_relayWc && !_relayWc.isDestroyed() && _relayReady) return _relayWc

    const relayUrl = `chrome-extension://${_bridgeId}/relay.html`
    log.info(`[ext-relay] creating relay BrowserWindow at ${relayUrl}`)
    try {
        const extPopupSess = session.fromPartition('persist:ext-popup')
        const win = new BrowserWindow({
            width: 1, height: 1,
            show: false, skipTaskbar: true,
            webPreferences: {
                session: extPopupSess,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
            }
        })
        _relayWin = win
        _relayWc  = win.webContents
        _relayReady = false

        // Allow relay to open popups in the same session (no partition override,
        // so inherits opener session = persist:ext-popup).
        _relayWc.setWindowOpenHandler(() => ({ action: 'allow' }))

        // Mark this window so the popup catch-all doesn't treat it as a popup.
        win._centrioIsRelay = true

        win.on('closed', () => {
            _relayWin = null; _relayWc = null; _relayReady = false
            log.warn('[ext-relay] relay window closed, will recreate on next popup request')
        })

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('relay load timeout')), 8000)
            _relayWc.once('dom-ready', () => { clearTimeout(timeout); resolve() })
            _relayWc.once('did-fail-load', (_e, code, desc) => {
                clearTimeout(timeout); reject(new Error(`relay load failed: ${code} ${desc}`))
            })
            // loadURL to bridge's own resource.  Browser-initiated navigation to
            // an extension URL is allowed (no WAR check for browser-initiated nav).
            win.loadURL(relayUrl)
        })

        _relayReady = true
        log.info('[ext-relay] relay window ready')
        return _relayWc
    } catch (e) {
        log.warn('[ext-relay] relay window setup failed:', e.message)
        if (_relayWin && !_relayWin.isDestroyed()) { try { _relayWin.destroy() } catch {} }
        _relayWin = null; _relayWc = null; _relayReady = false
        return null
    }
}

// ── Find a background-page WebContents for any given extension ID ─────────────
// Prefers the instance running in persist:ext-popup (so the popup window
// opened via window.open from that context inherits the same session).
// Returns null if no backgroundPage exists (e.g. MV3 service-worker only).
function findExtensionBgPage(extId) {
    if (!extId) return null
    const prefix = `chrome-extension://${extId}/`
    const all = webContents.getAllWebContents()
    let extPopupSess = null
    try { extPopupSess = session.fromPartition('persist:ext-popup') } catch {}
    let best = null

    // Diagnostic: log what we find (only when actually searching)
    const bgPages = all.filter(wc => {
        if (wc.isDestroyed()) return false
        try { return (wc.getType ? wc.getType() : '') === 'backgroundPage' } catch { return false }
    })
    log.info(`[ext-bg] findExtensionBgPage(${extId}): total bg pages=${bgPages.length}`)
    for (const wc of bgPages) {
        try {
            const url = wc.getURL()
            const inPopupSess = extPopupSess ? wc.session === extPopupSess : false
            log.info(`[ext-bg]   bgPage url=${url} inExtPopup=${inPopupSess}`)
        } catch {}
    }

    for (const wc of all) {
        if (wc.isDestroyed()) continue
        try {
            const type = wc.getType ? wc.getType() : ''
            if (type !== 'backgroundPage') continue
            const url = wc.getURL()
            if (!url || !url.startsWith(prefix)) continue
            // Prefer persist:ext-popup session
            if (extPopupSess && wc.session === extPopupSess) return wc
            if (!best) best = wc
        } catch {}
    }
    if (best) log.info(`[ext-bg] → found (non-preferred session)`)
    else log.info(`[ext-bg] → not found`)
    return best
}

// Setter for pending popup (url + dimensions).  Called before triggering
// window.open on any extension bg page so the did-create-window handler
// can read the caller-specified dimensions and target URL.
function setPendingPopup(url, width, height) {
    _pendingPopupUrl  = url
    _pendingPopupSize = { width: width || 400, height: height || 600 }
}

// Open a chrome-extension:// popup via the bridge background page.
// This is the ONLY reliable way to navigate BrowserWindows to extension URLs
// in Electron 36 without recompiling Electron (ExtensionNavigationThrottle
// only allows navigations initiated from extension origins).
// Pending popup URL set by openViaBridge so that did-create-window in
// registerAppEvents.js can navigate the about:blank popup to the target URL.
let _pendingPopupUrl  = null
let _pendingPopupSize = { width: 400, height: 600 }

function getPendingPopup() {
    const p = { url: _pendingPopupUrl, ..._pendingPopupSize }
    _pendingPopupUrl = null
    return p
}

async function openViaBridge(url, width, height) {
    _pendingPopupUrl  = url
    _pendingPopupSize = { width: width || 400, height: height || 600 }

    // ── Strategy A: Relay BrowserWindow ──────────────────────────────────────
    // A regular (non-backgroundPage) BrowserWindow at bridge URL in
    // persist:ext-popup.  window.open() from it inherits persist:ext-popup,
    // so the popup lands in the right session where extensions are loaded.
    // The navigation initiator is chrome-extension://bridgeId → throttle checks
    // WAR extension_ids of target → [bridgeId] → PROCEED.
    const relayWc = await ensureRelayWindow()
    if (relayWc) {
        log.info(`[ext-bridge] opening via relay window: ${url}`)
        try {
            const expr = `window._centrioRelayOpen(${JSON.stringify(url)}, ${width||400}, ${height||600})`
            const result = await relayWc.executeJavaScript(expr, true)
            if (result && result.ok) {
                log.info(`[ext-bridge] relay opened (${result.route})`)
                return true
            }
            log.warn('[ext-bridge] relay open failed:', result && result.error)
        } catch (e) {
            log.warn('[ext-bridge] relay executeJavaScript error:', e.message)
        }
    } else {
        log.warn('[ext-bridge] relay not ready, falling back to bg-page + defaultSession')
    }

    // ── Strategy B: Bridge bg-page + target extension in defaultSession ───────
    // Bridge's backgroundPage WebContents.window.open() creates new windows in
    // Electron's defaultSession (not bg-page's own session — Electron bug).
    // Fix: load the target extension into defaultSession first so the navigation
    // to its popup URL succeeds.  This is safe for most extensions (webRequest
    // listeners in defaultSession don't intercept main-process net.request used
    // by electron-updater).
    const extIdMatch = url && url.match(/^chrome-extension:\/\/([^/]+)\//)
    const targetId = extIdMatch && extIdMatch[1]
    if (targetId && targetId !== _bridgeId) {
        const extDir = path.join(EXTENSIONS_DIR, targetId)
        if (fs.existsSync(path.join(extDir, 'manifest.json'))) {
            try {
                await session.defaultSession.loadExtension(extDir, { allowFileAccess: true })
                log.info(`[ext-bridge] loaded ${targetId} into defaultSession for bg-page popup`)
            } catch (e) {
                const msg = e?.message || ''
                if (!msg.includes('already loaded')) {
                    log.warn(`[ext-bridge] defaultSession load error for ${targetId}:`, msg)
                }
            }
        }
    }

    const wc = getBridgeWebContents('persist:ext-popup')
    if (!wc) {
        log.warn('[ext-bridge] background page not ready, cannot open popup:', url)
        return false
    }
    log.info(`[ext-bridge] opening via bg-page window.open: ${url}`)
    try {
        const expr = `window._centrioOpenPopup(${JSON.stringify(url)}, ${width||400}, ${height||600})`
        const result = await wc.executeJavaScript(expr, true)
        if (result && result.ok) {
            log.info(`[ext-bridge] bg-page opened (${result.route})`)
            return true
        }
        log.warn('[ext-bridge] bg-page open failed:', result && result.error)
        return false
    } catch (e) {
        log.warn('[ext-bridge] bg-page executeJavaScript error:', e.message)
        return false
    }
}

// Open popup via the TARGET extension's own service worker (MV3).
// Bridge (chrome-extension://bridgeId) sends a cross-extension message
// {__centrio_open: url} to the target extension's SW (patched by patchExtensionSW).
// The SW calls chrome.windows.create from its own context — same-extension →
// ExtensionNavigationThrottle always proceeds, no WAR check needed.
// Returns true if the SW acknowledged with {ok: true}.
async function openViaSW(targetExtId, url, width, height) {
    const bridgeWc = getBridgeWebContents('persist:ext-popup')
    if (!bridgeWc) {
        log.warn('[ext-sw] bridge WebContents not ready, cannot send SW message')
        return false
    }
    log.info(`[ext-sw] sending __centrio_open to SW of ${targetExtId}: ${url}`)
    try {
        const msg = { __centrio_open: url, width: width || 400, height: height || 600 }
        // _centrioSendMessage: cross-extension chrome.runtime.sendMessage with 6s timeout.
        // Naturally wakes dormant MV3 service workers before delivering the message.
        const expr = `window._centrioSendMessage(${JSON.stringify(targetExtId)}, ${JSON.stringify(msg)})`
        const result = await bridgeWc.executeJavaScript(expr, true)
        log.info(`[ext-sw] SW response: ${JSON.stringify(result)}`)
        if (result && result.ok) return true
        if (result === undefined) {
            log.warn('[ext-sw] SW timed out or has no onMessage listener (not patched?)')
        } else {
            log.warn('[ext-sw] SW responded with error:', result && result.error)
        }
        return false
    } catch (e) {
        log.warn('[ext-sw] executeJavaScript error:', e.message)
        return false
    }
}

// Session preload injected into persist:ext-popup.
// Patches chrome.tabs.* in the extension popup's main world so extensions
// (Google Translate, Grammarly, etc.) see the correct active messenger tab.
// Session preloads (unlike window-level preloads) run on chrome-extension:// pages.
const EXT_POPUP_PRELOAD = path.join(__dirname, '..', 'ext-popup-preload.js')
const EXT_SHIM_PRELOAD  = path.join(__dirname, '..', 'ext-shim-preload.js')
const EXT_API_PRELOAD   = path.join(__dirname, '..', 'ext-api-preload.js')

// Используем electron-log если доступен, иначе console
let log
try { log = require('electron-log') } catch { log = console }

const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'centrio-extensions')

// Extensions blocked from loading — incompatible with Electron or removed by request.
// Auto-uninstalled on startup if found in the user's installed list.
const BLOCKED_EXTENSION_IDS = new Set([
    'jddgbeighonaipjikdnfdpiefhoomlae', // uboost VPN — proxy+webRequest crashes Electron
    'bmnlcjabgnpnenekpadlanbbkooimhnj', // Honey — requires real browser tabs to work
    'mpcooeefegelfehalmefdeojlkinjjho', // Яндекс картинки — context menu only, no real value in Electron
])

// extension id → Set of partitions already loaded
const loadedMap = new Map()

function isPro() {
    try {
        const user = store.get('cloud.user', {})
        const plan = (user?.plan || 'FREE').toUpperCase()
        return plan === 'PRO' || plan === 'TEAM' || plan === 'PRO_YEAR'
    } catch { return false }
}

// ── Download CRX from Chrome Web Store ───────────────────────────────────────
function downloadCrx(id) {
    // Use a recent Chrome version string; older values (120) are rejected for some extensions
    const url = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=136.0.0.0&acceptformat=crx3&x=id%3D${id}%26installsource%3Dondemand%26uc`
    return fetchFollow(url)
}

function fetchFollow(url, depth = 0) {
    if (depth > 5) return Promise.reject(new Error('Too many redirects'))
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http
        mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 Electron/36' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchFollow(res.headers.location, depth + 1).then(resolve).catch(reject)
            }
            if (res.statusCode !== 200) {
                res.resume()
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
            }
            const chunks = []
            res.on('data', c => chunks.push(c))
            res.on('end',  () => resolve(Buffer.concat(chunks)))
            res.on('error', reject)
        }).on('error', reject)
    })
}

// ── Unpack CRX3 = 12-byte header + protobuf(headerSize) + ZIP ────────────────
function unpackCrx3(buf, destDir) {
    if (buf.slice(0, 4).toString() !== 'Cr24') throw new Error('Not a CRX file (bad magic)')
    const version = buf.readUInt32LE(4)
    if (version !== 3) throw new Error(`CRX version ${version} unsupported`)
    const headerSize = buf.readUInt32LE(8)
    const zipBuf = buf.slice(12 + headerSize)
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(zipBuf)
    fs.mkdirSync(destDir, { recursive: true })
    zip.extractAllTo(destDir, true)
}

// ── Patch MV3 service worker script ──────────────────────────────────────────
// Injects a chrome.runtime.onMessage listener into the extension's SW so that
// our bridge can trigger popup creation via cross-extension messaging.
// The SW calls chrome.windows.create from ITS OWN extension context
// (same-extension) → ExtensionNavigationThrottle ALWAYS PROCEED, no WAR check.
// Also includes self.clients.openWindow as a secondary fallback.
function patchExtensionSW(extDir) {
    try {
        const manifest = readManifest(extDir)
        if ((manifest.manifest_version || 2) < 3) return false  // MV2 has bg page
        const swFile = manifest.background && manifest.background.service_worker
        if (!swFile) return false

        const swPath = path.join(extDir, swFile)
        if (!fs.existsSync(swPath)) {
            log.warn(`[ext-sw] SW file not found: ${path.basename(extDir)}/${swFile}`)
            return false
        }

        const content = fs.readFileSync(swPath, 'utf8')
        const MARKER = '/* __centrio_popup_injected__ */'
        if (content.includes(MARKER)) {
            log.info(`[ext-sw] already patched: ${path.basename(extDir)}/${swFile}`)
            return true
        }

        // The injected listener:
        // • Ignores all messages not carrying __centrio_open.
        // • On __centrio_open: tries chrome.windows.create first (Electron
        //   implements this for extension SWs), falls back to clients.openWindow.
        // • Returns true (async sendResponse) so bridge gets a result.
        const injection = [
            '',
            MARKER,
            '(function(){',
            '  try {',
            '    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {',
            '      chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {',
            '        if (!msg || msg.__centrio_open === undefined) return false;',
            '        var url = msg.__centrio_open;',
            '        var w   = msg.width  || 400;',
            '        var h   = msg.height || 600;',
            '        if (typeof url !== "string" || url.indexOf("chrome-extension://") !== 0) {',
            '          sendResponse({ ok: false, error: "bad url" }); return false;',
            '        }',
            '        function done(r) { try { sendResponse(r); } catch(e) {} }',
            '        // Primary: chrome.windows.create — available in Electron extension SWs.',
            '        // Navigation is same-extension → throttle always allows.',
            '        if (typeof chrome !== "undefined" && chrome.windows && chrome.windows.create) {',
            '          try {',
            '            chrome.windows.create({ url: url, type: "popup", width: w, height: h, focused: true },',
            '              function(win) {',
            '                done({ ok: !!(win && win.id), route: "chrome.windows.create", winId: win && win.id });',
            '              });',
            '            return true;',
            '          } catch(e) { /* fall through to clients.openWindow */ }',
            '        }',
            '        // Fallback: clients.openWindow (SW API — may require user gesture in browser',
            '        // but Electron extension SWs do not enforce that restriction).',
            '        if (typeof self !== "undefined" && self.clients && self.clients.openWindow) {',
            '          self.clients.openWindow(url)',
            '            .then(function() { done({ ok: true, route: "clients.openWindow" }); })',
            '            .catch(function(e) { done({ ok: false, error: e && e.message }); });',
            '          return true;',
            '        }',
            '        done({ ok: false, error: "no window API available" });',
            '        return false;',
            '      });',
            '    }',
            '  } catch(e) {}',
            '})();',
            '',
        ].join('\n')

        fs.writeFileSync(swPath, content + '\n' + injection, 'utf8')
        log.info(`[ext-sw] patched SW: ${path.basename(extDir)}/${swFile}`)
        return true
    } catch (e) {
        log.warn(`[ext-sw] patch error (${path.basename(extDir)}):`, e.message)
        return false
    }
}

// ── Patch manifest: web_accessible_resources ─────────────────────────────────
// CRITICAL CONSTRAINT (Electron 36):
//   "If a wildcard entry is present, it must be the only entry."
//   → We REPLACE the entire WAR array, not append to it.
//
// Primary strategy (ipc/window.js): same-extension navigation from the target
// extension's own bg page — no WAR check needed.
// This patch is the fallback for MV3 extensions (bridge cross-extension nav):
//   the bridge (chrome-extension://bridgeId) navigates to target — throttle
//   allows it only if target's WAR has extension_ids containing bridgeId.
// bridgeId — actual ID of bridge extension (known after loadExtension call).
function patchManifestWAR(extDir, bridgeId) {
    const manifestPath = path.join(extDir, 'manifest.json')
    try {
        const raw      = fs.readFileSync(manifestPath, 'utf8')
        const manifest = JSON.parse(raw)
        const mv       = manifest.manifest_version || 2
        let changed    = false

        if (mv >= 3) {
            // MV3: WAR is an array of objects.
            const newEntry = {
                resources: ['*'],
                matches:   ['<all_urls>'],
                use_dynamic_url: true
            }
            if (bridgeId) newEntry.extension_ids = [bridgeId]

            const existing = manifest.web_accessible_resources
            const wantStr  = JSON.stringify([newEntry])
            if (JSON.stringify(existing) !== wantStr) {
                manifest.web_accessible_resources = [newEntry]
                changed = true
            }
        } else {
            // MV2: WAR is an array of strings.
            const existing = manifest.web_accessible_resources
            if (!Array.isArray(existing) || existing.length !== 1 || existing[0] !== '*') {
                manifest.web_accessible_resources = ['*']
                changed = true
            }
        }

        // ── externally_connectable ──────────────────────────────────────────
        // Allow our Centrio bridge extension to send cross-extension messages.
        const ec = manifest.externally_connectable || {}
        const ids = Array.isArray(ec.ids) ? [...ec.ids] : []
        let ecChanged = false
        if (!ids.includes('*')) {
            ids.push('*')
            ecChanged = true
        }
        if (bridgeId && !ids.includes(bridgeId)) {
            ids.push(bridgeId)
            ecChanged = true
        }
        if (ecChanged) {
            manifest.externally_connectable = { ...ec, ids }
            changed = true
        }

        if (changed) {
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
            log.info(`[ext] patched manifest (WAR + externally_connectable) for ${path.basename(extDir)}`)
        }
    } catch (e) {
        log.warn(`[ext] patchManifestWAR error (${path.basename(extDir)}):`, e.message)
    }
}

// ── Read manifest after unpack ────────────────────────────────────────────────
function readManifest(extDir) {
    try {
        return JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'))
    } catch {
        return {}
    }
}

// ── Localisation helper ───────────────────────────────────────────────────────
// Resolves __MSG_key__ strings from extension _locales directory.
function resolveMessage(manifest, extDir, msgStr) {
    if (!msgStr || !msgStr.startsWith('__MSG_')) return msgStr
    const key = msgStr.slice(6, -2) // strip __MSG_ and __
    const localesToTry = [manifest.default_locale, 'en', 'ru'].filter(Boolean)
    for (const locale of localesToTry) {
        try {
            const p = path.join(extDir, '_locales', locale, 'messages.json')
            const msgs = JSON.parse(fs.readFileSync(p, 'utf8'))
            if (msgs[key]?.message) return msgs[key].message
        } catch {}
    }
    return null
}

// ── Sessions helper ───────────────────────────────────────────────────────────
// Расширения грузим ТОЛЬКО в persist: сессии мессенджеров + persist:ext-popup.
// defaultSession НЕ входит: его использует electron-updater — extension
// service workers перехватывают webRequest и вызывают нативный краш Chromium.

/**
 * Inject ext-api-preload.js into a session so every renderer using it gets
 * the chrome.tabs.* polyfill in its main world.  Safe to call repeatedly.
 */
function setupSessionPreloads(sess) {
    try {
        if (typeof sess.setPreloads !== 'function') return
        const existing = typeof sess.getPreloads === 'function' ? sess.getPreloads() : []
        const toAdd = []
        if (!existing.includes(EXT_POPUP_PRELOAD)) toAdd.push(EXT_POPUP_PRELOAD)
        if (!existing.includes(EXT_SHIM_PRELOAD))  toAdd.push(EXT_SHIM_PRELOAD)
        if (!existing.includes(EXT_API_PRELOAD))   toAdd.push(EXT_API_PRELOAD)
        if (!toAdd.length) return
        sess.setPreloads([...existing, ...toAdd])
        log.info('[ext] preloads injected via setPreloads(): ' + toAdd.map(p => path.basename(p)).join(', '))
    } catch (e) {
        log.warn('[ext] setPreloads error:', e.message)
    }
}

function getActiveSessions() {
    const sessions = []
    // Dedicated popup session — нужна чтобы popup webview загружал chrome-extension:// URL
    try {
        sessions.push({ key: 'persist:ext-popup', sess: session.fromPartition('persist:ext-popup') })
    } catch {}
    const messengers = store.get('messengers', [])
    for (const m of messengers) {
        try {
            sessions.push({ key: `persist:${m.id}`, sess: session.fromPartition(`persist:${m.id}`) })
        } catch {}
    }
    return sessions
}

async function loadExtIntoSession(id, extDir, sessEntry) {
    const { key, sess } = sessEntry
    const loaded = loadedMap.get(id) || new Set()
    if (loaded.has(key)) return

    // Ensure session has all required Chrome API shims before loading extensions.
    setupSessionPreloads(sess)

    log.info(`[ext] loadExtension START: ${id} → ${key}`)
    try {
        await sess.loadExtension(extDir, { allowFileAccess: true })
        loaded.add(key)
        loadedMap.set(id, loaded)
        log.info(`[ext] loadExtension OK: ${id} → ${key}`)
    } catch (e) {
        const msg = e?.message || String(e)
        log.warn(`[ext] loadExtension ERROR: ${id} → ${key}: ${msg}`)
        if (msg.includes('already loaded')) {
            loaded.add(key)
            loadedMap.set(id, loaded)
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
async function installExtension(id) {
    if (!isPro()) {
        throw new Error('PRO plan required to install extensions')
    }

    if (id === 'centrio-builtin-adblock') {
        const installed = store.get('extensions.installed', [])
        if (!installed.includes(id)) {
            store.set('extensions.installed', [...installed, id])
        }
        require('./adblock').updateAllSessions()
        return { name: 'AdBlock Plus (Built-in)' }
    }

    const extDir = path.join(EXTENSIONS_DIR, id)

    if (!fs.existsSync(path.join(extDir, 'manifest.json'))) {
        const crxBuf = await downloadCrx(id)
        unpackCrx3(crxBuf, extDir)
    }

    // Патч manifest.json и SW ДО loadExtension: Electron читает файл при загрузке.
    // Передаём актуальный bridgeId (если мост уже загружен) — MV3 WAR extension_ids
    // должен содержать реальный ID, иначе ExtensionNavigationThrottle заблокирует
    // popup открытый через relay при первом использовании (без рестарта).
    patchManifestWAR(extDir, _bridgeId || null)
    patchExtensionSW(extDir)

    const installed = store.get('extensions.installed', [])
    if (!installed.includes(id)) {
        store.set('extensions.installed', [...installed, id])
    }

    for (const entry of getActiveSessions()) {
        await loadExtIntoSession(id, extDir, entry)
    }

    return readManifest(extDir)
}

async function loadIntoPartition(partition) {
    if (!isPro()) return
    const enabled = getEnabled()
    const key = partition || 'default'
    const sess = partition ? session.fromPartition(partition) : session.defaultSession
    for (const id of enabled) {
        const extDir = path.join(EXTENSIONS_DIR, id)
        if (!fs.existsSync(path.join(extDir, 'manifest.json'))) continue
        await loadExtIntoSession(id, extDir, { key, sess })
    }
}

function uninstallExtension(id) {
    const extDir = path.join(EXTENSIONS_DIR, id)
    if (fs.existsSync(extDir)) {
        try { fs.rmSync(extDir, { recursive: true, force: true }) } catch {}
    }
    store.set('extensions.installed', store.get('extensions.installed', []).filter(x => x !== id))
    store.set('extensions.disabled', store.get('extensions.disabled', []).filter(x => x !== id))
    loadedMap.delete(id)
}

async function toggleExtension(id, enabled) {
    const disabled = store.get('extensions.disabled', [])
    if (enabled) {
        store.set('extensions.disabled', disabled.filter(x => x !== id))
    } else {
        if (!disabled.includes(id)) store.set('extensions.disabled', [...disabled, id])
    }

    if (id === 'centrio-builtin-adblock') {
        require('./adblock').updateAllSessions()
        return
    }

    // Apply changes immediately to all active sessions
    const sessions = getActiveSessions()
    const extDir = path.join(EXTENSIONS_DIR, id)

    for (const { key, sess } of sessions) {
        try {
            if (enabled) {
                if (fs.existsSync(path.join(extDir, 'manifest.json'))) {
                    await loadExtIntoSession(id, extDir, { key, sess })
                }
            } else {
                await sess.removeExtension(id)
                const lm = loadedMap.get(id)
                if (lm) lm.delete(key)
                log.info(`[ext] removeExtension (toggle off): ${id} → ${key}`)
            }
        } catch (e) {
            log.warn(`[ext] toggle error for ${id} in ${key}:`, e.message)
        }
    }
}

function getEnabled() {
    const installed = store.get('extensions.installed', [])
    const disabled  = store.get('extensions.disabled',  [])
    return installed.filter(id => !disabled.includes(id))
}

function getInstalledList() {
    const installed = store.get('extensions.installed', [])
    const disabled  = store.get('extensions.disabled',  [])

    const list = []

    // Built-in AdBlock
    const adblockId = 'centrio-builtin-adblock'
    list.push({
        id: adblockId,
        name: 'AdBlock Plus (Built-in)',
        version: '1.0.0',
        enabled: installed.includes(adblockId) && !disabled.includes(adblockId),
        optionsPage: null,
        popupPage: null,
        isBuiltIn: true
    })

    const userExts = installed.filter(id => id !== adblockId).map(id => {
        const extDir = path.join(EXTENSIONS_DIR, id)
        const manifest = readManifest(extDir)

        // Resolve localised name (__MSG_xxx__ → actual string)
        let name = manifest.name || id
        if (name.startsWith('__MSG_')) {
            name = resolveMessage(manifest, extDir, name) || id
        }

        const rawOptions = manifest.options_page || manifest.options_ui?.page || null
        const rawPopup   = manifest.action?.default_popup || manifest.browser_action?.default_popup || null
        const base = `chrome-extension://${id}/`
        return {
            id,
            name,
            version:     manifest.version || '?',
            enabled:     !disabled.includes(id),
            optionsPage: rawOptions ? base + rawOptions.replace(/^\//, '') : null,
            popupPage:   rawPopup   ? base + rawPopup.replace(/^\//, '')   : null,
        }
    })

    return [...list, ...userExts]
}

async function loadSavedOnStart() {
    if (!isPro()) {
        log.info('[ext] skipping startup load: not a PRO user')
        return
    }
    // One-time cleanup: remove blocked extensions from the installed list
    // so they disappear from the UI and no longer load.
    try {
        const installed = store.get('extensions.installed', [])
        const toRemove = installed.filter(id => BLOCKED_EXTENSION_IDS.has(id))
        if (toRemove.length > 0) {
            log.info(`[ext] auto-removing ${toRemove.length} blocked extension(s):`, toRemove.join(', '))
            for (const id of toRemove) {
                uninstallExtension(id)
            }
        }
    } catch (e) {
        console.warn('[ext] cleanup error:', e.message)
    }

    // ── Session preload for persist:ext-popup ────────────────────────────────
    try {
        const extPopupSess = session.fromPartition('persist:ext-popup')
        setupSessionPreloads(extPopupSess)
    } catch (e) {
        log.warn('[ext] ext-popup session preload setup error:', e.message)
    }

    // ── Load MV2 bridge extension into every active session ──────────────────
    // The bridge has a persistent background page whose origin is
    // chrome-extension://bridgeId. We call window._centrioOpenPopup() on it via
    // executeJavaScript() to open popup windows from the extension origin —
    // the only way to bypass ExtensionNavigationThrottle in Electron 36.
    const sessions = getActiveSessions()
    try {
        if (fs.existsSync(path.join(BRIDGE_DIR, 'manifest.json'))) {
            for (const { key, sess } of sessions) {
                setupSessionPreloads(sess)
                try {
                    const ext = await sess.loadExtension(BRIDGE_DIR, { allowFileAccess: true })
                    if (!_bridgeId) {
                        _bridgeId = ext.id
                        log.info(`[ext-bridge] loaded, id=${_bridgeId}`)
                    }
                } catch (e) {
                    if (!e.message?.includes('already loaded')) {
                        log.warn(`[ext-bridge] load error in ${key}:`, e.message)
                    }
                }
            }
        } else {
            log.warn('[ext-bridge] manifest.json not found at', BRIDGE_DIR)
        }
    } catch (e) {
        log.warn('[ext-bridge] bridge load error:', e.message)
    }

    // ── Phase 2: patch user extensions WITH the real bridge ID ──────────────
    // Two-phase approach:
    //   Phase 1 (above): load bridge → _bridgeId is now known.
    //   Phase 2 (here):  patch each extension's manifest with the ACTUAL
    //                    bridge ID in extension_ids (not just wildcard "*").
    //                    Chromium's WAR parser may reject "*" as an invalid
    //                    extension ID, but a real 32-char ID always matches.
    //   Phase 3 (below): load user extensions with the freshly patched manifests.
    const enabled = getEnabled()
    for (const id of enabled) {
        if (BLOCKED_EXTENSION_IDS.has(id)) continue
        const extDir = path.join(EXTENSIONS_DIR, id)
        if (!fs.existsSync(path.join(extDir, 'manifest.json'))) continue
        try {
            const m = readManifest(extDir)
            if (!m.name && !m.version) continue
        } catch { continue }
        // Pass actual bridge ID so it's added in extension_ids.
        patchManifestWAR(extDir, _bridgeId || null)
        // Patch MV3 service worker to handle __centrio_open popup messages.
        patchExtensionSW(extDir)
    }

    // ── Phase 2.5: start relay window (after bridge is known, before user exts) ─
    // The relay BrowserWindow is a regular window at chrome-extension://bridgeId/
    // in persist:ext-popup.  Unlike backgroundPage, its window.open() correctly
    // inherits the session — so popups land in persist:ext-popup.
    // We kick it off async (don't await) so startup isn't blocked.
    ensureRelayWindow().catch(e => log.warn('[ext-relay] startup create error:', e.message))

    // ── Phase 3: load user extensions ────────────────────────────────────────
    // CRITICAL: force remove-then-reload so Chromium picks up the freshly
    // patched manifest and SW from disk.  Chromium auto-loads extensions from
    // the persisted profile with stale manifests; a plain loadExtension call
    // fails with "already loaded" and leaves the old WAR / old SW in memory.
    for (const id of enabled) {
        if (BLOCKED_EXTENSION_IDS.has(id)) {
            log.warn(`[ext] skipping ${id}: blocked (incompatible with Electron)`)
            continue
        }
        const extDir = path.join(EXTENSIONS_DIR, id)
        const manifestPath = path.join(extDir, 'manifest.json')
        if (!fs.existsSync(manifestPath)) {
            log.warn(`[ext] skipping ${id}: no manifest.json`)
            continue
        }
        try {
            const manifest = readManifest(extDir)
            if (!manifest.name && !manifest.version) {
                log.warn(`[ext] skipping ${id}: invalid manifest`)
                continue
            }
        } catch {
            log.warn(`[ext] skipping ${id}: manifest parse error`)
            continue
        }
        for (const entry of sessions) {
            try {
                // Remove first (silently ignore if not loaded) so our patched
                // manifest / SW is loaded fresh from disk by loadExtension below.
                try {
                    await entry.sess.removeExtension(id)
                    log.info(`[ext] removeExtension OK: ${id} → ${entry.key}`)
                    // Clear loadedMap so loadExtIntoSession doesn't short-circuit
                    const lm = loadedMap.get(id)
                    if (lm) lm.delete(entry.key)
                } catch { /* not loaded — that's fine */ }

                await loadExtIntoSession(id, extDir, entry)
            } catch (e) {
                log.warn(`[ext] skipping ${id} for ${entry.key}:`, e.message)
            }
        }
    }
}

module.exports = {
    installExtension,
    uninstallExtension,
    toggleExtension,
    loadIntoPartition,
    loadSavedOnStart,
    getInstalledList,
    setupSessionPreloads,
    openViaBridge,
    openViaSW,
    getPendingPopup,
    setPendingPopup,
    getBridgeId,
    getBridgeWebContents,
    getRelayWebContents,
    ensureRelayWindow,
    findExtensionBgPage,
    EXTENSIONS_DIR
}
