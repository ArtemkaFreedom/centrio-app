require('dotenv').config()
const path = require('path')
const fs = require('fs')
const Client = require('ssh2-sftp-client')
const pkg = require('../package.json')

const sftp = new Client()

const config = {
    host: process.env.UPLOAD_HOST,
    port: Number(process.env.UPLOAD_PORT || 22),
    username: process.env.UPLOAD_USER,
    password: process.env.UPLOAD_PASSWORD
}

const distDir = path.resolve(__dirname, '..', pkg.build?.directories?.output || 'dist-v1510')
const remoteDir = process.env.UPLOAD_PATH
const version = pkg.version
const productName = pkg.productName || pkg.name

const filesToUpload = [
    'latest.yml',
    `${productName} Setup ${version}.exe`,
    `${productName} Setup ${version}.exe.blockmap`
]

function ensureFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Файл не найден: ${filePath}`)
    }
}

async function main() {
    if (!config.host || !config.username || !config.password || !remoteDir) {
        throw new Error('Не заданы UPLOAD_HOST, UPLOAD_USER, UPLOAD_PASSWORD, UPLOAD_PATH')
    }

    for (const fileName of filesToUpload) {
        ensureFileExists(path.join(distDir, fileName))
    }

    console.log('Подключение к серверу...')
    await sftp.connect(config)

    try {
        await sftp.mkdir(remoteDir, true).catch(() => {})

        for (const fileName of filesToUpload) {
            const localPath = path.join(distDir, fileName)
            const remotePath = `${remoteDir}/${fileName}`

            console.log(`Загрузка: ${fileName}`)
            await sftp.put(localPath, remotePath)
        }

        console.log('Готово: публикация завершена')
    } finally {
        await sftp.end()
    }
}

main().catch((err) => {
    console.error('Ошибка публикации:', err)
    process.exit(1)
})