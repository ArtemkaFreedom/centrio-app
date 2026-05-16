const SftpClient = require('ssh2-sftp-client');
const sftp = new SftpClient();
const config = { host: '31.128.44.165', port: 22, username: 'root', password: 'j2KHHxjz5_A)' };

async function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    sftp.client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code) => resolve({ code, out }));
      stream.on('data', (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on('data', (d) => { out += d; process.stderr.write(d); });
    });
  });
}

async function main() {
  console.log('🔌 Connecting...');
  await sftp.connect(config);
  console.log('📥 Pulling latest from git...');
  await runCommand('cd /var/www/centrio-web && git pull origin main 2>&1');
  console.log('\n🔨 Building...');
  await runCommand('cd /var/www/centrio-web && npm run build 2>&1 | tail -30');
  console.log('\n♻️  Restarting pm2...');
  await runCommand('pm2 restart centrio-web 2>&1');
  console.log('\n✅ Landing deployed!');
  await sftp.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
