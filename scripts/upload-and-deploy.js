require('dotenv').config()
const SftpClient = require('ssh2-sftp-client')
const path = require('path')

const config = {
    host: process.env.UPLOAD_HOST || '31.128.44.165',
    port: Number(process.env.UPLOAD_PORT || 22),
    username: process.env.UPLOAD_USER || 'root',
    password: process.env.UPLOAD_PASSWORD,
    readyTimeout: 30000
}

const uploads = [
    {
        local: path.join(__dirname, '../landing/page.tsx'),
        remote: '/var/www/centrio-web/src/app/page.tsx'
    }
]

console.log(`Connecting to ${config.host}:${config.port}...`)

const sftp = new SftpClient()

sftp.connect(config).then(async () => {
    console.log('SFTP connected.')

    for (const { local, remote } of uploads) {
        console.log(`Uploading ${local} → ${remote}`)
        await sftp.put(local, remote)
        console.log(`  ✓ Uploaded`)
    }

    console.log('\nRunning build...')
    const cmd = 'cd /var/www/centrio-web && npm run build 2>&1 | tail -20 && pm2 restart centrio-web && echo "=== DEPLOY OK ==="'

    return new Promise((resolve, reject) => {
        sftp.client.exec(cmd, (err, stream) => {
            if (err) return reject(err)
            stream.on('data', d => process.stdout.write(d.toString()))
            stream.stderr.on('data', d => process.stderr.write(d.toString()))
            stream.on('close', code => resolve(code))
        })
    })
}).then(async (code) => {
    console.log(`\nDone. Exit code: ${code}`)
    await sftp.end()
    process.exit(code || 0)
}).catch(async (err) => {
    console.error('Error:', err.message)
    try { await sftp.end() } catch (_) {}
    process.exit(1)
})
