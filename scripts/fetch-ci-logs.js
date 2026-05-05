const https = require('https');

const TOKEN = process.env.GH_TOKEN || '';
const RUN_ID = '24988483081';

function getGitHub(url) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'node', 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/vnd.github+json' } };
    https.get(url, opts, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return getRaw(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function getRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  const { body } = await getGitHub(`https://api.github.com/repos/ArtemkaFreedom/centrio-app/actions/runs/${RUN_ID}/jobs`);
  const jobs = JSON.parse(body).jobs;

  for (const job of jobs) {
    if (job.conclusion !== 'failure') continue;
    console.log(`\n${'='.repeat(60)}\n=== ${job.name} ===\n${'='.repeat(60)}`);
    const logRes = await getGitHub(`https://api.github.com/repos/ArtemkaFreedom/centrio-app/actions/jobs/${job.id}/logs`);
    const lines = logRes.body.split('\n');
    // Find error and show context
    const errorIdx = lines.findIndex(l => /⨯|Error:|error:|FAILED|failed|##\[error\]/i.test(l));
    const start = Math.max(0, errorIdx - 5);
    console.log(lines.slice(start, Math.min(lines.length, start + 50)).join('\n'));
  }
}

main().catch(console.error);
