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
    'update-status'
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
    storeGet: (key, def) => ipcRenderer.invoke('store:get', key, def),
    storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),
    storeDelete: (key) => ipcRenderer.invoke('store:delete', key),

    getWebviewPreloadPath: () => ipcRenderer.invoke('get-webview-preload-path'),

    invoke: (channel, ...args) => {
        const mapped = mapInvokeChannel(channel)
        return ipcRenderer.invoke(mapped, ...args)
    },

    send: (channel, ...args) => {
        const mapped = mapSendChannel(channel)
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
    }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)