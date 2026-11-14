// Run with Electron and a Windows app.asar path. Uses the real packaged UI and
// preload; IPC responses are simulated. No production requests or paper prints.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const archive = path.resolve(process.argv.at(-1));
const timeout = setTimeout(() => { console.error('Support UI timed out'); app.exit(1); }, 30000);

app.whenReady().then(async () => {
  try {
    const pkg = require(path.join(archive, 'package.json'));
    assert.equal(pkg.version, require('../package.json').version);
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }));
    let testPages = 0;
    let health = { state: 'idle', printer: 'Canon LBP2900', label: 'Windows reports idle · connection unverified' };
    const handlers = {
      'updater:getVersion': () => pkg.version,
      'auth:getState': () => ({ paired: true, diagnosticsOnly: true }),
      'settings:get': () => ({ selectedPrinter: 'Canon LBP2900' }),
      // A slow/offline dashboard must not hide the build identity or printer test.
      'dashboard:get': () => new Promise(() => {}),
      'settings:getPrinters': () => ({ printers: ['Canon LBP2900'], defaultPrinter: 'Canon LBP2900' }),
      'settings:printerHealth': () => health,
      'settings:getRemote': () => ({}),
      'settings:getQrCode': () => ({ success: false }),
      'diagnostics:status': () => ({ pending: 0, history: [] }),
      'diagnostics:printTestPage': () => { testPages++; return { success: true }; },
    };
    Object.entries(handlers).forEach(([channel, handler]) => ipcMain.handle(channel, handler));
    const win = new BrowserWindow({ width: 1200, height: 800, show: false, webPreferences: {
      preload: path.join(archive, 'src/main/preload.js'), contextIsolation: true, nodeIntegration: false,
    } });
    await win.loadFile(path.join(archive, 'src/renderer/index.html'));
    const initial = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const until = Date.now() + 10000;
      function check() {
        const banner = document.getElementById('support-banner');
        if (getComputedStyle(banner).display === 'flex') return resolve({
          version: document.getElementById('current-version').textContent,
          title: document.title,
          label: document.getElementById('support-build-label').textContent,
          buttonVisible: document.getElementById('btn-support-print-test').getBoundingClientRect().height > 0,
        });
        if (Date.now() > until) reject(new Error('Support banner is missing')); else setTimeout(check, 20);
      } check();
    })`);
    assert.equal(initial.version, `v${pkg.version}`);
    assert.equal(initial.label, `ScanItPrintIt Support v${pkg.version}`);
    assert.equal(initial.title, initial.label);
    assert.equal(initial.buttonVisible, true);
    await win.webContents.executeJavaScript('refreshPrinterHealth()');
    assert.match(await win.webContents.executeJavaScript("document.getElementById('label-printer').textContent"), /connection unverified/);
    assert.equal(await win.webContents.executeJavaScript("document.getElementById('dot-printer').className"), 'dot yellow');
    assert.equal(await win.webContents.executeJavaScript('printerMonitor !== null'), true);
    health = { state: 'offline', printer: 'Canon LBP2900', label: 'Windows reports offline' };
    await win.webContents.executeJavaScript('refreshPrinterHealth()');
    assert.match(await win.webContents.executeJavaScript("document.getElementById('label-printer').textContent"), /offline/);
    assert.equal(await win.webContents.executeJavaScript("document.getElementById('dot-printer').className"), 'dot red');
    await win.webContents.executeJavaScript(`document.getElementById('btn-support-print-test').click()`);
    const result = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const until = Date.now() + 5000;
      function check() {
        const text = document.getElementById('printer-test-result').textContent;
        if (text.includes('Windows accepted')) return resolve(text);
        if (Date.now() > until) reject(new Error('Printer test did not respond')); else setTimeout(check, 20);
      } check();
    })`);
    assert.match(result, /Windows accepted/);
    assert.equal(testPages, 1);
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('page-settings').classList.contains('active')`), true);
    // Allow the compositor to draw the selected page before capturePage.
    await new Promise(resolve => setTimeout(resolve, 150));
    const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'support-ui-')), 'support.png');
    fs.writeFileSync(output, (await win.webContents.capturePage()).toPNG());
    console.log(`PASS: packaged v${pkg.version} shows support identity and a working test-page button while the dashboard is unavailable. Screenshot: ${output}`);
    clearTimeout(timeout); app.exit(0);
  } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1); }
});
