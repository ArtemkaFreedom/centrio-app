require('dotenv').config()
const SftpClient = require('ssh2-sftp-client')
const path = require('path')
const fs   = require('fs')
const stream = require('stream')

const config = {
    host: process.env.UPLOAD_HOST || '31.128.44.165',
    port: Number(process.env.UPLOAD_PORT || 22),
    username: process.env.UPLOAD_USER || 'root',
    password: process.env.UPLOAD_PASSWORD,
    readyTimeout: 30000
}

const sftp = new SftpClient()

function exec(cmd) {
    return new Promise((resolve, reject) => {
        let code = 0
        sftp.client.exec(cmd, (err, st) => {
            if (err) return reject(err)
            st.on('data', d => process.stdout.write(d.toString()))
            st.stderr.on('data', d => process.stderr.write(d.toString()))
            st.on('close', c => { code = c; resolve(c) })
        })
    })
}

async function upload(localFile, remotePath) {
    const buf = fs.readFileSync(localFile)
    const r = new stream.Readable()
    r.push(buf); r.push(null)
    await sftp.put(r, remotePath)
    console.log(`  ✓ ${remotePath}`)
}

sftp.connect(config).then(async () => {
    console.log('Connected.\n')

    // 1. Upload fixed authStore
    console.log('1. Uploading authStore.ts...')
    await upload(path.join(__dirname, '../landing/authStore.ts'), '/var/www/centrio-web/src/store/authStore.ts')

    // 2. Upload updated dashboard
    console.log('2. Uploading dashboard...')
    await upload(path.join(__dirname, '../landing/dashboard-server.tsx'), '/var/www/centrio-web/src/app/dashboard/page.tsx')

    // 2b. Upload payment success page
    console.log('2b. Uploading payment/success page...')
    await exec('mkdir -p /var/www/centrio-web/src/app/payment/success')
    await upload(path.join(__dirname, '../landing/payment-success.tsx'), '/var/www/centrio-web/src/app/payment/success/page.tsx')

    // 3. Rebuild
    console.log('\n3. Building...')
    await exec('cd /var/www/centrio-web && npm run build 2>&1 | tail -30 && pm2 restart centrio-web && echo "=== OK ==="')

    await sftp.end()
    process.exit(0)
}).catch(async err => {
    console.error('Error:', err.message)
    try { await sftp.end() } catch(_) {}
    process.exit(1)
})
