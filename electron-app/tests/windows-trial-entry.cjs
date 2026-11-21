const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

const archive = path.resolve(process.argv[2] || '.');
const output = process.argv[3];
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'sip-trial-entry-')));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const shop = { id: 'trial-qa', name: 'Trial Copy Centre', slug: 'trial-qa' };
const received = [];
let paired = false;
let approved = false;
let trial = { endsAt: new Date(Date.now() + 259_200_000).toISOString(), convertedAt: null };
const view = () => ({ ...trial, serverTime: Date.now() });

ipcMain.handle('updater:getVersion', () => '1.1.12');
ipcMain.handle('auth:getState', () => ({ paired, diagnosticsOnly: false }));
ipcMain.handle('auth:trial', (_, details) => {
  received.push(details);
  paired = true;
  return { success: true, trial: view() };
});
ipcMain.handle('settings:get', () => ({ darkTheme: true }));
ipcMain.handle('settings:printerHealth', () => ({ state: 'unknown', label: 'Printer status unavailable' }));
ipcMain.handle('engine:status', () => ({ status: 'ready' }));
ipcMain.handle('dashboard:get', () => ({ shop, trial: view(), today: {}, queue: approved ? [] : [
  { id: 'sample-order', orderNumber: '00112233', status: 'AWAITING_APPROVAL', pageCount: 1, files: [{ originalName: 'sample.pdf' }] },
] }));
ipcMain.handle('queue:approve', (_, id) => {
  assert.equal(id, 'sample-order');
  approved = true;
  return { success: true };
});
ipcMain.handle('stats:monthly', () => ({ dailyRevenue: [] }));
ipcMain.handle('diagnostics:status', () => ({}));

async function until(window, code) {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(code)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Trial entry screen did not reach the expected state');
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 960, height: 660,
    webPreferences: { preload: path.join(archive, 'src/main/preload.js'), contextIsolation: true, nodeIntegration: false } });
  await window.loadFile(path.join(archive, 'src/renderer/index.html'));
  await until(window, "document.getElementById('pair-screen').style.display === 'flex'");
  await window.webContents.executeJavaScript(`
    document.querySelector('#trial-options button').click();
    document.getElementById('trial-name').value = 'Trial Copy Centre';
    document.getElementById('trial-phone').value = '9000000012';
    document.getElementById('trial-form').requestSubmit();
  `);
  await until(window, "document.getElementById('trial-countdown').textContent.includes('3 days left')");
  assert.deepEqual(received, [{ shopName: 'Trial Copy Centre', phone: '9000000012' }]);
  await until(window, `document.getElementById('sidebar-shop-name').textContent === ${JSON.stringify(shop.name)}`);
  if (output) fs.writeFileSync(output, (await window.webContents.capturePage()).toPNG());
  await until(window, "document.querySelector('#queue-list').textContent.includes('Approve print')");
  await window.webContents.executeJavaScript("document.querySelector('#queue-list .btn-primary').click()");
  await until(window, "document.querySelector('#queue-list').textContent.includes('Queue is empty')");
  assert.equal(approved, true);
  trial = { ...trial, endsAt: new Date(Date.now() - 1000).toISOString() };
  await window.webContents.executeJavaScript('loadDashboard()');
  await until(window, "document.getElementById('trial-countdown').textContent === 'Trial ended'");
  trial = { ...trial, convertedAt: new Date().toISOString() };
  await window.webContents.executeJavaScript('loadDashboard()');
  await until(window, "document.getElementById('trial-banner').hidden");
  console.log('Packaged trial form, three-day countdown, expiry and paid conversion passed.');
  app.exit(0);
}).catch(error => {
  console.error(error);
  app.exit(1);
});
