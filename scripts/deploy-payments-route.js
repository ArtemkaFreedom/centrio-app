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
        sftp.client.exec(cmd, (err, st) => {
            if (err) return reject(err)
            st.on('data', d => process.stdout.write(d.toString()))
            st.stderr.on('data', d => process.stderr.write(d.toString()))
            st.on('close', c => resolve(c))
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
    console.log('Connected.')
    await upload(path.join(__dirname, '../landing/payments-route.js'), '/var/www/centrio-api/src/routes/payments.js')
    await exec('pm2 restart centrio-api && sleep 1 && echo "API restarted OK"')
    await sftp.end()
    process.exit(0)
}).catch(async err => {
    console.error('Error:', err.message)
    try { await sftp.end() } catch(_) {}
    process.exit(1)
})
