require('dotenv').config()
const SftpClient = require('ssh2-sftp-client')

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
        let out = ''
        sftp.client.exec(cmd, (err, stream) => {
            if (err) return reject(err)
            stream.on('data', d => out += d.toString())
            stream.stderr.on('data', d => out += d.toString())
            stream.on('close', () => resolve(out))
        })
    })
}

sftp.connect(config).then(async () => {
    const cmd = process.argv[2] || 'ls /var/www/centrio-api'
    const result = await exec(cmd)
    console.log(result)
    await sftp.end()
}).catch(async err => {
    console.error(err.message)
    try { await sftp.end() } catch(_){}
    process.exit(1)
})
