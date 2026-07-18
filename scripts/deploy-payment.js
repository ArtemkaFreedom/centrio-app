require('dotenv').config()
const SftpClient = require('ssh2-sftp-client')
const path = require('path')
const fs   = require('fs')

const config = {
    host: process.env.UPLOAD_HOST || '31.128.44.165',
    port: Number(process.env.UPLOAD_PORT || 22),
    username: process.env.UPLOAD_USER || 'root',
    password: process.env.UPLOAD_PASSWORD,
    readyTimeout: 30000
}

// SECURITY: this was a hardcoded live YooKassa secret key committed in
// plaintext to the repo. Now read from env — set YUKASSA_SHOP_ID and
// YUKASSA_SECRET_KEY before running this script. The exposed key should
// be rotated from the YooKassa merchant dashboard regardless.
const SHOP_ID    = process.env.YUKASSA_SHOP_ID
const SECRET_KEY = process.env.YUKASSA_SECRET_KEY
if (!SHOP_ID || !SECRET_KEY) {
    console.error('Missing YUKASSA_SHOP_ID / YUKASSA_SECRET_KEY in environment — aborting')
    process.exit(1)
}

const sftp = new SftpClient()

function exec(cmd) {
    return new Promise((resolve, reject) => {
        let out = ''
        sftp.client.exec(cmd, (err, stream) => {
            if (err) return reject(err)
            stream.on('data', d => { out += d.toString(); process.stdout.write(d.toString()) })
            stream.stderr.on('data', d => { out += d.toString(); process.stderr.write(d.toString()) })
            stream.on('close', code => resolve({ out, code }))
        })
    })
}

async function uploadText(content, remote) {
    const buf = Buffer.from(content, 'utf8')
    const stream = require('stream')
    const readable = new stream.Readable()
    readable.push(buf)
    readable.push(null)
    await sftp.put(readable, remote)
    console.log(`  ✓ ${remote}`)
}

sftp.connect(config).then(async () => {
    console.log('=== Connected ===\n')

    // 1. Update server .env: set YooKassa credentials
    console.log('1. Setting YooKassa credentials in .env...')
    await exec(`sed -i 's/YUKASSA_SHOP_ID=.*/YUKASSA_SHOP_ID=${SHOP_ID}/' /var/www/centrio-api/.env`)
    await exec(`sed -i 's|YUKASSA_SECRET_KEY=.*|YUKASSA_SECRET_KEY=${SECRET_KEY}|' /var/www/centrio-api/.env`)
    await exec(`grep YUKASSA /var/www/centrio-api/.env`)

    // 2. Upload payments route
    console.log('\n2. Uploading payments route...')
    const paymentsRoute = fs.readFileSync(path.join(__dirname, '../landing/payments-route.js'), 'utf8')
    await uploadText(paymentsRoute, '/var/www/centrio-api/src/routes/payments.js')

    // 3. Restart API
    console.log('\n3. Restarting centrio-api...')
    await exec('pm2 restart centrio-api && sleep 1 && pm2 list | grep centrio-api')

    // 4. Create payment/success directory on Next.js
    console.log('\n4. Creating payment/success dir...')
    await exec('mkdir -p /var/www/centrio-web/src/app/payment/success')

    // 5. Upload success page
    console.log('5. Uploading payment success page...')
    const successPage = fs.readFileSync(path.join(__dirname, '../landing/payment-success.tsx'), 'utf8')
    await uploadText(successPage, '/var/www/centrio-web/src/app/payment/success/page.tsx')

    // 6. Upload updated dashboard
    console.log('6. Uploading updated dashboard...')
    const dashboard = fs.readFileSync(path.join(__dirname, '../landing/dashboard-server.tsx'), 'utf8')
    await uploadText(dashboard, '/var/www/centrio-web/src/app/dashboard/page.tsx')

    // 7. Rebuild Next.js and restart
    console.log('\n7. Building centrio-web...')
    const { code } = await exec('cd /var/www/centrio-web && npm run build 2>&1 | tail -25 && pm2 restart centrio-web && echo "=== WEB DEPLOY OK ==="')

    await sftp.end()
    process.exit(code || 0)
}).catch(async err => {
    console.error('\nError:', err.message)
    try { await sftp.end() } catch(_) {}
    process.exit(1)
})
