const { ipcMain, dialog, app, clipboard, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const store = require('../services/store')
const { t } = require('../services/i18n')

let downloadDir = store.get('settings.downloadDir', '')
let askDownload = store.get('settings.askDownload', true)

function safeOn(channel, listener) {
    ipcMain.removeAllListeners(channel)
    ipcMain.on(channel, listener)
}

function safeHandle(channel, handler) {
    try {
        ipcMain.removeHandler(channel)
    } catch {}
    ipcMain.handle(channel, handler)
}

// SECURITY: 'save-image-data' (below) used to fs.writeFileSync() to whatever
// filePath the renderer passed it, with no validation at all — an arbitrary
// file write primitive (attacker-controlled path + attacker-controlled base64
// content) reachable from any code able to call window.electronAPI.send in
// the main renderer context. Normal usage always passes back the exact path
// this process itself just handed out via 'get-save-image-path' (see
// renderer/webview-tabs-bind.js:560-567), so we track a short-lived,
// single-use allowlist of paths we actually issued and refuse to write
// anywhere else. This doesn't change behavior for the legitimate flow at all.
const pendingSaveImagePaths = new Set()
const PENDING_SAVE_PATH_TTL_MS = 5 * 60 * 1000

function registerPendingSaveImagePath(filePath) {
    if (!filePath) return
    pendingSaveImagePaths.add(filePath)
    setTimeout(() => pendingSaveImagePaths.delete(filePath), PENDING_SAVE_PATH_TTL_MS)
}

function updateDownloadHandler(getMainWindow) {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return

    const ses = win.webContents.session
    ses.removeAllListeners('will-download')

    ses.on('will-download', (_event, item) => {
        if (!askDownload && downloadDir) {
            item.setSavePath(path.join(downloadDir, item.getFilename()))
        }
    })
}

function registerDownloadsIpc({ getMainWindow }) {
    safeHandle('choose-download-dir', async () => {
        const win = getMainWindow()

        const result = await dialog.showOpenDialog(win || undefined, {
            properties: ['openDirectory', 'createDirectory'],
            title: t('dialogs.chooseDownloadDir')
        })

        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0]
        }

        return null
    })

    safeHandle('dialog:selectDirectory', async () => {
        const win = getMainWindow()

        const result = await dialog.showOpenDialog(win || undefined, {
            properties: ['openDirectory', 'createDirectory'],
            title: t('dialogs.chooseDownloadDir')
        })

        if (result.canceled || !result.filePaths?.length) {
            return {
                canceled: true,
                filePath: null
            }
        }

        return {
            canceled: false,
            filePath: result.filePaths[0]
        }
    })

    safeOn('set-download-dir', (_event, dir) => {
        downloadDir = dir || ''
        store.set('settings.downloadDir', downloadDir)
        updateDownloadHandler(getMainWindow)
    })

    safeOn('set-ask-download', (_event, ask) => {
        askDownload = Boolean(ask)
        store.set('settings.askDownload', askDownload)
        updateDownloadHandler(getMainWindow)
    })

    safeOn('save-page', async () => {
        const win = getMainWindow()

        await dialog.showSaveDialog(win || undefined, {
            title: t('dialogs.savePage'),
            defaultPath: t('dialogs.savePageDefault'),
            filters: [
                {
                    name: t('dialogs.savePageFilter'),
                    extensions: ['html']
                }
            ]
        })
    })

    safeHandle('get-save-image-path', async (_event, url) => {
        let ext = 'jpg'

        try {
            const cleanUrl = String(url || '').split('?')[0].split('#')[0]
            const parts = cleanUrl.split('.')

            if (parts.length > 1) {
                const candidate = parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '')
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'].includes(candidate)) {
                    ext = candidate
                }
            }
        } catch {}

        const fileName = `image_${Date.now()}.${ext}`

        if (downloadDir && !askDownload) {
            const autoPath = path.join(downloadDir, fileName)
            registerPendingSaveImagePath(autoPath)
            return autoPath
        }

        const win = getMainWindow()
        const result = await dialog.showSaveDialog(win || undefined, {
            title: t('dialogs.saveImage'),
            defaultPath: path.join(downloadDir || app.getPath('downloads'), fileName),
            filters: [
                {
                    name: t('dialogs.saveImageFilter'),
                    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
                }
            ]
        })

        if (result.canceled) return null
        registerPendingSaveImagePath(result.filePath)
        return result.filePath
    })

    safeOn('save-image-data', (_event, dataUrl, filePath) => {
        if (!dataUrl || !filePath) return

        if (!pendingSaveImagePaths.has(filePath)) {
            console.warn('[security] save-image-data blocked — path was not issued by get-save-image-path:', filePath)
            return
        }
        pendingSaveImagePaths.delete(filePath)

        try {
            const base64 = String(dataUrl).split(',')[1]
            if (!base64) return

            fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
        } catch (err) {
            console.error('save-image-data error:', err)
        }
    })

    // Копировать картинку в буфер обмена через native API
    safeHandle('copy-image-to-clipboard', (_event, dataUrl) => {
        try {
            const img = nativeImage.createFromDataURL(String(dataUrl || ''))
            if (!img.isEmpty()) {
                clipboard.writeImage(img)
            }
            return { success: true }
        } catch (err) {
            console.error('copy-image-to-clipboard error:', err)
            return { success: false, error: err.message }
        }
    })

    // Копировать текст в буфер обмена (fallback для renderer)
    safeHandle('copy-text-to-clipboard', (_event, text) => {
        try {
            clipboard.writeText(String(text || ''))
            return { success: true }
        } catch (err) {
            return { success: false, error: err.message }
        }
    })
}

module.exports = {
    registerDownloadsIpc,
    updateDownloadHandler
}