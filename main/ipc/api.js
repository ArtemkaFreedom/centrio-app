const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { ipcMain, app } = require('electron')
const api = require('../services/api')
const tracker = require('../services/tracker')

function normalizeError(error) {
    const status = error?.response?.status
    const data = error?.response?.data || {}
    const message =
        data?.error ||
        data?.message ||
        error?.message ||
        'Unknown error'

    let code = data?.code || null

    if (!code) {
        if (status === 401) code = 'unauthorized'
        else if (status === 403) code = 'forbidden'
        else if (status === 400) code = 'bad_request'
        else if (status === 404) code = 'not_found'
        else if (status >= 500) code = 'server_error'
    }

    return {
        success: false,
        error: message,
        code,
        status
    }
}

async function wrapApi(call) {
    try {
        const response = await call()
        return {
            success: true,
            data: response?.data
        }
    } catch (error) {
        return normalizeError(error)
    }
}

function getWebviewPreloadPath() {
    const candidates = [
        path.join(app.getAppPath(), 'webview-preload.js'),
        path.join(process.resourcesPath, 'app.asar', 'webview-preload.js'),
        path.join(process.resourcesPath, 'app', 'webview-preload.js'),
        path.resolve(__dirname, '..', '..', 'webview-preload.js')
    ]

    const found = candidates.find((filePath) => fs.existsSync(filePath))

    if (!found) {
        throw new Error(
            `webview-preload.js not found. Checked: ${candidates.join(' | ')}`
        )
    }

    return pathToFileURL(found).toString()
}

function registerApiIpc() {
    ipcMain.handle('get-webview-preload-path', () => {
        return getWebviewPreloadPath()
    })

    ipcMain.handle('api-login', async (event, email, password) => {
        return wrapApi(() => api.login(email, password))
    })

    ipcMain.handle('api-register', async (event, email, password, name) => {
        return wrapApi(() => api.register(email, password, name))
    })

    ipcMain.handle('api-me', async (event, token) => {
        return wrapApi(() => api.me(token))
    })

    ipcMain.handle('api-refresh', async (event, refreshToken) => {
        return wrapApi(() => api.refresh(refreshToken))
    })

    ipcMain.handle('api-sync-push', async (event, token, arg1, arg2, arg3) => {
        return wrapApi(() => {
            if (
                arg1 &&
                typeof arg1 === 'object' &&
                !Array.isArray(arg1) &&
                ('messengers' in arg1 || 'folders' in arg1 || 'settings' in arg1)
            ) {
                return api.syncPush(token, arg1.messengers || [], arg1.folders || [], arg1.settings || {})
            }

            return api.syncPush(token, arg1 || [], arg2 || [], arg3 || {})
        })
    })

    ipcMain.handle('api-sync-pull', async (event, token) => {
        return wrapApi(() => api.syncPull(token))
    })

    ipcMain.handle('api-update-profile', async (event, token, data) => {
        return wrapApi(() => api.updateProfile(token, data))
    })

    ipcMain.handle('api-get-stats', async (event, token) => {
        return wrapApi(() => api.getStats(token))
    })

    ipcMain.handle('api-logout', async (event, token) => {
        return wrapApi(() => api.logout(token))
    })

    ipcMain.handle('api-get-notifications', async (event, token) => {
        return wrapApi(() => api.getNotifications(token))
    })

    ipcMain.handle('api-read-all-notifications', async (event, token) => {
        return wrapApi(() => api.readAllNotifications(token))
    })

    ipcMain.handle('api-yandex-desktop', async (event, accessToken) => {
        return wrapApi(() => api.yandexDesktop(accessToken))
    })

    ipcMain.handle('api-vk-desktop', async (event, accessToken, userId) => {
        return wrapApi(() => api.vkDesktop(accessToken, userId))
    })

    // ── Tracker IPC ──────────────────────────────────────────────
    // Renderer reports active-tab time every 5 min or on tab switch
    ipcMain.handle('tracker:service-time', async (event, { service, serviceTime }) => {
        try {
            tracker.addServiceTime(service, serviceTime)
            return { success: true }
        } catch {
            return { success: false }
        }
    })

    // Renderer reports message sent
    ipcMain.handle('tracker:msg-sent', async () => {
        tracker.addMsgSent(1)
        return { success: true }
    })

    // Renderer reports notification received
    ipcMain.handle('tracker:notif', async (event, count = 1) => {
        tracker.addNotif(count)
        return { success: true }
    })

    ipcMain.on('update-adblock-state', () => {
        const { updateAllSessions } = require('../services/adblock')
        updateAllSessions()
    })
}

module.exports = registerApiIpc