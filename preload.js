const { contextBridge, ipcRenderer } = require('electron')

const validReceiveChannels = new Set([
    'app-hidden',
    'update-available',
    'update-downloaded',
    'update-error',
    'download-progress',
    'switch-messenger-index',
    'switch-messenger-next',
    'switch-messenger-prev',
    'reload-active',
    'open-settings',
    'notification-clicked-id',
    'update-status',
    'ext:show-popup',
    'vpn-restored',
    'show-lock-screen',
    'deep-link-route',
    'oauth-popup-done',
    'downloads:item-update',
    'auto-launch-result',
    'messenger-unread-count',
    'messenger-site-notification',
    'app-notifs:item-update',
    'app-quitting'
])

const invokeChannelMap = {
    'app:checkForUpdates': 'app:checkForUpdates',
    'dialog:selectDirectory': 'dialog:selectDirectory',
    'install-update': 'install-update'
}

const sendChannelMap = {
    'set-app-zoom': 'set-app-zoom',
    'open-url': 'open-url'
}

// SECURITY: enforced allowlists for the generic electronAPI.invoke()/send() passthrough
// used by renderer.js's legacy ipcRenderer shim. Without this, any channel string
// reachable from renderer JS (e.g. via a compromised webview/renderer or a bug in a
// bundled dependency) could invoke/send to ANY ipcMain handler, including ones never
// intended to be reachable from the renderer. Mirrors the existing validReceiveChannels
// pattern above. Built from the full set of ipcMain.handle()/ipcMain.on() registrations
// in main.js and main/ipc/*.js — keep in sync when adding new IPC handlers.
const validInvokeChannels = new Set([
    // main.js
    'store:get', 'store:set', 'store:clear-all', 'store:delete',
    'store:secure-set', 'store:secure-get', 'store:secure-delete',
    // main/ipc/api.js
    'get-webview-preload-path', 'api-login', 'api-register', 'api-me', 'api-refresh',
    'api-sync-push', 'api-sync-pull', 'api-update-profile', 'api-get-stats', 'api-logout',
    'api-get-notifications', 'api-read-all-notifications', 'api-yandex-desktop', 'api-vk-desktop',
    'tracker:service-time', 'tracker:msg-sent', 'tracker:notif', 'tracker:msg-received',
    // main/ipc/vpn.js
    'vpn-status', 'vpn-connect', 'vpn-download-and-connect', 'vpn-connect-saved',
    'vpn-disconnect', 'vpn-ping', 'vpn-delete-config', 'vpn-get-subscription',
    'vpn-refresh-subscription', 'vpn-get-app-modes', 'vpn-set-app-vpn',
    // main/ipc/autoLaunch.js
    'get-auto-launch',
    // main/ipc/oauth.js
    'oauth-google', 'oauth-yandex',
    // main/ipc/proxy.js
    'apply-global-proxy', 'apply-messenger-proxy', 'test-proxy',
    // main/ipc/screenshot.js
    'screenshot:capture',
    // main/ipc/window.js
    'open-popup-window', 'get-window-visibility-state', 'app:getVersion',
    'security:hash-pin', 'security:verify-pin',
    // main/ipc/downloads.js
    'choose-download-dir', 'dialog:selectDirectory', 'get-save-image-path',
    'copy-image-to-clipboard', 'copy-text-to-clipboard',
    'downloads:get-history', 'downloads:open-file', 'downloads:read-file-bytes',
    // main/ipc/appNotifications.js
    'app-notifs:get-history',
    // main/ipc/weather.js
    'weather:get',
    // main/ipc/updater.js
    'install-update', 'check-for-updates', 'app:checkForUpdates',
    // main/ipc/settingsPortability.js
    'settings:export', 'settings:import',
    // main/ipc/extensions.js
    'ext:list', 'ext:install', 'ext:uninstall', 'ext:toggle', 'ext:apply-to-session',
    // main/ipc/lockBackground.js
    'lock-bg:get', 'lock-bg:set-preset', 'lock-bg:clear', 'lock-bg:choose-custom'
])

const validSendChannels = new Set([
    // main.js
    'renderer-error-log', 'update-tray-menu',
    // main/ipc/api.js
    'update-adblock-state',
    // main/ipc/notifications.js
    'show-notification',
    // main/ipc/badge.js
    'update-badge', 'tray:update-menu', 'notification-clicked',
    // main/ipc/autoLaunch.js
    'set-auto-launch',
    // main/ipc/sound.js
    'play-sound',
    // main/ipc/window.js
    'minimize-window', 'maximize-window', 'close-window', 'quit-app', 'hide-window',
    'toggle-fullscreen', 'set-app-zoom', 'open-url', 'open-translate-window',
    // main/ipc/downloads.js
    'set-download-dir', 'set-ask-download', 'save-page', 'save-image-data',
    'downloads:show-in-folder', 'downloads:remove', 'downloads:clear',
    // main/ipc/appNotifications.js
    'app-notifs:add', 'app-notifs:mark-all-read', 'app-notifs:remove', 'app-notifs:clear',
    // main/ipc/notifications.js — сигнал "экран блокировки активен/неактивен",
    // чтобы main-процесс подавлял OS-уведомления, пока лок-скрин на экране
    'lock:set-state',
    // main/bootstrap/registerAppEvents.js — ack that lets before-quit stop
    // waiting on the renderer's quit-time cloud sync flush (see app-quitting)
    'app-quitting-flushed'
])

function mapInvokeChannel(channel) {
    return invokeChannelMap[channel] || channel
}

function mapSendChannel(channel) {
    return sendChannelMap[channel] || channel
}

function normalizePayload(channel, args) {
    if (channel === 'update-status') {
        const data = args[0]

        if (!data || typeof data !== 'object') {
            console.warn(`[preload] Invalid payload for channel "${channel}":`, data)
            return [{ status: 'unknown' }]
        }

        return [data]
    }

    return args
}

const electronAPI = {
    platform: process.platform,

    storeGet: (key, def) => ipcRenderer.invoke('store:get', key, def),
    storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
    storeDelete: (key) => ipcRenderer.invoke('store:delete', key),

    // Encrypted storage — backed by OS-level safeStorage (DPAPI/Keychain/libsecret)
    storeSecureGet: (key, def) => ipcRenderer.invoke('store:secure-get', key, def),
    storeSecureSet: (key, value) => ipcRenderer.invoke('store:secure-set', key, value),
    storeSecureDelete: (key) => ipcRenderer.invoke('store:secure-delete', key),

    getWebviewPreloadPath: () => ipcRenderer.invoke('get-webview-preload-path'),

    invoke: (channel, ...args) => {
        const mapped = mapInvokeChannel(channel)
        if (!validInvokeChannels.has(mapped)) {
            console.warn(`[preload] Blocked invoke to channel: ${channel}`)
            return Promise.reject(new Error(`Blocked invoke to channel: ${channel}`))
        }
        return ipcRenderer.invoke(mapped, ...args)
    },

    send: (channel, ...args) => {
        const mapped = mapSendChannel(channel)
        if (!validSendChannels.has(mapped)) {
            console.warn(`[preload] Blocked send to channel: ${channel}`)
            return
        }
        return ipcRenderer.send(mapped, ...args)
    },

    on: (channel, listener) => {
        if (!validReceiveChannels.has(channel)) {
            console.warn(`[preload] Blocked subscription to channel: ${channel}`)
            return () => {}
        }

        if (typeof listener !== 'function') {
            console.warn(`[preload] Listener for channel "${channel}" is not a function`)
            return () => {}
        }

        const wrapped = (_event, ...args) => {
            try {
                const normalizedArgs = normalizePayload(channel, args)
                listener(...normalizedArgs)
            } catch (error) {
                console.error(`[preload] Error while handling channel "${channel}":`, error)
            }
        }

        ipcRenderer.on(channel, wrapped)

        return () => {
            ipcRenderer.removeListener(channel, wrapped)
        }
    },

    once: (channel, listener) => {
        if (!validReceiveChannels.has(channel)) {
            console.warn(`[preload] Blocked one-time subscription to channel: ${channel}`)
            return
        }

        if (typeof listener !== 'function') {
            console.warn(`[preload] One-time listener for channel "${channel}" is not a function`)
            return
        }

        ipcRenderer.once(channel, (_event, ...args) => {
            try {
                const normalizedArgs = normalizePayload(channel, args)
                listener(...normalizedArgs)
            } catch (error) {
                console.error(`[preload] Error while handling one-time channel "${channel}":`, error)
            }
        })
    },

    removeAllListeners: (channel) => {
        if (!validReceiveChannels.has(channel)) return
        ipcRenderer.removeAllListeners(channel)
    },

    onUpdateStatus: (listener) => {
        if (typeof listener !== 'function') return () => {}
        return electronAPI.on('update-status', listener)
    },

    installUpdate: () => ipcRenderer.invoke('install-update'),

    setAppZoom: (value) => ipcRenderer.send('set-app-zoom', value),
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    openExternal: (url) => ipcRenderer.send('open-url', url),

    exportSettings: () => ipcRenderer.invoke('settings:export'),
    importSettings: () => ipcRenderer.invoke('settings:import'),

    // VPN progress events
    onVpnProgress: (listener) => {
        let handler = null
        if (typeof listener === 'function') {
            handler = (_event, data) => listener(data)
            ipcRenderer.on('vpn-download-progress', handler)
        }
        return handler
    },
    offVpnProgress: () => {
        ipcRenderer.removeAllListeners('vpn-download-progress')
    },

    // Extensions
    extList:           ()         => ipcRenderer.invoke('ext:list'),
    extInstall:        (id)       => ipcRenderer.invoke('ext:install', id),
    extUninstall:      (id)       => ipcRenderer.invoke('ext:uninstall', id),
    extToggle:         (id, on)   => ipcRenderer.invoke('ext:toggle', id, on),
    extApplyToSession: (partition) => ipcRenderer.invoke('ext:apply-to-session', partition),

    openPopupWindow: (url, opts) => ipcRenderer.invoke('open-popup-window', url, opts)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Перехват JS-ошибок рендерера → логируем в crash.log главного процесса
window.addEventListener('error', (event) => {
    try {
        ipcRenderer.send('renderer-error-log', {
            type: 'error',
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            stack: event.error?.stack || ''
        })
    } catch {}
})
window.addEventListener('unhandledrejection', (event) => {
    try {
        ipcRenderer.send('renderer-error-log', {
            type: 'unhandledrejection',
            message: String(event.reason),
            stack: event.reason?.stack || ''
        })
    } catch {}
})