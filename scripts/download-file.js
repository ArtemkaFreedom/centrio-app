require('dotenv').config()
const SftpClient = require('ssh2-sftp-client')
const fs = require('fs')
const path = require('path')

const config = {
    host: process.env.UPLOAD_HOST || '31.128.44.165',
    port: Number(process.env.UPLOAD_PORT || 22),
    username: process.env.UPLOAD_USER || 'root',
    password: process.env.UPLOAD_PASSWORD,
    readyTimeout: 30000
}

const remote = process.argv[2]
const local  = path.resolve(process.argv[3])

if (!remote || !local) { console.error('Usage: node download-file.js <remote> <local>'); process.exit(1) }

const sftp = new SftpClient()
sftp.connect(config).then(async () => {
    // Use exec/cat to read the file content
    const content = await new Promise((resolve, reject) => {
        let buf = ''
        sftp.client.exec(`cat '${remote}'`, (err, stream) => {
            if (err) return reject(err)
            stream.on('data', d => buf += d.toString())
            stream.on('close', () => resolve(buf))
        })
    })
    fs.writeFileSync(local, content, 'utf8')
    console.log(`Downloaded ${remote} → ${local} (${content.length} bytes)`)
    await sftp.end()
}).catch(async err => {
    console.error(err.message)
    try { await sftp.end() } catch(_) {}
    process.exit(1)
})
