const { globalShortcut } = require('electron')
const { IPC_CHANNELS } = require('../config/constants')
const { safeSendToWindow, focusWindow, withWindow } = require('../utils/window')

function registerShortcuts({ getMainWindow, showMainWindow }) {
    for (let i = 1; i <= 9; i++) {
        globalShortcut.register(`CmdOrCtrl+${i}`, () => {
            showMainWindow()
            safeSendToWindow(getMainWindow, IPC_CHANNELS.SWITCH_MESSENGER_INDEX, i - 1)
        })
    }

    globalShortcut.register('CmdOrCtrl+R', () => {
        safeSendToWindow(getMainWindow, IPC_CHANNELS.RELOAD_ACTIVE)
    })

    globalShortcut.register('CmdOrCtrl+Tab', () => {
        showMainWindow()
        safeSendToWindow(getMainWindow, IPC_CHANNELS.SWITCH_MESSENGER_NEXT)
    })

    globalShortcut.register('CmdOrCtrl+Shift+Tab', () => {
        showMainWindow()
        safeSendToWindow(getMainWindow, IPC_CHANNELS.SWITCH_MESSENGER_PREV)
    })

    globalShortcut.register('CmdOrCtrl+,', () => {
        showMainWindow()
        safeSendToWindow(getMainWindow, IPC_CHANNELS.OPEN_SETTINGS)
    })

    globalShortcut.register('CmdOrCtrl+M', () => {
        const focused = withWindow(getMainWindow, (win) => {
            if (win.isVisible() && win.isFocused()) {
                win.hide()
                return true
            }
            return false
        })

        if (!focused) {
            focusWindow(getMainWindow) || showMainWindow()
        }
    })
}

function unregisterShortcuts() {
    globalShortcut.unregisterAll()
}

module.exports = {
    registerShortcuts,
    unregisterShortcuts
}