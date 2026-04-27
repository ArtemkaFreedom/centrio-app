const { ipcMain } = require('electron')
const { playSound } = require('../services/sound')

function registerSoundIpc() {
    ipcMain.on('play-sound', async (event, soundPath) => {
        try {
            await playSound(soundPath)
        } catch (e) {
            console.error('play-sound error:', e)
        }
    })
}

module.exports = registerSoundIpc