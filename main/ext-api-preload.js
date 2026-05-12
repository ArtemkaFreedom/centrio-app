/**
 * ext-api-preload.js  —  Chrome Extension API bridge for Centrio
 *
 * Injected via session.setPreloads() so it runs in the MAIN WORLD of every
 * renderer that uses a Centrio extension session.  Running in the main world
 * means we can access and patch the `chrome.*` globals that Electron's
 * extension system injects.
 *
 * Why this is needed:
 *   Extension popups call chrome.tabs.query({active:true,currentWindow:true})
 *   and get an empty array because the popup BrowserWindow is not a real
 *   Chrome "tab".  We patch chrome.tabs.query / getCurrent / get to fall back
 *   to our own IPC-backed tab registry (ext-tabs-registry.js) instead.
 *
 * Requires sandbox:false so require('electron') is available.
 */

;(function () {
    'use strict'

    // Only run where Node is available (popup BrowserWindows, sandbox:false).
    // In sandboxed webviews require is not defined — bail silently.
    if (typeof require !== 'function') return

    let ipcRenderer
    try {
        ipcRenderer = require('electron').ipcRenderer
    } catch {
        return
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Normalise a raw registry tab to a Chrome-compatible tab object. */
    function buildChromeTab(t) {
        return {
            id:          t.id          || 1,
            index:       t.index       || 0,
            windowId:    t.windowId    || 1,
            highlighted: !!t.highlighted,
            active:      !!t.active,
            pinned:      false,
            incognito:   false,
            selected:    !!t.active,
            url:         t.url         || '',
            title:       t.title       || t.url || '',
            status:      t.status      || 'complete',
            favIconUrl:  t.favIconUrl  || undefined,
        }
    }

    /**
     * Call the original chrome.tabs.query() and return a Promise.
     * Normalises both the callback and promise calling conventions.
     */
    function callOrigQuery(origFn, queryInfo) {
        return new Promise(resolve => {
            try {
                const maybePromise = origFn(queryInfo, resolve)
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(resolve).catch(() => resolve([]))
                }
            } catch {
                resolve([])
            }
        })
    }

    /** Filter a list of Chrome tab objects by a queryInfo descriptor. */
    function filterTabs(tabs, queryInfo) {
        return tabs.filter(t => {
            if (queryInfo.active      !== undefined && t.active      !== queryInfo.active)      return false
            if (queryInfo.highlighted !== undefined && t.highlighted !== queryInfo.highlighted) return false
            if (queryInfo.pinned      !== undefined && t.pinned      !== queryInfo.pinned)      return false
            if (queryInfo.status      !== undefined && t.status      !== queryInfo.status)      return false
            if (queryInfo.url         !== undefined) {
                // Support simple match patterns like 'https://*/*'
                try {
                    const pattern = queryInfo.url.replace(/\*/g, '.*')
                    if (!new RegExp(`^${pattern}$`).test(t.url)) return false
                } catch { return false }
            }
            return true
        })
    }

    // ── Main patch function ───────────────────────────────────────────────────

    function setupRuntimeBridge() {
        try {
            if (typeof chrome === 'undefined' || !chrome) window.chrome = {};
            if (!chrome.runtime) chrome.runtime = {};

            const listeners = [];

            // Monkey-patch onMessage if it exists, or shim it if it doesn't
            if (chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
                const orig = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
                chrome.runtime.onMessage.addListener = function(fn) {
                    if (typeof fn === 'function' && !listeners.includes(fn)) listeners.push(fn);
                    try { return orig(fn); } catch(e) { return false; }
                };
            } else {
                chrome.runtime.onMessage = {
                    addListener: function(fn) { if (typeof fn === 'function' && !listeners.includes(fn)) listeners.push(fn); },
                    removeListener: function(fn) {
                        const idx = listeners.indexOf(fn);
                        if (idx !== -1) listeners.splice(idx, 1);
                    }
                };
            }

            // This allows extension scripts in the messenger to receive messages from the popup
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'centrio-ext-message') {
                    const { msg, extId } = event.data;
                    listeners.forEach(fn => {
                        try { fn(msg, { id: extId }, function(){}); } catch(e) {}
                    });
                }
            });
        } catch(e) {}
    }

    function patchChromeTabs() {
        try {
            setupRuntimeBridge();
            if (typeof chrome === 'undefined' || !chrome || !chrome.tabs) return false
            if (chrome.tabs.__centrio_patched) return true

            const origQuery      = chrome.tabs.query.bind(chrome.tabs)
            const origGetCurrent = chrome.tabs.getCurrent?.bind(chrome.tabs)
            const origGet        = chrome.tabs.get?.bind(chrome.tabs)

            // ── chrome.tabs.query ─────────────────────────────────────────
            chrome.tabs.query = function (queryInfo, callback) {
                const resolve = async () => {
                    // 1. Try native first
                    const native = await callOrigQuery(origQuery, queryInfo)
                    if (native && native.length > 0) return native

                    // 2. Fall back to our registry
                    let registryTabs = []
                    try {
                        const raw = await ipcRenderer.invoke('ext:tabs:list')
                        if (Array.isArray(raw) && raw.length > 0) {
                            registryTabs = raw.map(buildChromeTab)
                        }
                    } catch { /* IPC not ready yet */ }

                    if (!registryTabs.length) return []

                    // currentWindow: return only the active tab
                    if (queryInfo.currentWindow === true) {
                        const active = registryTabs.filter(t => t.active)
                        if (active.length) return filterTabs(active, { ...queryInfo, currentWindow: undefined })
                        // No active yet — retry without currentWindow filter
                        return filterTabs(registryTabs, { ...queryInfo, currentWindow: undefined })
                    }

                    return filterTabs(registryTabs, queryInfo)
                }

                if (typeof callback === 'function') {
                    resolve().then(result => callback(result)).catch(() => callback([]))
                } else {
                    return resolve()
                }
            }

            // ── chrome.tabs.getCurrent ────────────────────────────────────
            if (origGetCurrent) {
                chrome.tabs.getCurrent = function (callback) {
                    const resolve = async () => {
                        // Try native first
                        let native
                        try {
                            native = await new Promise(res => origGetCurrent(res))
                        } catch { native = undefined }
                        if (native) return native

                        // Fall back to registry active tab
                        try {
                            const raw = await ipcRenderer.invoke('ext:tabs:getActive')
                            if (raw) return buildChromeTab(raw)
                        } catch {}
                        return undefined
                    }

                    if (typeof callback === 'function') {
                        resolve().then(callback).catch(() => callback(undefined))
                    } else {
                        return resolve()
                    }
                }
            }

            // ── chrome.tabs.get ───────────────────────────────────────────
            if (origGet) {
                chrome.tabs.get = function (tabId, callback) {
                    const resolve = async () => {
                        // Try native first
                        let native
                        try {
                            native = await new Promise((res, rej) =>
                                origGet(tabId, t => t ? res(t) : rej()))
                        } catch { native = undefined }
                        if (native) return native

                        // Search our registry
                        try {
                            const raw = await ipcRenderer.invoke('ext:tabs:list')
                            const match = (raw || []).find(t => t.id === tabId)
                            if (match) return buildChromeTab(match)
                        } catch {}
                        return undefined
                    }

                    if (typeof callback === 'function') {
                        resolve().then(callback).catch(() => callback(undefined))
                    } else {
                        return resolve()
                    }
                }
            }

            chrome.tabs.__centrio_patched = true
            // console.log('[centrio] chrome.tabs patched ✓')
            return true
        } catch {
            return false
        }
    }

    // Try immediately then retry with back-off.
    // Extension API bindings are normally available by the time preloads run,
    // but retry just in case Electron sets them up slightly later.
    if (!patchChromeTabs()) {
        for (const delay of [0, 50, 100, 200, 400, 800]) {
            setTimeout(patchChromeTabs, delay)
        }
    }
})()
