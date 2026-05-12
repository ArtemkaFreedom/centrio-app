/**
 * ext-protocol.js — centrio-ext:// custom protocol for extension popups.
 *
 * ExtensionNavigationThrottle in Electron blocks any navigation to chrome-extension://
 * URLs whose initiator is not itself a chrome-extension origin. That makes it
 * impossible to open an extension popup window directly. The throttle ONLY
 * targets the chrome-extension scheme — so we serve the extension's files
 * under our own scheme and translate URLs at the popup boundary.
 *
 * Layout:
 *   centrio-ext://<extensionId>/<path>     → EXTENSIONS_DIR/<extensionId>/<path>
 *
 * Companion pieces:
 *   - main.js                 — protocol.registerSchemesAsPrivileged (must run pre-ready)
 *   - main/ext-shim-preload.js — injects chrome.* shims into centrio-ext:// pages
 *   - main/services/extensions.js — adds shim preload to persist:ext-popup
 *   - main/ipc/window.js      — rewrites chrome-extension://X/p → centrio-ext://X/p
 */
'use strict'

const { protocol, net, ipcMain, session, app, webContents } = require('electron')
const path = require('path')
const fs   = require('fs')
const { pathToFileURL } = require('url')
const store = require('./store')

let log
try { log = require('electron-log') } catch { log = console }

const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'centrio-extensions')

// Resolve __MSG_xxx__ keys via _locales/<locale>/messages.json — same as
// readManifest helper in extensions.js (kept inline to avoid circular requires).
function readJsonSafe(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}
function readManifest(extDir) {
    return readJsonSafe(path.join(extDir, 'manifest.json')) || {}
}
function loadMessages(extDir, manifest) {
    const def = manifest.default_locale || 'en'
    const sysLocale = (app.getLocale() || 'en').replace('-', '_')
    const candidates = [sysLocale, sysLocale.split('_')[0], def, 'en']
    for (const loc of candidates) {
        if (!loc) continue
        const p = path.join(extDir, '_locales', loc, 'messages.json')
        const json = readJsonSafe(p)
        if (json) return json
    }
    return {}
}

function safeJoin(extDir, reqPath) {
    const cleaned = reqPath.replace(/^\/+/, '').replace(/\?.*$/, '').replace(/#.*$/, '')
    const decoded = decodeURIComponent(cleaned || 'index.html')
    const full    = path.normalize(path.join(extDir, decoded))
    if (!full.startsWith(path.normalize(extDir + path.sep)) && full !== path.normalize(extDir)) {
        return null
    }
    return full
}

function setupExtProtocol() {
    // Register on ALL sessions. ExtensionNavigationThrottle blocks navigations
    // in any session if the initiator is not an extension.
    app.on('session-created', (sess) => {
        registerOnSession(sess)
    })
    // Also register on existing sessions (like defaultSession)
    registerOnSession(session.defaultSession)
    try { registerOnSession(session.fromPartition('persist:ext-popup')) } catch {}

    function registerOnSession(sess) {
        if (!sess || !sess.protocol) return
        try {
            if (sess.protocol.isProtocolHandled('centrio-ext')) return
            sess.protocol.handle('centrio-ext', async (request) => {
            try {
                const u = new URL(request.url)
                const extId = u.hostname
                if (!extId) return new Response('Bad request', { status: 400 })
                const extDir = path.join(EXTENSIONS_DIR, extId)
                if (!fs.existsSync(path.join(extDir, 'manifest.json'))) {
                    return new Response('Extension not found: ' + extId, { status: 404 })
                }
                const filePath = safeJoin(extDir, u.pathname)
                if (!filePath) return new Response('Forbidden', { status: 403 })
                if (!fs.existsSync(filePath)) {
                    log.warn(`[ext-protocol] 404 ${request.url} → ${filePath}`)
                    return new Response('Not found: ' + filePath, { status: 404 })
                }
                const stat = fs.statSync(filePath)
                if (stat.isDirectory()) {
                    return new Response('Is a directory', { status: 404 })
                }
                return await net.fetch(pathToFileURL(filePath).toString())
            } catch (e) {
                log.error('[ext-protocol] handler error:', e.message)
                return new Response('Internal error: ' + e.message, { status: 500 })
            }
            })
            log.info(`[ext-protocol] centrio-ext:// registered on session`)
        } catch (e) {
            log.warn(`[ext-protocol] session register failed:`, e.message)
        }
    }

    // ── IPC handlers for chrome.* shims ───────────────────────────────────────

    // Synchronous (sendSync) handlers so the preload can inject shims with
    // manifest+messages already populated, before page scripts run.
    ipcMain.removeAllListeners('ext-shim:bootstrap')
    ipcMain.on('ext-shim:bootstrap', (event, extId) => {
        try {
            const extDir = path.join(EXTENSIONS_DIR, extId)
            const manifest = readManifest(extDir)
            const messages = loadMessages(extDir, manifest)
            event.returnValue = { manifest, messages, locale: app.getLocale() || 'en' }
        } catch (e) {
            event.returnValue = { manifest: {}, messages: {}, locale: 'en', error: e.message }
        }
    })

    // chrome.storage.<area>.get
    safeHandle('ext-shim:storage:get', async (_e, extId, area, keys) => {
        const stored = store.get(`extstorage.${extId}.${area}`, {}) || {}
        if (keys === null || keys === undefined) return { ...stored }
        if (typeof keys === 'string') {
            return keys in stored ? { [keys]: stored[keys] } : {}
        }
        if (Array.isArray(keys)) {
            const r = {}
            for (const k of keys) if (k in stored) r[k] = stored[k]
            return r
        }
        if (typeof keys === 'object') {
            // defaults object: return defaults overridden by stored values
            const r = { ...keys }
            for (const k of Object.keys(keys)) if (k in stored) r[k] = stored[k]
            return r
        }
        return stored
    })

    // chrome.storage.<area>.set
    safeHandle('ext-shim:storage:set', async (_e, extId, area, items) => {
        const stored = store.get(`extstorage.${extId}.${area}`, {}) || {}
        store.set(`extstorage.${extId}.${area}`, { ...stored, ...items })
        return true
    })

    // chrome.storage.<area>.remove
    safeHandle('ext-shim:storage:remove', async (_e, extId, area, keys) => {
        const stored = store.get(`extstorage.${extId}.${area}`, {}) || {}
        const arr = Array.isArray(keys) ? keys : [keys]
        for (const k of arr) delete stored[k]
        store.set(`extstorage.${extId}.${area}`, stored)
        return true
    })

    // chrome.storage.<area>.clear
    safeHandle('ext-shim:storage:clear', async (_e, extId, area) => {
        store.set(`extstorage.${extId}.${area}`, {})
        return true
    })

    // chrome.tabs.executeScript / chrome.scripting.executeScript
    safeHandle('ext-shim:executeScript', async (_e, extId, opts) => {
        try {
            const activeTab = require('../ext-tabs-registry').getActiveTab()
            if (!activeTab || !activeTab.partition) return []

            const targetSess = session.fromPartition(activeTab.partition)
            const all = webContents.getAllWebContents()
            const target = all.find(wc => {
                try { return wc.session === targetSess && !wc.isDestroyed() && wc.getType() === 'webview' }
                catch { return false }
            })
            if (!target) return []

            let code = opts.code
            if (opts._funcStr) {
                code = `(${opts._funcStr})(${JSON.stringify(opts.args || [])})`
            } else if (opts.func && typeof opts.func === 'function') {
                code = `(${opts.func.toString()})(${JSON.stringify(opts.args || [])})`
            } else if (opts.files && opts.files.length > 0) {
                // Read first file from extension dir
                const filePath = path.join(EXTENSIONS_DIR, extId, opts.files[0])
                if (fs.existsSync(filePath)) code = fs.readFileSync(filePath, 'utf8')
            }

            if (!code) return []
            const result = await target.executeJavaScript(code, true)
            return [result]
        } catch (e) {
            log.warn(`[ext-shim] executeScript error for ${extId}:`, e.message)
            return []
        }
    })

    // chrome.tabs.insertCSS / chrome.scripting.insertCSS
    safeHandle('ext-shim:insertCSS', async (_e, extId, opts) => {
        try {
            const activeTab = require('../ext-tabs-registry').getActiveTab()
            if (!activeTab || !activeTab.partition) return

            const targetSess = session.fromPartition(activeTab.partition)
            const all = webContents.getAllWebContents()
            const target = all.find(wc => {
                try { return wc.session === targetSess && !wc.isDestroyed() && wc.getType() === 'webview' }
                catch { return false }
            })
            if (!target) return

            let css = opts.code || opts.css
            if (!css && opts.files && opts.files.length > 0) {
                const filePath = path.join(EXTENSIONS_DIR, extId, opts.files[0])
                if (fs.existsSync(filePath)) css = fs.readFileSync(filePath, 'utf8')
            }
            if (css) await target.insertCSS(css)
        } catch (e) {
            log.warn(`[ext-shim] insertCSS error for ${extId}:`, e.message)
        }
    })

    // chrome.tabs.sendMessage (popup -> content script in messenger)
    safeHandle('ext-shim:tabsSendMessage', async (_e, extId, tabId, msg) => {
        try {
            const activeTab = require('../ext-tabs-registry').getActiveTab()
            if (!activeTab || !activeTab.partition) return undefined

            const targetSess = session.fromPartition(activeTab.partition)
            const all = webContents.getAllWebContents()
            const target = all.find(wc => {
                try { return wc.session === targetSess && !wc.isDestroyed() && wc.getType() === 'webview' }
                catch { return false }
            })
            if (!target) return undefined

            // Forward to webview.
            const payload = JSON.stringify({ type: 'centrio-ext-message', msg, extId })
            return await target.executeJavaScript(
                `window.postMessage(${payload}, '*')`,
                true
            )
        } catch (e) {
            log.warn(`[ext-shim] tabsSendMessage error for ${extId}:`, e.message)
            return undefined
        }
    })

    // chrome.runtime.sendMessage — forward to extension's real background page.
    safeHandle('ext-shim:sendMessage', async (event, extId, msg) => {
        try {
            // Path 1: MV2 background page — direct executeJavaScript relay.
            // Only use real backgroundPage (not popup/options) to avoid
            // routing the popup's own message back to itself.
            const bgWC = findBgPageOnly(extId)
            if (bgWC) {
                await injectRelayOnce(bgWC)
                const payload = JSON.stringify({ msg, sender: { id: extId } })
                const result = await bgWC.executeJavaScript(
                    `(window.__centrioInvokeOnMessage && window.__centrioInvokeOnMessage(${payload})) || null`,
                    true
                )
                if (result !== null && result !== undefined) return result
                // Fall through to bridge if bg page didn't respond — some extensions
                // (Bitwarden, Grammarly) have BOTH bg page and SW, with handlers in SW.
            }

            // Path 2: cross-extension messaging via the bridge background page.
            // Bridge has chrome-extension://bridgeId origin → real chrome.runtime
            // → chrome.runtime.sendMessage(extId, msg) natively wakes target SW
            // (MV3) or routes to background page (MV2). This is the fix for
            // dormant MV3 service workers that CDP can't see.
            const bridgeResult = await sendViaBridge(extId, msg)
            if (bridgeResult !== undefined) return bridgeResult

            // Path 3: CDP fallback (rarely useful — kept for diagnostic value).
            const senderWC = event.sender
            const swResult = await sendToServiceWorker(senderWC, extId, msg)
            if (swResult !== undefined) return swResult

            // Diagnostic dump.
            try {
                const all = webContents.getAllWebContents().map(wc => {
                    try { return `${wc.getType()}=${wc.getURL().slice(0, 80)}` }
                    catch { return '?' }
                })
                log.warn(`[ext-shim] sendMessage fail for ${extId}. WCs:`, all)
            } catch {}
            return undefined
        } catch (e) {
            log.warn('[ext-shim] sendMessage forward error:', e.message)
            return undefined
        }
    })

    log.info('[ext-protocol] IPC handlers registered')
}

function safeHandle(channel, handler) {
    try { ipcMain.removeHandler(channel) } catch {}
    ipcMain.handle(channel, handler)
}

// Find a live WebContents that hosts the extension's background page.
// Checks getType() === 'backgroundPage' first, then any WC whose URL starts
// with chrome-extension://<id>/. For MV3 extensions whose "background" is a
// service worker, this returns null (no WebContents exists for SWs).
// Strict variant: only true MV2 background pages (not popups/options).
function findBgPageOnly(extId) {
    const all = webContents.getAllWebContents()
    const prefix = `chrome-extension://${extId}/`
    for (const wc of all) {
        if (wc.isDestroyed()) continue
        try {
            if (wc.getType() === 'backgroundPage' && wc.getURL().startsWith(prefix)) {
                return wc
            }
        } catch {}
    }
    return null
}

function findBgWebContents(extId) {
    const all = webContents.getAllWebContents()
    const prefix = `chrome-extension://${extId}/`
    // Prefer real backgroundPage WC (MV2 with persistent or event page)
    for (const wc of all) {
        if (wc.isDestroyed()) continue
        try {
            if (wc.getType() === 'backgroundPage' && wc.getURL().startsWith(prefix)) {
                return wc
            }
        } catch {}
    }
    // Fallback: any WC under that extension origin (popup/options/etc).
    for (const wc of all) {
        if (wc.isDestroyed()) continue
        let url = ''
        try { url = wc.getURL() } catch {}
        if (url && url.startsWith(prefix)) return wc
    }
    return null
}

// Send a message to a target extension via the Centrio bridge background page.
// The bridge runs at chrome-extension://bridgeId origin and has real
// chrome.runtime — calling chrome.runtime.sendMessage(extId, msg) from there
// natively wakes the target's MV3 service worker and gets a response.
// Requires the target extension's manifest to allow our sender, which we
// achieve via patchManifestWAR adding externally_connectable.ids = ["*"].
async function sendViaBridge(extId, msg) {
    try {
        const ext = require('./extensions')
        const bridgeWC = ext.getBridgeWebContents && ext.getBridgeWebContents()
        if (!bridgeWC || bridgeWC.isDestroyed()) {
            log.warn('[ext-shim] bridge bg WC not available for sendMessage')
            return undefined
        }
        const expr = `(window._centrioSendMessage && window._centrioSendMessage(${JSON.stringify(extId)}, ${JSON.stringify(msg)}))`
        const result = await bridgeWC.executeJavaScript(expr, true)
        return result
    } catch (e) {
        log.warn('[ext-shim] sendViaBridge failed:', e.message)
        return undefined
    }
}

// Try to message an MV3 service worker for the given extension via Chrome
// DevTools Protocol. We attach the debugger to ANY WebContents (the popup
// itself is fine), enable Target discovery, find the SW target for our
// extId, attach a session, and Runtime.evaluate the relay code.
async function sendToServiceWorker(senderWC, extId, msg) {
    if (!senderWC || senderWC.isDestroyed()) return undefined
    const dbg = senderWC.debugger
    let attached = false
    try {
        // Try to wake up the SW first via Electron's serviceWorkers API.
        // MV3 SWs are killed after 30s idle — we need them running to message.
        try {
            const sess = senderWC.session
            const swMgr = sess && sess.serviceWorkers
            if (swMgr && typeof swMgr.startWorkerForScope === 'function') {
                await swMgr.startWorkerForScope(`chrome-extension://${extId}/`).catch(() => {})
            }
        } catch {}

        try { dbg.attach('1.3'); attached = true } catch (e) {
            if (!String(e.message).includes('already attached')) throw e
        }
        // Get ALL targets — without filter, includes stopped service workers
        // and other auxiliary targets. Filtering by type works on Electron 35+
        // but is finicky; manual filter is more reliable.
        const { targetInfos } = await dbg.sendCommand('Target.getTargets', {})
        const swPrefix = `chrome-extension://${extId}/`
        const candidates = (targetInfos || []).filter(t => t.url && t.url.startsWith(swPrefix))
        // Prefer service_worker, then any chrome-extension:// target.
        const target = candidates.find(t => t.type === 'service_worker') || candidates[0]
        if (!target) {
            // Diagnostic: list all targets so we can see what's there.
            const types = {}
            for (const t of (targetInfos || [])) {
                types[t.type] = (types[t.type] || 0) + 1
            }
            const swTargets = (targetInfos || [])
                .filter(t => t.type === 'service_worker')
                .map(t => t.url).slice(0, 5)
            log.warn(`[ext-shim] CDP: no target for ${extId}. Types:`, types,
                'SWs:', swTargets)
            return undefined
        }
        const { sessionId } = await dbg.sendCommand('Target.attachToTarget', {
            targetId: target.targetId, flatten: true
        })
        // Inject relay (idempotent) then invoke listeners.
        const relay = `(function(){
            if (self.__centrioRelayReady) return true;
            try {
                var listeners = [];
                if (self.chrome && chrome.runtime && chrome.runtime.onMessage) {
                    var orig = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
                    chrome.runtime.onMessage.addListener = function(fn){
                        if (typeof fn === 'function') listeners.push(fn);
                        try { return orig(fn); } catch(_) {}
                    };
                }
                self.__centrioInvokeOnMessage = function(json){
                    return new Promise(function(resolve){
                        try {
                            var data = (typeof json === 'string') ? JSON.parse(json) : json;
                            var msg = data.msg, sender = data.sender || {};
                            var responded = false;
                            var settled = false;
                            function done(r){
                                if (settled) return;
                                settled = true;
                                resolve(r);
                            }
                            function sendResponse(r){
                                if (responded) return;
                                responded = true;
                                done(r);
                            }
                            var anyAsync = false;
                            for (var i = 0; i < listeners.length; i++) {
                                try {
                                    var ret = listeners[i](msg, sender, sendResponse);
                                    if (ret === true) anyAsync = true;
                                } catch(_) {}
                                if (responded) return;
                            }
                            if (!anyAsync) done(undefined);
                            else setTimeout(function(){ done(undefined); }, 4500);
                        } catch(e) { resolve(undefined); }
                    });
                };
                self.__centrioRelayReady = true;
            } catch(_) {}
            return true;
        })();`
        await dbg.sendCommand('Runtime.evaluate', {
            expression: relay, awaitPromise: false, returnByValue: true
        }, sessionId)
        const payload = JSON.stringify({ msg, sender: { id: extId } })
        const result = await dbg.sendCommand('Runtime.evaluate', {
            expression: `self.__centrioInvokeOnMessage(${payload})`,
            awaitPromise: true, returnByValue: true
        }, sessionId)
        try { await dbg.sendCommand('Target.detachFromTarget', { sessionId }) } catch {}
        return result && result.result ? result.result.value : undefined
    } catch (e) {
        log.warn('[ext-shim] CDP SW send failed:', e.message)
        return undefined
    } finally {
        if (attached) {
            try { dbg.detach() } catch {}
        }
    }
}

// Cache: WebContents.id → true once the relay has been injected. Cleared on
// destroy so we re-inject after a bg page reload.
const _relayInjected = new Set()

async function injectRelayOnce(wc) {
    if (_relayInjected.has(wc.id)) return
    const code = `(function(){
        if (window.__centrioRelayReady) return true;
        try {
            var listeners = [];
            try {
                if (window.chrome && chrome.runtime && chrome.runtime.onMessage) {
                    var orig = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
                    chrome.runtime.onMessage.addListener = function(fn){
                        if (typeof fn === 'function') listeners.push(fn);
                        try { return orig(fn); } catch(_) {}
                    };
                }
            } catch(_) {}
            window.__centrioInvokeOnMessage = function(json){
                try {
                    var data = (typeof json === 'string') ? JSON.parse(json) : json;
                    var msg = data.msg, sender = data.sender || {};
                    var responded = false, response = undefined;
                    function sendResponse(r){ if(!responded){ responded = true; response = r; } }
                    for (var i = 0; i < listeners.length; i++) {
                        try {
                            var ret = listeners[i](msg, sender, sendResponse);
                            if (ret === true) {
                                // listener will respond async — we can't actually wait;
                                // best-effort: return whatever's set after a microtask.
                            }
                        } catch(_) {}
                        if (responded) break;
                    }
                    return response;
                } catch(e) { return undefined; }
            };
            window.__centrioRelayReady = true;
            return true;
        } catch(e) { return false; }
    })();`
    try {
        await wc.executeJavaScript(code, true)
        _relayInjected.add(wc.id)
        wc.once('destroyed', () => _relayInjected.delete(wc.id))
    } catch (e) {
        log.warn('[ext-shim] relay inject failed:', e.message)
    }
}

module.exports = { setupExtProtocol, EXTENSIONS_DIR }
