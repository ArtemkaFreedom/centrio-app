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

const localFile = process.argv[2]
if (!localFile) { console.error('Usage: node run-remote.js <local-script.js>'); process.exit(1) }

const sftp = new SftpClient()
sftp.connect(config).then(async () => {
    // Upload script
    const buf = fs.readFileSync(path.resolve(localFile))
    const r = new stream.Readable(); r.push(buf); r.push(null)
    await sftp.put(r, '/tmp/_test_script.js')

    // Run it
    await new Promise((resolve, reject) => {
        sftp.client.exec('node /tmp/_test_script.js', (err, st) => {
            if (err) return reject(err)
            st.on('data', d => process.stdout.write(d.toString()))
            st.stderr.on('data', d => process.stderr.write(d.toString()))
            st.on('close', resolve)
        })
    })
    await sftp.end()
}).catch(async err => {
    console.error(err.message)
    try { await sftp.end() } catch(_) {}
    process.exit(1)
})
