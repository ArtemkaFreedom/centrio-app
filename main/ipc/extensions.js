const { ipcMain } = require('electron')
const {
    installExtension,
    uninstallExtension,
    toggleExtension,
    loadIntoPartition,
    getInstalledList,
    openViaBridge
} = require('../services/extensions')
const registry = require('../ext-tabs-registry')

let log
try { log = require('electron-log') } catch { log = console }

function safe(channel, handler) {
    try { ipcMain.removeHandler(channel) } catch {}
    ipcMain.handle(channel, handler)
}

function registerExtensionsIpc() {
    safe('ext:list', async () => {
        try {
            return { success: true, data: getInstalledList() }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:install', async (_, id) => {
        try {
            const manifest = await installExtension(id)
            return { success: true, manifest }
        } catch (e) {
            console.error('[ext] install error:', e.message)
            return { success: false, error: e.message }
        }
    })

    safe('ext:uninstall', async (_, id) => {
        try {
            uninstallExtension(id)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:toggle', async (_, id, enabled) => {
        try {
            await toggleExtension(id, enabled)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:apply-to-session', async (_, partition) => {
        try {
            await loadIntoPartition(partition)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    // ── Tab registry — used by the ext-api-preload session script ─────────────
    // These let the chrome.tabs polyfill answer queries about "real" open tabs
    // (messenger webviews) so extension popups get meaningful tab data.

    safe('ext:tabs:register', async (_, messengerId, partition, url, title) => {
        try {
            registry.registerTab(messengerId, partition, url, title)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:tabs:activate', async (_, messengerId) => {
        try {
            registry.activateTab(messengerId)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:tabs:update', async (_, messengerId, info) => {
        try {
            registry.updateTab(messengerId, info)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:tabs:unregister', async (_, messengerId) => {
        try {
            registry.unregisterTab(messengerId)
            return { success: true }
        } catch (e) {
            return { success: false, error: e.message }
        }
    })

    safe('ext:tabs:list', async () => {
        try {
            return registry.getTabs()
        } catch {
            return []
        }
    })

    safe('ext:tabs:getActive', async () => {
        try {
            const t = registry.getActiveTab()
            if (!t) return null
            // Return a proper Chrome Tab object that extensions expect
            return {
                id:          t.id    || 1,
                index:       t.index || 0,
                windowId:    1,
                highlighted: true,
                active:      true,
                pinned:      false,
                incognito:   false,
                selected:    true,
                url:         t.url   || '',
                title:       t.title || t.url || '',
                status:      'complete',
                favIconUrl:  '',
            }
        } catch {
            return null
        }
    })

    // ── Open extension popup via MV2 bridge ───────────────────────────────────
    // Renderer sends url + {width, height} here instead of calling window.open()
    // directly (which is blocked by ExtensionNavigationThrottle from web origins).
    // We call window._centrioOpenPopup() on the bridge background page whose
    // origin is chrome-extension://bridgeId → throttle allows the navigation.
    safe('ext:open-popup-bridge', async (_, url, opts = {}) => {
        try {
            if (!url || !url.startsWith('chrome-extension://')) {
                return { success: false, error: 'not an extension URL' }
            }
            const ok = await openViaBridge(url, opts.width || 400, opts.height || 600)
            return { success: ok }
        } catch (e) {
            log.error('[ext-bridge] IPC error:', e.message)
            return { success: false, error: e.message }
        }
    })
}

module.exports = registerExtensionsIpc
