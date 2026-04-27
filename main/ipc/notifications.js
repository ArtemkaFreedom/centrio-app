const { ipcMain, nativeImage } = require('electron')
const { PATHS, APP_NAME, IPC_CHANNELS } = require('../config/constants')
const { safeSendToWindow } = require('../utils/window')
const { t } = require('../services/i18n')
const tracker = require('../services/tracker')

const lastNotifTime = {}

function registerNotificationsIpc({ getMainWindow, showMainWindow }) {
    ipcMain.on('show-notification', async (event, { title, body, icon, messengerId }) => {
        try {
            const now = Date.now()
            if (lastNotifTime[messengerId] && now - lastNotifTime[messengerId] < 1000) return
            lastNotifTime[messengerId] = now

            const { Notification } = require('electron')
            const https = require('https')
            const http = require('http')

            async function downloadImageAsNativeImage(url) {
                return new Promise((resolve) => {
                    try {
                        const client = url.startsWith('https') ? https : http
                        client.get(url, (res) => {
                            const chunks = []
                            res.on('data', chunk => chunks.push(chunk))
                            res.on('end', () => {
                                try {
                                    const buffer = Buffer.concat(chunks)
                                    const img = nativeImage.createFromBuffer(buffer)
                                    if (!img.isEmpty()) resolve(img)
                                    else resolve(null)
                                } catch {
                                    resolve(null)
                                }
                            })
                            res.on('error', () => resolve(null))
                        }).on('error', () => resolve(null))
                    } catch {
                        resolve(null)
                    }
                })
            }

            let iconImage = null

            try {
                if (icon && icon.startsWith('data:')) {
                    iconImage = nativeImage.createFromDataURL(icon)
                    if (iconImage.isEmpty()) iconImage = null
                } else if (icon && (icon.startsWith('http://') || icon.startsWith('https://'))) {
                    iconImage = await downloadImageAsNativeImage(icon)
                } else if (icon) {
                    iconImage = nativeImage.createFromPath(icon)
                    if (iconImage.isEmpty()) iconImage = null
                }
            } catch {
                iconImage = null
            }

            if (!iconImage || iconImage.isEmpty()) {
                iconImage = nativeImage.createFromPath(PATHS.ICON)
            }

            const notification = new Notification({
                title: title || APP_NAME,
                body: body || t('system.notificationDefault'),
                icon: iconImage,
                silent: true
            })

            notification.on('click', () => {
                showMainWindow()
                safeSendToWindow(getMainWindow, IPC_CHANNELS.NOTIFICATION_CLICKED_ID, messengerId)
            })

            notification.show()
        } catch (e) {
            console.error('show-notification error:', e)
        }
    })
}

module.exports = registerNotificationsIpc