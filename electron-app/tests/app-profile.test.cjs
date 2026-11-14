const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { configureAppProfile, importSupportPairing } = require('../src/main/app-profile');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'support-profile-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const installed = path.join(directory, 'scanitprintit-agent');
  fs.mkdirSync(installed);
  const paths = { appData: directory, userData: installed, sessionData: installed };
  const app = {
    getPath: key => paths[key],
    setPath(key, value) { assert(fs.statSync(value).isDirectory()); paths[key] = value; },
    setName(name) { this.name = name; }, setAppUserModelId() {},
  };
  const values = new Map();
  const store = {
    get: key => values.get(key),
    set(key, value) { if (typeof key === 'object') Object.entries(key).forEach(([k, v]) => values.set(k, v)); else values.set(key, value); },
  };
  return { directory, installed, paths, app, store, values };
}

test('support chooses a different lock/cache profile without changing the installed profile', t => {
  const f = fixture(t);
  const normal = configureAppProfile(f.app, false);
  assert.equal(f.paths.userData, f.installed);
  assert.equal(normal.support, false);
  const support = configureAppProfile(f.app, true);
  assert.notEqual(f.paths.userData, f.installed);
  assert.equal(f.paths.sessionData, f.paths.userData);
  assert.equal(f.app.name, 'ScanItPrintIt Support');
  assert(support.installedDirectories.includes(f.installed));
  assert(!support.installedDirectories.includes(f.paths.userData));
});

test('support imports pairing but never imports active jobs or writes the installed config', t => {
  const f = fixture(t);
  const oldConfig = JSON.stringify({ token: 'paired-test-token', shopId: 'shop-test', shopName: 'Test shop', selectedPrinter: 'Canon test',
    pendingStatuses: { order: { status: 'PRINTED' } }, activePrintAttempt: { orderId: 'order' }, diagnosticOutbox: [{ id: 'old' }], autoLaunch: true });
  const file = path.join(f.installed, 'config.json');
  fs.writeFileSync(file, oldConfig);
  const profile = configureAppProfile(f.app, true);
  assert.equal(importSupportPairing(f.store, profile), true);
  assert.equal(f.store.get('token'), 'paired-test-token');
  assert.equal(f.store.get('selectedPrinter'), 'Canon test');
  for (const key of ['activePrintAttempt', 'pendingStatuses', 'diagnosticOutbox', 'autoLaunch']) assert.equal(f.store.get(key), undefined);
  assert.equal(fs.readFileSync(file, 'utf8'), oldConfig);
  f.values.delete('token');
  assert.equal(importSupportPairing(f.store, profile), false);
  assert.equal(f.store.get('token'), undefined, 'Explicitly unpairing support must stay unpaired');
});

test('an existing support pairing wins over the installed pairing', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.installed, 'config.json'), JSON.stringify({ token: 'older-pairing' }));
  f.store.set('token', 'support-pairing');
  assert.equal(importSupportPairing(f.store, configureAppProfile(f.app, true)), false);
  assert.equal(f.store.get('token'), 'support-pairing');
});

test('a damaged installed profile falls back to another known profile without crashing', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.installed, 'config.json'), '{broken');
  const fallback = path.join(f.directory, 'ScanItPrintIt Agent');
  fs.mkdirSync(fallback);
  fs.writeFileSync(path.join(fallback, 'config.json'), JSON.stringify({ token: 'fallback-pairing' }));
  assert.equal(importSupportPairing(f.store, configureAppProfile(f.app, true)), true);
  assert.equal(f.store.get('token'), 'fallback-pairing');
});
