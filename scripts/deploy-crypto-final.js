const SftpClient = require('ssh2-sftp-client');
const path = require('path');
const fs = require('fs');
const sftp = new SftpClient();
const config = { host: '31.128.44.165', port: 22, username: 'root', password: 'j2KHHxjz5_A)' };

async function run(cmd) {
  return new Promise((resolve, reject) => {
    sftp.client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', () => resolve(out));
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => out += d);
    });
  });
}

async function main() {
  await sftp.connect(config);

  // ── 1. Add env vars to centrio-api ─────────────────────────────
  console.log('📝 Adding NOWPayments env to centrio-api...');
  await run(`grep -q "NOWPAYMENTS_API_KEY" /var/www/centrio-api/.env || echo '
NOWPAYMENTS_API_KEY=17TY5YG-QX6MB01-N4MWJDJ-BN3AZAW
NOWPAYMENTS_PUBLIC_KEY=8c450bfd-25c0-493f-816b-ca263b829e7f
NOWPAYMENTS_IPN_SECRET=Lu+sGbPAxRVKxX7H24muWaJw4yq6Ok50' >> /var/www/centrio-api/.env`);
  console.log('✓ Env updated');

  // ── 2. Upload new payments.js ────────────────────────────────────
  console.log('\n📤 Uploading payments.js to centrio-api...');
  await sftp.put(path.join(__dirname, '..', 'server', 'payments.js'), '/var/www/centrio-api/src/routes/payments.js');
  console.log('✓ payments.js uploaded');

  // ── 3. Upload new dashboard page ────────────────────────────────
  console.log('\n📤 Uploading dashboard page...');
  await sftp.put(path.join(__dirname, '..', 'server', 'dashboard.tsx'), '/var/www/centrio-web/src/app/dashboard/page.tsx');
  console.log('✓ dashboard page uploaded');

  // ── 4. Remove wrong Next.js API routes (created earlier) ────────
  console.log('\n🗑 Removing misplaced Next.js crypto routes...');
  await run('rm -rf /var/www/centrio-web/src/app/api/create-crypto-payment /var/www/centrio-web/src/app/api/crypto-webhook');
  console.log('✓ Old routes removed');

  // ── 5. Restart centrio-api ───────────────────────────────────────
  console.log('\n🔄 Restarting centrio-api...');
  console.log(await run('pm2 restart centrio-api 2>&1'));

  // ── 6. Rebuild centrio-web ───────────────────────────────────────
  console.log('\n🔨 Building centrio-web...');
  console.log(await run('cd /var/www/centrio-web && npm run build 2>&1 | tail -15'));
  console.log(await run('pm2 restart centrio-web 2>&1 | tail -5'));

  console.log('\n✅ Done! Crypto payment fully integrated.');
  await sftp.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
