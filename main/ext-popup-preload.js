/**
 * ext-popup-preload.js — preload for extension popup BrowserWindows.
 *
 * Runs in the ISOLATED world (contextIsolation: true).
 *
 * Architecture (same as electron-chrome-extensions / Rambox):
 *
 *   1. contextBridge.exposeInMainWorld() — exposes an async IPC function
 *      '__centrioGetTab' into the main world so the patch script can
 *      call back to the main process at runtime.
 *
 *   2. webFrame.executeJavaScript() — injects a self-contained closure into
 *      the MAIN world (where chrome.* lives) at document-start, before any
 *      extension scripts run.  The closure patches chrome.tabs.query to:
 *        a) filter out chrome-extension:// "self" tabs that Electron returns
 *           (the popup registers itself as a tab in the extension host)
 *        b) fall back to __centrioGetTab() (IPC → main-process registry)
 *           when native results are empty or useless.
 */
'use strict'

const { contextBridge, ipcRenderer, webFrame } = require('electron')

// Only activate for extension pages (chrome-extension:// or our centrio-ext:// scheme)
if (!location.href.startsWith('chrome-extension://') &&
    !location.href.startsWith('centrio-ext://')) return

console.error('[centrio-preload] loaded, location=' + location.href)

// ── Step 1: expose IPC bridge to the main world ──────────────────────────────
// contextBridge.exposeInMainWorld is synchronous — window.__centrioGetTab
// is available in the main world before any page scripts run.
try {
    contextBridge.exposeInMainWorld('__centrioGetTab', function () {
        return ipcRenderer.invoke('ext:tabs:getActive')
    })
    console.error('[centrio-preload] __centrioGetTab exposed OK')
} catch (e) {
    console.error('[centrio-preload] exposeInMainWorld failed: ' + e.message)
}

// ── Step 2: patch chrome.tabs in the main world ───────────────────────────────
// webFrame.executeJavaScript() injects into the MAIN world.
// Called from a preload at document-start it executes before page scripts —
// the same technique used by electron-chrome-extensions / Rambox.
const mainWorldPatch = `(function () {
    'use strict';

    function isReal(t) {
        return t && t.url &&
            t.url.indexOf('chrome-extension://') !== 0 &&
            t.url !== 'about:blank' &&
            t.url !== 'about:newtab';
    }

    function fromRegistry() {
        try {
            if (typeof window.__centrioGetTab === 'function') {
                return window.__centrioGetTab()
                    .then(function (t) { return t ? [t] : []; })
                    .catch(function () { return []; });
            }
        } catch (_) {}
        return Promise.resolve([]);
    }

    function patch() {
        if (typeof chrome === 'undefined' || !chrome || !chrome.tabs || !chrome.tabs.query) return false;
        if (chrome.tabs.query.__cp) return true;

        var _oq = chrome.tabs.query.bind(chrome.tabs);

        function runNative(qi) {
            return new Promise(function (res) {
                try {
                    _oq(qi, function (tabs) { res((tabs || []).filter(isReal)); });
                } catch (_) { res([]); }
            });
        }

        function patched(qi, cb) {
            var go = function () {
                return runNative(qi).then(function (r1) {
                    if (r1.length) return r1;
                    if (qi && qi.currentWindow) {
                        var q2 = {};
                        for (var k in qi) if (k !== 'currentWindow') q2[k] = qi[k];
                        return runNative(q2).then(function (r2) {
                            return r2.length ? r2 : fromRegistry();
                        });
                    }
                    return fromRegistry();
                });
            };
            if (typeof cb === 'function') {
                go().then(cb).catch(function () { cb([]); });
            } else {
                return go();
            }
        }

        patched.__cp = true;
        try {
            Object.defineProperty(chrome.tabs, 'query', { value: patched, writable: true, configurable: true });
        } catch (_) {
            try { chrome.tabs.query = patched; } catch (_2) {}
        }

        if (chrome.tabs.getCurrent) {
            chrome.tabs.getCurrent = function (cb) {
                var go = fromRegistry().then(function (tabs) { return tabs[0] || undefined; });
                if (typeof cb === 'function') go.then(cb).catch(function () { cb(undefined); });
                else return go;
            };
        }

        return !!chrome.tabs.query.__cp;
    }

    var ok = patch();
    console.error('[centrio-patch] initial patch=' + ok + ' chrome=' + (typeof chrome));
    if (!ok) {
        [0, 50, 150, 400, 800].forEach(function (d) { setTimeout(patch, d); });
    }
})()`

webFrame.executeJavaScript(mainWorldPatch)
    .then(function() { console.error('[centrio-preload] mainWorldPatch injected OK') })
    .catch(function(e) { console.error('[centrio-preload] mainWorldPatch failed: ' + e) })
