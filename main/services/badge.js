const { app } = require('electron')
const { isWindowAlive } = require('../utils/window')

function clearBadges(getMainWindow) {
    try {
        if (typeof app.setBadgeCount === 'function') {
            app.setBadgeCount(0)
            app.setBadgeCount(-1)
        }
    } catch {}

    try {
        const win = getMainWindow()
        if (isWindowAlive(win)) {
            win.setOverlayIcon(null, '')
        }
    } catch {}
}

module.exports = {
    clearBadges
}