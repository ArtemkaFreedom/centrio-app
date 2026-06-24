/**
 * deploy-site.js <version>
 *
 * Updates all version references in landing files, uploads to server,
 * rebuilds Next.js and restarts pm2.
 *
 * Usage:
 *   node scripts/deploy-site.js 1.6.95
 *   node scripts/deploy-site.js          ← auto-reads version from package.json
 */

const SftpClient = require('ssh2-sftp-client')
const fs         = require('fs')
const path       = require('path')

// ── Config ────────────────────────────────────────────────────────────────
const SFTP_CONFIG = {
    host:        '31.128.44.165',
    port:        22,
    username:    'root',
    password:    'j2KHHxjz5_A)',
    readyTimeout: 60000,
    retries:      3,
    retry_factor: 2,
    retry_minTimeout: 2000
}

const ROOT           = path.join(__dirname, '..')
const DOWNLOAD_TSX   = path.join(ROOT, 'landing', 'download.tsx')
const I18N_TS        = path.join(ROOT, 'landing', 'i18n.ts')
const SITE_SHELL_TSX = path.join(ROOT, 'landing', 'site-shell.tsx')

// Remote paths
const REMOTE_DOWNLOAD   = '/var/www/centrio-web/src/app/download/page.tsx'
const REMOTE_I18N       = '/var/www/centrio-web/src/lib/i18n.ts'
const REMOTE_SITE_SHELL = '/var/www/centrio-web/src/components/ui/site-shell.tsx'
const REMOTE_WEB        = '/var/www/centrio-web'

// ── Helpers ───────────────────────────────────────────────────────────────
function readFile(p)           { return fs.readFileSync(p, 'utf8') }
function writeFile(p, content) { fs.writeFileSync(p, content, 'utf8') }

function getVersion() {
    const arg = process.argv[2]
    if (arg && /^\d+\.\d+\.\d+$/.test(arg)) return arg
    const pkg = JSON.parse(readFile(path.join(ROOT, 'package.json')))
    return pkg.version
}

function updateDownloadTsx(version) {
    let content = readFile(DOWNLOAD_TSX)
    const before = content.match(/const VERSION = '([^']+)'/)?.[1]
    content = content.replace(/const VERSION = '[^']+'/, `const VERSION = '${version}'`)
    writeFile(DOWNLOAD_TSX, content)
    console.log(`  ✓ download.tsx: ${before} → ${version}`)
}

function updateI18n(version) {
    let content = readFile(I18N_TS)

    // Update dl_win_sub in all 5 locales
    const winMatches = (content.match(/dl_win_sub:\s*'[^']+'/g) || []).length
    content = content.replace(
        /dl_win_sub:\s*'v[\d.]+ · Windows 10\/11'/g,
        `dl_win_sub: 'v${version} · Windows 10/11'`
    )

    // Update dl_hero_date in all 5 locales
    const MONTHS = {
        ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
        en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
        fr: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
        it: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
    }
    const now  = new Date()
    const m    = now.getMonth()
    const year = now.getFullYear()
    content = content.replace(/dl_hero_date:\s*'[^']*'/g, (match, offset) => {
        // Detect language by context (look backwards for lang key indicators)
        const before = content.slice(Math.max(0, offset - 3000), offset)
        if (before.lastIndexOf("it: {") > before.lastIndexOf("fr: {") &&
            before.lastIndexOf("it: {") > before.lastIndexOf("zh: {")) return `dl_hero_date: '${MONTHS.it[m]} ${year}'`
        if (before.lastIndexOf("fr: {") > before.lastIndexOf("zh: {")) return `dl_hero_date: '${MONTHS.fr[m]} ${year}'`
        if (before.lastIndexOf("zh: {") > before.lastIndexOf("en: {")) return `dl_hero_date: '${year}年${m+1}月'`
        if (before.lastIndexOf("en: {") > before.lastIndexOf("ru: {")) return `dl_hero_date: '${MONTHS.en[m]} ${year}'`
        return `dl_hero_date: '${MONTHS.ru[m]} ${year}'`
    })

    writeFile(I18N_TS, content)
    console.log(`  ✓ i18n.ts: updated dl_win_sub in ${winMatches} locales + dl_hero_date`)
}

async function runCommand(sftp, cmd) {
    return new Promise((resolve, reject) => {
        sftp.client.exec(cmd, (err, stream) => {
            if (err) return reject(err)
            let out = ''
            stream.on('data',        (d) => { out += d; process.stdout.write(d) })
            stream.stderr.on('data', (d) => { out += d; process.stderr.write(d) })
            stream.on('close', (code) => resolve({ code, out }))
        })
    })
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
    const version = getVersion()
    console.log(`\n🚀 Deploying centrio.me/download — v${version}\n`)

    // 1. Update local files
    console.log('📝 Updating local files...')
    updateDownloadTsx(version)
    updateI18n(version)

    // 2. Connect SFTP
    console.log('\n🔌 Connecting to server...')
    const sftp = new SftpClient()
    await sftp.connect(SFTP_CONFIG)

    // 3. Upload landing files
    console.log('📤 Uploading files...')
    await sftp.put(DOWNLOAD_TSX, REMOTE_DOWNLOAD)
    console.log(`  ✓ download.tsx → ${REMOTE_DOWNLOAD}`)
    await sftp.put(I18N_TS, REMOTE_I18N)
    console.log(`  ✓ i18n.ts → ${REMOTE_I18N}`)
    await sftp.put(SITE_SHELL_TSX, REMOTE_SITE_SHELL)
    console.log(`  ✓ site-shell.tsx → ${REMOTE_SITE_SHELL}`)

    // 5. Clear Next.js cache & rebuild
    console.log('\n🗑  Clearing Next.js cache...')
    await runCommand(sftp, `rm -rf ${REMOTE_WEB}/.next && echo cleared`)

    console.log('🔨 Building...')
    await runCommand(sftp, `cd ${REMOTE_WEB} && npm run build 2>&1 | tail -20`)

    // 6. Restart pm2
    console.log('♻️  Restarting pm2...')
    await runCommand(sftp, 'pm2 restart centrio-web 2>&1 | tail -5')

    await sftp.end()

    console.log(`\n✅ centrio.me/download updated to v${version}`)
    console.log(`   Win:   https://download.centrio.me/Centrio%20Setup%20${version}.exe`)
    console.log(`   Mac:   https://download.centrio.me/mac/Centrio-${version}.dmg`)
    console.log(`   Linux: https://download.centrio.me/linux/Centrio-${version}.AppImage`)
    console.log(`   deb:   https://download.centrio.me/linux/messengerapp_${version}_amd64.deb`)
}

main().catch(e => {
    console.error('\n❌ Deploy failed:', e.message)
    process.exit(1)
})
