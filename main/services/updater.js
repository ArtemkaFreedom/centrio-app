const { app } = require('electron')
const { safeSendToWindow } = require('../utils/window')
const { IPC_CHANNELS } = require('../config/constants')
const { t } = require('./i18n')

let autoUpdater = null
let log = null
let updaterInitialized = false

try {
    autoUpdater = require('electron-updater').autoUpdater
    log = require('electron-log')

    log.transports.file.level = 'info'
    log.transports.console.level = 'info'

    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.disableWebInstaller = true
} catch (error) {
    console.error('[updater] Failed to initialize electron-updater:', error)
    autoUpdater = null
    log = null
}

function writeLog(...args) {
    console.log('[updater]', ...args)
    if (log) {
        log.info('[updater]', ...args)
    }
}

function writeError(...args) {
    console.error('[updater]', ...args)
    if (log) {
        log.error('[updater]', ...args)
    }
}

function sendUpdateStatus(getMainWindow, payload) {
    writeLog('sendUpdateStatus:', JSON.stringify(payload))
    safeSendToWindow(getMainWindow, IPC_CHANNELS.UPDATE_STATUS, payload)
}

function initUpdater(getMainWindow) {
    if (!autoUpdater) {
        writeError('autoUpdater is not available')
        return
    }

    if (updaterInitialized) {
        writeLog('initUpdater skipped: already initialized')
        return
    }

    updaterInitialized = true

    writeLog('initUpdater called')
    writeLog('app.isPackaged =', app.isPackaged)
    writeLog('app version =', app.getVersion())

    autoUpdater.on('checking-for-update', () => {
        writeLog('Event: checking-for-update')
        sendUpdateStatus(getMainWindow, {
            status: 'checking',
            label: t('updater.checking'),
            message: 'Checking for updates...'
        })
    })

    autoUpdater.on('update-available', (info) => {
        writeLog('Event: update-available', JSON.stringify(info))
        sendUpdateStatus(getMainWindow, {
            status: 'available',
            version: info.version,
            label: t('updater.available'),
            message: `Доступна новая версия ${info.version}. Обновление скачивается автоматически.`
        })
    })

    autoUpdater.on('update-not-available', (info) => {
        writeLog('Event: update-not-available', JSON.stringify(info))
        sendUpdateStatus(getMainWindow, {
            status: 'not-available',
            label: t('updater.notAvailable'),
            message: 'No updates found.'
        })
    })

    autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent || 0)

        writeLog(
            'Event: download-progress',
            `percent=${percent}`,
            `transferred=${progress.transferred}`,
            `total=${progress.total}`
        )

        sendUpdateStatus(getMainWindow, {
            status: 'downloading',
            percent,
            label: t('updater.downloading'),
            message: `Скачивание обновления: ${percent}%`
        })
    })

    autoUpdater.on('update-downloaded', async (info) => {
        writeLog('Event: update-downloaded', JSON.stringify(info))

        sendUpdateStatus(getMainWindow, {
            status: 'downloaded',
            version: info.version,
            label: t('updater.downloaded'),
            message: `Обновление ${info.version} скачано и готово к установке.`
        })
    })

    autoUpdater.on('error', (err) => {
        writeError('Event: error', err && err.stack ? err.stack : err)

        sendUpdateStatus(getMainWindow, {
            status: 'error',
            error: err?.message || String(err),
            label: t('updater.error'),
            message: 'Failed to check or download update.'
        })
    })
}

async function checkForUpdates() {
    if (!autoUpdater) {
        writeError('checkForUpdates aborted: autoUpdater is not available')
        return null
    }

    if (!app.isPackaged) {
        writeLog('checkForUpdates aborted: app is not packaged')
        return null
    }

    try {
        writeLog('checkForUpdates called')
        writeLog('Current version:', app.getVersion())

        const result = await autoUpdater.checkForUpdates()

        writeLog('checkForUpdates result received')

        if (result?.updateInfo) {
            writeLog('updateInfo:', JSON.stringify(result.updateInfo))
        } else {
            writeLog('No updateInfo returned from checkForUpdates')
        }

        return result
    } catch (err) {
        writeError('checkForUpdates failed:', err && err.stack ? err.stack : err)
        throw err
    }
}

function installUpdate() {
    if (!autoUpdater) {
        writeError('installUpdate aborted: autoUpdater is not available')
        return
    }

    writeLog('quitAndInstall called')
    autoUpdater.quitAndInstall()
}

module.exports = {
    initUpdater,
    checkForUpdates,
    installUpdate
}