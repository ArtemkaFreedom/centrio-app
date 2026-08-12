// Frontend (centrio-web / landing site) deploy script — key-based auth via
// ssh2, mirroring scripts/deploy-backend.js.
//
// Supersedes scripts/deploy-landing-redesign.js, which had two real bugs
// found during the 2026-07-29 version-consistency fix:
//   1. It only uploaded page.tsx — download/page.tsx, lib/i18n.ts, and
//      components/SiteFooter.tsx (all of which also need to change on a
//      real release) were never covered by it.
//   2. It restarted with plain `pm2 restart centrio-web` as root. On this
//      server every app process (including centrio-web) runs under the
//      `webapps` system user in its own pm2 daemon — root's own `pm2 list`
//      is a completely separate, empty instance. That command would have
//      either silently no-op'd or spawned a stray root-owned duplicate
//      process, never touching the real running site.
// Kept deploy-landing-redesign.js as a historical record with a
// deprecation notice rather than deleting it.
//
// Usage:
//   UPLOAD_SSH_KEY_PATH=/path/to/private_key node scripts/deploy-frontend.js
//
// Falls back to ~/.ssh/centrio_deploy if UPLOAD_SSH_KEY_PATH is unset (same
// convention as deploy-backend.js).
require('dotenv').config()
const { Client } = require('ssh2')
const fs = require('fs')
const path = require('path')
const os = require('os')

const HOST = process.env.UPLOAD_HOST || '31.128.44.165'
const PORT = Number(process.env.UPLOAD_PORT || 22)
const USER = process.env.UPLOAD_USER || 'root'
const KEY_PATH = process.env.UPLOAD_SSH_KEY_PATH || path.join(os.homedir(), '.ssh', 'centrio_deploy')

if (!fs.existsSync(KEY_PATH)) {
    console.error(`Private key not found at ${KEY_PATH}`)
    console.error('Set UPLOAD_SSH_KEY_PATH to the correct path, or generate one and install the .pub on the server first.')
    process.exit(1)
}

const REMOTE_BASE = '/var/www/centrio-web'

// File → remote path mapping confirmed live 2026-07-29 (`find /var/www/centrio-web/src`).
//
// 2026-07-29 version-consistency fix round 2: a wider grep across the whole
// live src/ tree (not just the 4 files below) turned up "1.6.6" hardcoded in
// 8 more files — including two literal broken download links
// (Centrio%20Setup%201.6.6.exe returns 404; the real file on disk is
// 1.7.9.exe) on SiteHeader (every page) and the /features and /blog/top-apps
// CTAs. All were previously live-only, never tracked in this repo.
const UPLOADS = [
    { local: path.join(__dirname, '..', 'landing', 'page.tsx'),            remote: `${REMOTE_BASE}/src/app/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'download.tsx'),        remote: `${REMOTE_BASE}/src/app/download/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'i18n.ts'),             remote: `${REMOTE_BASE}/src/lib/i18n.ts` },
    { local: path.join(__dirname, '..', 'landing', 'SiteFooter.tsx'),      remote: `${REMOTE_BASE}/src/components/SiteFooter.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'SiteHeader.tsx'),      remote: `${REMOTE_BASE}/src/components/SiteHeader.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'SeoFooter.tsx'),       remote: `${REMOTE_BASE}/src/components/SeoFooter.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'features.tsx'),        remote: `${REMOTE_BASE}/src/app/features/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'download-layout.tsx'), remote: `${REMOTE_BASE}/src/app/download/layout.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-vs-rambox.tsx'),  remote: `${REMOTE_BASE}/src/app/blog/vs-rambox/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-vs-franz.tsx'),   remote: `${REMOTE_BASE}/src/app/blog/vs-franz/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-vs-wavebox.tsx'), remote: `${REMOTE_BASE}/src/app/blog/vs-wavebox/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-top-apps.tsx'),   remote: `${REMOTE_BASE}/src/app/blog/top-apps/page.tsx` },
    // Added for the v1.9.0 version-string sweep — confirmed live on the
    // server (`test -f`) before being added here, same as the entries above.
    { local: path.join(__dirname, '..', 'landing', 'layout.tsx'),         remote: `${REMOTE_BASE}/src/app/layout.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-vs-ferdium.tsx'),               remote: `${REMOTE_BASE}/src/app/blog/vs-ferdium/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-who-needs-it.tsx'),             remote: `${REMOTE_BASE}/src/app/blog/who-needs-it/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-is-it-safe.tsx'),               remote: `${REMOTE_BASE}/src/app/blog/is-it-safe/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-stop-switching-tabs.tsx'),      remote: `${REMOTE_BASE}/src/app/blog/stop-switching-tabs/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-messenger-vpn-guide.tsx'),      remote: `${REMOTE_BASE}/src/app/blog/messenger-vpn-guide/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-remote-team-messengers.tsx'),   remote: `${REMOTE_BASE}/src/app/blog/remote-team-messengers/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'blog-how-to-combine-messengers.tsx'), remote: `${REMOTE_BASE}/src/app/blog/how-to-combine-messengers/page.tsx` },
    // Real YooKassa card-binding flow (replaces the fake mockup built only
    // for YooKassa's recurring-payments approval screenshots) — confirmed
    // live path via `test -f` before adding, same as the entries above.
    { local: path.join(__dirname, '..', 'landing', 'dashboard-server.tsx'), remote: `${REMOTE_BASE}/src/app/dashboard/page.tsx` },
    // Confirmed live via `test -f` before adding, same as the entries above.
    { local: path.join(__dirname, '..', 'landing', 'admin-server.tsx'),     remote: `${REMOTE_BASE}/src/app/admin/page.tsx` },
    // Added for the v2.0.0 changelog widget — pricing.tsx was previously only
    // covered by scripts/upload-and-deploy.js, not this script. changelog-data.ts
    // is uploaded twice (colocated) because Next.js relative imports (`./changelog-data`)
    // resolve per-directory on the server; both pricing/page.tsx and download/page.tsx import it.
    { local: path.join(__dirname, '..', 'landing', 'pricing.tsx'),          remote: `${REMOTE_BASE}/src/app/pricing/page.tsx` },
    { local: path.join(__dirname, '..', 'landing', 'changelog-data.ts'),    remote: `${REMOTE_BASE}/src/app/pricing/changelog-data.ts` },
    { local: path.join(__dirname, '..', 'landing', 'changelog-data.ts'),    remote: `${REMOTE_BASE}/src/app/download/changelog-data.ts` },
]

function exec(conn, cmd) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err)
            let out = ''
            stream.on('data', d => { out += d.toString(); process.stdout.write(d.toString()) })
            stream.stderr.on('data', d => { out += d.toString(); process.stderr.write(d.toString()) })
            stream.on('close', code => resolve({ out, code }))
        })
    })
}

function putFile(sftp, local, remote) {
    return new Promise((resolve, reject) => {
        sftp.fastPut(local, remote, err => err ? reject(err) : resolve())
    })
}

const conn = new Client()
conn.on('ready', async () => {
    console.log('=== Connected (publickey) ===\n')
    try {
        const sftp = await new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp))
        })

        for (const { local, remote } of UPLOADS) {
            console.log(`Uploading ${path.basename(local)} → ${remote}`)
            await putFile(sftp, local, remote)
        }

        // fastPut over SFTP as root leaves files root-owned; the build step
        // below runs as `webapps` and needs read access, and everything else
        // under REMOTE_BASE is webapps:webapps — restore that ownership.
        console.log('\nFixing ownership of uploaded files (root → webapps)...')
        const chownList = UPLOADS.map(u => u.remote).join(' ')
        await exec(conn, `chown webapps:webapps ${chownList}`)

        console.log('\nBuilding Next.js (this takes ~2-3 min)...')
        const { code: buildCode } = await exec(conn,
            `cd ${REMOTE_BASE} && sudo -u webapps NODE_OPTIONS="--max-old-space-size=1024" npm run build`
        )
        if (buildCode !== 0) {
            throw new Error('Build failed — NOT restarting the service. Fix and redeploy.')
        }

        console.log('\nRestarting centrio-web (as webapps user, with --update-env)...')
        await exec(conn, 'sudo -u webapps pm2 restart centrio-web --update-env')

        // The health check below runs curl against the just-restarted process.
        // Without this pause it reliably races the port bind and reports a
        // false-negative HTTP 000 — hit twice during manual testing on
        // 2026-07-29 before adding this.
        await new Promise(resolve => setTimeout(resolve, 3000))

        console.log('\nHealth check...')
        await exec(conn, "curl -s -o /dev/null -w 'site: HTTP %{http_code}\\n' http://localhost:3000/")
        await exec(conn, "sleep 2 && curl -s -o /dev/null -w 'download page: HTTP %{http_code}\\n' http://localhost:3000/download")

        console.log('\n✅ Frontend deploy done.')
        conn.end()
        process.exit(0)
    } catch (err) {
        console.error('\nError:', err.message)
        conn.end()
        process.exit(1)
    }
}).on('error', err => {
    console.error('Connection error:', err.message)
    process.exit(1)
}).connect({
    host: HOST,
    port: PORT,
    username: USER,
    privateKey: fs.readFileSync(KEY_PATH),
    readyTimeout: 30000
})
