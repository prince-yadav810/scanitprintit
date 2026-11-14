// Run with Node. Real Electron children reproduce the older-app launch conflict
// and verify profile separation. No windows, customer data, or network calls.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

if (process.argv.includes('--probe')) {
  const { app } = require('electron');
  const { configureAppProfile } = require('../src/main/app-profile');
  const directory = process.argv.at(-2);
  const mode = process.argv.at(-1);
  app.setPath('appData', directory);
  app.setPath('userData', path.join(directory, 'scanitprintit-agent'));
  configureAppProfile(app, mode === 'support');
  const acquired = app.requestSingleInstanceLock();
  console.log(JSON.stringify({ acquired, mode }));
  if (!acquired) app.exit(0);
  else {
    const timeout = setTimeout(() => app.exit(1), 30000);
    process.stdin.on('data', () => { clearTimeout(timeout); app.exit(0); });
    app.whenReady().then(() => {});
  }
} else {
  const { spawn } = require('node:child_process');
  const readline = require('node:readline');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'support-lock-smoke-'));
  fs.mkdirSync(path.join(directory, 'scanitprintit-agent'));
  const children = [];
  async function probe(mode) {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(require('electron'), [__filename, '--probe', directory, mode], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    children.push(child);
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No result for ${mode}: ${stderr}`)), 15000);
      child.on('exit', code => { if (code) { clearTimeout(timer); reject(new Error(`Probe exited ${code}: ${stderr}`)); } });
      readline.createInterface({ input: child.stdout }).on('line', line => {
        if (line.startsWith('{')) { clearTimeout(timer); resolve(JSON.parse(line)); }
      });
    });
  }
  (async () => {
    assert.equal((await probe('installed')).acquired, true);
    assert.equal((await probe('old-shared-profile')).acquired, false, 'Shared profile must reproduce the old launch conflict');
    assert.equal((await probe('support')).acquired, true, 'Support must open while the installed app holds its lock');
    assert.equal((await probe('support')).acquired, false, 'A second support launch must focus support, not the installed agent');
    console.log('PASS: real Electron reproduces the shared-profile conflict; installed and support profiles run independently, each with one instance.');
  })().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await Promise.all(children.map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve); child.stdin.write('quit\n');
      setTimeout(() => { if (child.exitCode === null) child.kill(); }, 1000).unref();
    })));
    fs.rmSync(directory, { recursive: true, force: true });
  });
}
