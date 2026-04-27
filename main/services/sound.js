const fs = require('fs')
const path = require('path')
const { app } = require('electron')

let sound = null
try {
    sound = require('sound-play')
} catch {
    sound = null
}

async function playSound(soundPath) {
    if (!sound) return
    if (!soundPath) return

    let absolutePath
    if (path.isAbsolute(soundPath)) {
        absolutePath = soundPath
    } else {
        // В packaged-сборке файлы звуков распакованы из .asar в app.asar.unpacked
        // (требует asarUnpack в package.json). Пробуем unpacked-путь первым.
        const unpackedPath = path.join(
            process.resourcesPath || app.getAppPath(),
            'app.asar.unpacked',
            soundPath
        )
        if (fs.existsSync(unpackedPath)) {
            absolutePath = unpackedPath
        } else {
            // Dev-режим: файлы рядом с исходниками
            absolutePath = path.join(app.getAppPath(), soundPath)
        }
    }

    if (!fs.existsSync(absolutePath)) return

    await sound.play(absolutePath)
}

module.exports = {
    playSound
}