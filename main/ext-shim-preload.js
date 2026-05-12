/**
 * ext-shim-preload.js — chrome.* API shims for centrio-ext:// pages.
 *
 * Runs as a session preload on persist:ext-popup. Activates only on
 * centrio-ext:// origins (extension popups served via custom protocol).
 *
 * Strategy:
 *   1. Synchronously fetch manifest + i18n messages via ipcRenderer.sendSync
 *      so the shim has full data before any page scripts run.
 *   2. Inject shims into the main world via webFrame.executeJavaScript.
 *      Provides chrome.runtime, chrome.extension, chrome.i18n, chrome.storage,
 *      chrome.tabs (basic), chrome.action / browserAction (no-op).
 *   3. chrome.storage proxies to main process Store via async IPC.
 */
'use strict'

const { contextBridge, ipcRenderer, webFrame } = require('electron')

if (!location.protocol.startsWith('centrio-ext')) {
    // Not our scheme — do nothing (other preloads on this session run independently)
} else {
    try {
        const extId = location.hostname
        console.error('[centrio-shim] preload start, extId=' + extId + ' href=' + location.href)

        // ── Step 1: synchronously load manifest + messages ──────────────────
        const boot = ipcRenderer.sendSync('ext-shim:bootstrap', extId) || {}
        const manifest = boot.manifest || {}
        const messages = boot.messages || {}
        const locale   = boot.locale   || 'en'

        // ── Step 2: expose async IPC for storage/sendMessage ────────────────
        contextBridge.exposeInMainWorld('__centrioExtShim', {
            extId,
            storageGet:    (area, keys) => ipcRenderer.invoke('ext-shim:storage:get',    extId, area, keys),
            storageSet:    (area, items)=> ipcRenderer.invoke('ext-shim:storage:set',    extId, area, items),
            storageRemove: (area, keys) => ipcRenderer.invoke('ext-shim:storage:remove', extId, area, keys),
            storageClear:  (area)       => ipcRenderer.invoke('ext-shim:storage:clear',  extId, area),
            sendMessage:   (msg)        => ipcRenderer.invoke('ext-shim:sendMessage',    extId, msg),
        })

        // ── Step 3: inject shims into main world ────────────────────────────
        const shim = `(function(){
            'use strict';
            var EXT_ID = ${JSON.stringify(extId)};
            var BASE   = 'centrio-ext://' + EXT_ID + '/';
            var MANIFEST = ${JSON.stringify(manifest)};
            var MESSAGES = ${JSON.stringify(messages)};
            var LOCALE = ${JSON.stringify(locale)};

            if (typeof chrome === 'undefined' || chrome === null) {
                try { window.chrome = {}; } catch(_) {}
            }
            var c = window.chrome;

            function noop(){}
            function evt(){
                return {
                    addListener: noop,
                    removeListener: noop,
                    hasListener: function(){ return false; },
                    hasListeners: function(){ return false; }
                };
            }

            // ── chrome.runtime ──────────────────────────────────────────────
            if (!c.runtime) c.runtime = {};
            c.runtime.id = EXT_ID;
            c.runtime.lastError = undefined;
            c.runtime.getURL = function(p){
                p = String(p == null ? '' : p);
                return BASE + p.replace(/^\\/+/, '');
            };
            c.runtime.getManifest = function(){
                try { return JSON.parse(JSON.stringify(MANIFEST)); } catch(_) { return MANIFEST; }
            };
            c.runtime.getPlatformInfo = function(cb){
                var info = { os: 'win', arch: 'x86-64', nacl_arch: 'x86-64' };
                if (typeof cb === 'function') cb(info);
                return Promise.resolve(info);
            };
            c.runtime.onMessage = c.runtime.onMessage || evt();
            c.runtime.onConnect = c.runtime.onConnect || evt();
            c.runtime.onInstalled = c.runtime.onInstalled || evt();
            c.runtime.onStartup = c.runtime.onStartup || evt();
            c.runtime.onSuspend = c.runtime.onSuspend || evt();
            c.runtime.onMessageExternal = c.runtime.onMessageExternal || evt();

            c.runtime.sendMessage = function(){
                var args = Array.prototype.slice.call(arguments);
                var cb = (typeof args[args.length-1] === 'function') ? args.pop() : null;
                var msg = args.length > 1 ? args[1] : args[0];
                try {
                    window.__centrioExtShim.sendMessage(msg)
                        .then(function(r){ if (cb) try{ cb(r); }catch(_){} })
                        .catch(function(){ if (cb) try{ cb(undefined); }catch(_){} });
                } catch(e) {
                    if (cb) try{ cb(undefined); }catch(_){}
                }
                return Promise.resolve(undefined);
            };
            c.runtime.connect = function(){
                return {
                    name: '',
                    postMessage: noop,
                    disconnect: noop,
                    onMessage: evt(),
                    onDisconnect: evt()
                };
            };
            c.runtime.connectNative = c.runtime.connectNative || function(){ return c.runtime.connect(); };
            c.runtime.openOptionsPage = function(cb){
                var url = MANIFEST.options_page || (MANIFEST.options_ui && MANIFEST.options_ui.page);
                if (url) { window.open(BASE + url.replace(/^\\/+/, ''), '_blank'); }
                if (typeof cb === 'function') cb();
            };

            // ── chrome.extension (legacy) ───────────────────────────────────
            // getBackgroundPage returns a deep-Proxy: any property access returns
            // another Proxy, any call returns a Proxy, etc. This prevents extensions
            // (e.g. AdBlock: bg.settings.X) from crashing on undefined access.
            // Values read this way are meaningless — but the popup at least renders
            // and the user sees its UI. Real values arrive via sendMessage forward.
            function deepProxy(){
                var fn = function(){};
                return new Proxy(fn, {
                    get: function(_t, k){
                        if (k === Symbol.toPrimitive) return function(){ return ''; };
                        if (k === 'then' || k === 'catch' || k === 'finally') return undefined;
                        if (k === Symbol.iterator) return function*(){};
                        if (k === 'toString' || k === 'valueOf') return function(){ return ''; };
                        if (k === 'length') return 0;
                        return deepProxy();
                    },
                    apply: function(){ return deepProxy(); },
                    construct: function(){ return deepProxy(); },
                    has: function(){ return false; }
                });
            }
            if (!c.extension) c.extension = {};
            c.extension.getURL = c.runtime.getURL;
            c.extension.inIncognitoContext = false;
            c.extension.getBackgroundPage = function(){ return deepProxy(); };
            c.extension.getViews = function(){ return []; };
            c.extension.isAllowedIncognitoAccess = function(cb){ if(cb) cb(false); return Promise.resolve(false); };
            c.extension.isAllowedFileSchemeAccess = function(cb){ if(cb) cb(false); return Promise.resolve(false); };

            // chrome.runtime.getBackgroundPage (MV2 form): callback or Promise
            c.runtime.getBackgroundPage = function(cb){
                var p = deepProxy();
                if (typeof cb === 'function') cb(p);
                return Promise.resolve(p);
            };

            // ── chrome.i18n ─────────────────────────────────────────────────
            if (!c.i18n) c.i18n = {};
            c.i18n.getMessage = function(key, subs){
                if (!key) return '';
                var entry = MESSAGES[key];
                if (!entry) {
                    // Built-in messages
                    if (key === '@@extension_id') return EXT_ID;
                    if (key === '@@ui_locale')   return LOCALE;
                    if (key === '@@bidi_dir')    return 'ltr';
                    return '';
                }
                var s = entry.message || '';
                if (subs == null) return s;
                var arr = Array.isArray(subs) ? subs : [subs];
                return s.replace(/\\$(\\d+)/g, function(_, n){
                    var i = parseInt(n, 10) - 1;
                    return arr[i] != null ? String(arr[i]) : '';
                }).replace(/\\$\\$/g, '$');
            };
            c.i18n.getUILanguage = function(){ return LOCALE.replace('_','-'); };
            c.i18n.getAcceptLanguages = function(cb){
                var langs = [LOCALE.replace('_','-')];
                if (typeof cb === 'function') cb(langs);
                return Promise.resolve(langs);
            };
            c.i18n.detectLanguage = function(_text, cb){
                var r = { isReliable: false, languages: [] };
                if (typeof cb === 'function') cb(r);
                return Promise.resolve(r);
            };

            // ── chrome.storage ──────────────────────────────────────────────
            if (!c.storage) c.storage = {};
            function makeArea(area){
                return {
                    get: function(keys, cb){
                        var k = (typeof keys === 'function') ? null : keys;
                        var fn = (typeof keys === 'function') ? keys : cb;
                        var p = window.__centrioExtShim.storageGet(area, k);
                        if (typeof fn === 'function') p.then(function(r){ try{ fn(r||{}); }catch(_){} }, function(){ try{ fn({}); }catch(_){} });
                        return p;
                    },
                    set: function(items, cb){
                        var p = window.__centrioExtShim.storageSet(area, items || {});
                        if (typeof cb === 'function') p.then(function(){ try{ cb(); }catch(_){} }, function(){ try{ cb(); }catch(_){} });
                        return p;
                    },
                    remove: function(keys, cb){
                        var p = window.__centrioExtShim.storageRemove(area, keys);
                        if (typeof cb === 'function') p.then(function(){ try{ cb(); }catch(_){} }, function(){ try{ cb(); }catch(_){} });
                        return p;
                    },
                    clear: function(cb){
                        var p = window.__centrioExtShim.storageClear(area);
                        if (typeof cb === 'function') p.then(function(){ try{ cb(); }catch(_){} }, function(){ try{ cb(); }catch(_){} });
                        return p;
                    },
                    onChanged: evt(),
                    QUOTA_BYTES: 5242880
                };
            }
            c.storage.local   = c.storage.local   || makeArea('local');
            c.storage.sync    = c.storage.sync    || makeArea('sync');
            c.storage.session = c.storage.session || makeArea('session');
            c.storage.managed = c.storage.managed || (function(){ var a=makeArea('managed'); a.get=function(_,cb){ if(cb) cb({}); return Promise.resolve({}); }; return a; })();
            c.storage.onChanged = c.storage.onChanged || evt();

            // ── chrome.tabs (very minimal — preserved by ext-popup-preload patch) ──
            if (!c.tabs) c.tabs = {};
            if (!c.tabs.query)      c.tabs.query      = function(_q, cb){ if(cb) cb([]); return Promise.resolve([]); };
            if (!c.tabs.getCurrent) c.tabs.getCurrent = function(cb){ if(cb) cb(undefined); return Promise.resolve(undefined); };
            if (!c.tabs.get)        c.tabs.get        = function(_id, cb){ if(cb) cb(undefined); return Promise.resolve(undefined); };
            if (!c.tabs.sendMessage)c.tabs.sendMessage= function(){ return Promise.resolve(undefined); };
            if (!c.tabs.create)     c.tabs.create     = function(opts){ if(opts && opts.url) try{ window.open(opts.url, '_blank'); }catch(_){} return Promise.resolve({}); };
            if (!c.tabs.update)     c.tabs.update     = function(){ return Promise.resolve({}); };
            if (!c.tabs.executeScript) c.tabs.executeScript = function(_id, _det, cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.tabs.onUpdated = c.tabs.onUpdated || evt();
            c.tabs.onActivated = c.tabs.onActivated || evt();
            c.tabs.onRemoved = c.tabs.onRemoved || evt();
            c.tabs.TAB_ID_NONE = -1;

            // ── chrome.windows (stub) ───────────────────────────────────────
            if (!c.windows) c.windows = {};
            c.windows.getCurrent = c.windows.getCurrent || function(cb){ var w={id:1,focused:true}; if(cb) cb(w); return Promise.resolve(w); };
            c.windows.create     = c.windows.create     || function(opts, cb){ if(opts && opts.url) try{ window.open(opts.url,'_blank'); }catch(_){} var w={id:Date.now()}; if(cb) cb(w); return Promise.resolve(w); };
            c.windows.WINDOW_ID_CURRENT = -2;

            // ── chrome.action / browserAction / pageAction ──────────────────
            ['action','browserAction','pageAction'].forEach(function(ns){
                if (!c[ns]) c[ns] = {};
                ['setIcon','setBadgeText','setBadgeBackgroundColor','setBadgeTextColor',
                 'setTitle','setPopup','enable','disable','show','hide']
                    .forEach(function(m){ if (!c[ns][m]) c[ns][m] = function(){ return Promise.resolve(); }; });
                c[ns].onClicked = c[ns].onClicked || evt();
                c[ns].getTitle  = c[ns].getTitle  || function(_, cb){ if(cb) cb(''); return Promise.resolve(''); };
                c[ns].getBadgeText = c[ns].getBadgeText || function(_, cb){ if(cb) cb(''); return Promise.resolve(''); };
            });

            // ── chrome.permissions (stub: always granted to avoid blocking UI) ──
            if (!c.permissions) c.permissions = {};
            c.permissions.contains = function(_p, cb){ if(cb) cb(true); return Promise.resolve(true); };
            c.permissions.request  = function(_p, cb){ if(cb) cb(true); return Promise.resolve(true); };
            c.permissions.getAll   = function(cb){ var r={permissions:[],origins:[]}; if(cb) cb(r); return Promise.resolve(r); };
            c.permissions.onAdded   = c.permissions.onAdded   || evt();
            c.permissions.onRemoved = c.permissions.onRemoved || evt();

            // ── chrome.scripting (MV3 stub) ─────────────────────────────────
            if (!c.scripting) c.scripting = {};
            c.scripting.executeScript = function(_opts, cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.scripting.insertCSS = function(_opts, cb){ if(cb) cb(); return Promise.resolve(); };
            c.scripting.removeCSS = function(_opts, cb){ if(cb) cb(); return Promise.resolve(); };
            c.scripting.registerContentScripts = function(_s, cb){ if(cb) cb(); return Promise.resolve(); };
            c.scripting.unregisterContentScripts = function(_f, cb){ if(cb) cb(); return Promise.resolve(); };
            c.scripting.getRegisteredContentScripts = function(_f, cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.scripting.updateContentScripts = function(_s, cb){ if(cb) cb(); return Promise.resolve(); };

            // ── chrome.declarativeNetRequest (stub for adblockers) ──────────
            if (!c.declarativeNetRequest) c.declarativeNetRequest = {};
            c.declarativeNetRequest.getDynamicRules = function(cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.declarativeNetRequest.getSessionRules = function(cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.declarativeNetRequest.getEnabledRulesets = function(cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.declarativeNetRequest.updateDynamicRules = function(_o, cb){ if(cb) cb(); return Promise.resolve(); };
            c.declarativeNetRequest.updateSessionRules = function(_o, cb){ if(cb) cb(); return Promise.resolve(); };
            c.declarativeNetRequest.updateEnabledRulesets = function(_o, cb){ if(cb) cb(); return Promise.resolve(); };
            c.declarativeNetRequest.getMatchedRules = function(_f, cb){ var r={rulesMatchedInfo:[]}; if(typeof _f==='function'){ _f(r); } else if(cb) cb(r); return Promise.resolve(r); };
            c.declarativeNetRequest.onRuleMatchedDebug = evt();

            // ── chrome.webRequest (stub) ────────────────────────────────────
            if (!c.webRequest) c.webRequest = {};
            ['onBeforeRequest','onBeforeSendHeaders','onSendHeaders','onHeadersReceived',
             'onAuthRequired','onResponseStarted','onBeforeRedirect','onCompleted',
             'onErrorOccurred','onActionIgnored'].forEach(function(n){
                c.webRequest[n] = c.webRequest[n] || evt();
            });
            c.webRequest.handlerBehaviorChanged = function(cb){ if(cb) cb(); return Promise.resolve(); };

            // ── chrome.alarms (stub) ────────────────────────────────────────
            if (!c.alarms) c.alarms = {};
            c.alarms.create = function(){};
            c.alarms.get = function(_n, cb){ if(typeof _n==='function'){ _n(undefined); } else if(cb) cb(undefined); return Promise.resolve(undefined); };
            c.alarms.getAll = function(cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.alarms.clear = function(_n, cb){ if(typeof _n==='function'){ _n(true); } else if(cb) cb(true); return Promise.resolve(true); };
            c.alarms.clearAll = function(cb){ if(cb) cb(true); return Promise.resolve(true); };
            c.alarms.onAlarm = evt();

            // ── chrome.idle (stub) ──────────────────────────────────────────
            if (!c.idle) c.idle = {};
            c.idle.queryState = function(_t, cb){ if(cb) cb('active'); return Promise.resolve('active'); };
            c.idle.setDetectionInterval = function(){};
            c.idle.onStateChanged = evt();

            // ── chrome.commands (stub) ──────────────────────────────────────
            if (!c.commands) c.commands = {};
            c.commands.getAll = function(cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.commands.onCommand = evt();

            // ── chrome.cookies (stub) ───────────────────────────────────────
            if (!c.cookies) c.cookies = {};
            c.cookies.get = function(_d, cb){ if(cb) cb(null); return Promise.resolve(null); };
            c.cookies.getAll = function(_d, cb){ if(cb) cb([]); return Promise.resolve([]); };
            c.cookies.set = function(_d, cb){ if(cb) cb(null); return Promise.resolve(null); };
            c.cookies.remove = function(_d, cb){ if(cb) cb(null); return Promise.resolve(null); };
            c.cookies.onChanged = evt();

            // ── chrome.contextMenus (stub) ──────────────────────────────────
            if (!c.contextMenus) c.contextMenus = {};
            c.contextMenus.create = c.contextMenus.create || function(){ return 0; };
            c.contextMenus.update = c.contextMenus.update || function(){};
            c.contextMenus.remove = c.contextMenus.remove || function(){};
            c.contextMenus.removeAll = c.contextMenus.removeAll || function(cb){ if(cb) cb(); };
            c.contextMenus.onClicked = c.contextMenus.onClicked || evt();

            // ── chrome.notifications (stub) ─────────────────────────────────
            if (!c.notifications) c.notifications = {};
            c.notifications.create = c.notifications.create || function(_, __, cb){ if(typeof _==='function') _(''); else if(cb) cb(''); return Promise.resolve(''); };
            c.notifications.clear  = c.notifications.clear  || function(){ return Promise.resolve(true); };
            c.notifications.onClicked = c.notifications.onClicked || evt();
            c.notifications.onClosed = c.notifications.onClosed || evt();

            console.error('[centrio-shim] chrome.* installed for ' + EXT_ID +
                ' (manifest=' + (MANIFEST.name||'?') + ' v' + (MANIFEST.version||'?') +
                ', messages=' + Object.keys(MESSAGES).length + ')');
        })();`

        webFrame.executeJavaScript(shim)
            .then(() => console.error('[centrio-shim] injected OK for ' + extId))
            .catch(e => console.error('[centrio-shim] injection failed: ' + e.message))
    } catch (e) {
        try { console.error('[centrio-shim] preload error: ' + e.message) } catch (_) {}
    }
}
