const registerWindowIpc = require('../ipc/window')
const registerBadgeIpc = require('../ipc/badge')
const registerNotificationsIpc = require('../ipc/notifications')
const { registerDownloadsIpc } = require('../ipc/downloads')
const registerAutoLaunchIpc = require('../ipc/autoLaunch')
const registerApiIpc = require('../ipc/api')
const { registerOAuthIpc } = require('../ipc/oauth')
const registerProxyIpc = require('../ipc/proxy')
const registerUpdaterIpc = require('../ipc/updater')
const registerSoundIpc = require('../ipc/sound')
const registerVpnIpc = require('../ipc/vpn')
const registerScreenshotIpc = require('../ipc/screenshot')

function registerIpc({ getMainWindow, showMainWindow, updateTrayMenu, isQuittingRef }) {
    registerWindowIpc({ getMainWindow, isQuittingRef })
    registerBadgeIpc({ getMainWindow, updateTrayMenu })
    registerNotificationsIpc({ getMainWindow, showMainWindow })
    registerDownloadsIpc({ getMainWindow })
    registerAutoLaunchIpc()
    registerApiIpc()
    registerOAuthIpc({ getMainWindow })
    registerProxyIpc()
    registerUpdaterIpc({ getMainWindow, isQuittingRef })
    registerSoundIpc()
    registerVpnIpc({ getMainWindow })
    registerScreenshotIpc({ getMainWindow })
}

module.exports = registerIpc