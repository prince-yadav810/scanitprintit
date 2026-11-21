const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { load, settle } = require('./helpers.cjs');

async function setup({ locked = true, printing = false, support = false, storePackage = false, verifyRenderer = async () => ({ success: true }) } = {}) {
  const windows = [];
  const handlers = new Map();
  const counters = { starts: 0, stops: 0, installed: 0, quit: 0, exited: 0, loginItems: 0 };
  const app = Object.assign(new EventEmitter(), {
    requestSingleInstanceLock: () => { assert.equal(counters.profileConfigured, true, 'The profile must be selected before the launch lock'); return locked; },
    whenReady: () => { assert.equal(counters.schemeRegistered, true, 'Print scheme privileges must be registered before app readiness'); return Promise.resolve(); },
    getVersion: () => '1.1.8', getAppPath: () => path.resolve(__dirname, '..'),
    getPath: () => '/tmp/agent.exe', setLoginItemSettings() { counters.loginItems++; },
    quit() {
      let prevented = false;
      this.emit('before-quit', { preventDefault: () => { prevented = true; } });
      if (!prevented) {
        counters.quit++;
        for (const win of windows) win.emit('close', { preventDefault: () => { win.closePrevented = true; } });
      }
    },
    exit() { counters.exited++; },
  });
  let resolveIdle;
  let active = printing;
  const idle = printing ? new Promise(resolve => { resolveIdle = resolve; }) : Promise.resolve();
  const agent = {
    start(_, __, options) { counters.starts++; counters.support = options?.diagnosticsOnly; }, stop() { counters.stops++; },
    isPrinting: () => active, waitForIdle: () => idle,
    setRendererReadiness(result) { counters.readiness = result; },
  };
  class Window extends EventEmitter {
    constructor() {
      super(); windows.push(this);
      this.webContents = Object.assign(new EventEmitter(), { send() {}, toggleDevTools() {} });
    }
    loadFile() {} isDestroyed() { return false; }
    show() { this.shown = true; } focus() { this.focused = true; } hide() { this.hidden = true; }
  }
  class Tray { setToolTip() {} setContextMenu(menu) { this.menu = menu; } on() {} }
  const Menu = { buildFromTemplate: template => template, setApplicationMenu: template => { Menu.template = template; } };
  const updater = Object.assign(new EventEmitter(), {
    checkForUpdates: async () => {}, quitAndInstall() { counters.installed++; },
  });
  const fakeProcess = Object.assign(new EventEmitter(), { platform: 'win32', argv: [], windowsStore: storePackage, env: support ? { PORTABLE_EXECUTABLE_FILE: 'Support.exe' } : {} });
  load(path.resolve(__dirname, '../src/main/index.js'), {
    electron: { app, BrowserWindow: Window, Tray, Menu, ipcMain: { handle: (key, callback) => handlers.set(key, callback) }, nativeImage: { createFromPath() {}, createEmpty() {} }, dialog: { showErrorBox() {} } },
    'electron-store': class { get(_, fallback) { return fallback; } },
    './agent': agent, './ipc-handlers': { register() {} },
    './app-profile': {
      configureAppProfile(_, supportMode) { counters.profileConfigured = true; return { support: supportMode }; },
      importSupportPairing() { return false; },
    },
    './diagnostics': { recordDiagnostic() {}, createDiagnostics: () => ({ start() {}, stop() {}, flush: async () => {} }) },
    './renderer-self-test': { verifyRenderer },
    './print-assets': { registerPrintAssetScheme() { counters.schemeRegistered = true; } },
    'electron-updater': { autoUpdater: updater },
  }, { process: fakeProcess, setTimeout: () => {} });
  await settle();
  return { app, Menu, updater, handlers, windows, counters, finishPrint() { active = false; resolveIdle?.(); } };
}

test('a second agent process exits without starting another polling loop', async () => {
  const s = await setup({ locked: false });
  assert.equal(s.counters.starts, 0);
  assert.equal(s.counters.quit, 1);
  assert.equal(s.windows.length, 0);
});

test('startup leaves the engine checking until verification succeeds', async () => {
  let finish;
  const s = await setup({ verifyRenderer: () => new Promise(resolve => { finish = resolve; }) });
  assert.equal(s.counters.starts, 1, 'Auth and diagnostics still initialize');
  assert.equal(s.counters.readiness.status, 'checking');
  finish({ success: true });
  await settle();
  assert.equal(s.counters.readiness.status, 'ready');
});

test('failed startup remains paused and an explicit successful retry restores readiness', async () => {
  let checks = 0;
  const s = await setup({ verifyRenderer: async () => ++checks === 1 ? { success: false, error: 'Missing renderer' } : { success: true } });
  assert.equal(s.counters.readiness.status, 'failed');
  assert.equal(s.counters.readiness.error, 'Missing renderer');
  assert.equal((await s.handlers.get('engine:retry')()).success, true);
  assert.equal(s.counters.readiness.status, 'ready');
});

test('the standalone launcher enables support mode and does not register itself for Windows startup', async () => {
  const s = await setup({ support: true });
  assert.equal(s.counters.support, true);
  assert.equal(s.counters.loginItems, 0);
  assert.equal(s.updater.autoDownload, false);
  assert.equal(s.updater.autoInstallOnAppQuit, false);
  assert.equal((await s.handlers.get('updater:check')()).success, false);
  const result = s.handlers.get('updater:install')();
  assert.equal(result.success, false); assert.match(result.error, /Support mode/);
});

test('the Store package starts the print agent and leaves update and startup management to Windows', async () => {
  const s = await setup({ storePackage: true });
  assert.equal(s.counters.starts, 1);
  assert.equal(s.counters.loginItems, 0);
  assert.equal(s.updater.autoDownload, false);
  assert.equal(s.updater.autoInstallOnAppQuit, false);
  assert.match((await s.handlers.get('updater:check')()).error, /Microsoft Store/);
  assert.match(s.handlers.get('updater:install')().error, /Microsoft Store/);
});

test('close hides the dashboard; File Quit really exits after the current job', async () => {
  const s = await setup({ printing: true });
  const win = s.windows[0];
  let prevented = false;
  win.emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(win.hidden, true);
  const quitting = s.Menu.template[0].submenu[0].click();
  await settle();
  assert.equal(s.counters.quit, 0);
  assert.equal(s.counters.stops, 1);
  s.finishPrint();
  await quitting;
  assert.equal(s.counters.quit, 1);
  assert.equal(win.closePrevented, undefined);
});

test('update installation requires a downloaded update and cannot interrupt printing', async () => {
  const s = await setup({ printing: true });
  const install = s.handlers.get('updater:install');
  assert.equal(install().success, false);
  s.updater.emit('update-downloaded', { version: '1.1.6' });
  assert.equal(install().success, false);
  assert.equal(s.counters.installed, 0);
  s.finishPrint();
  assert.equal(install().success, true);
  assert.equal(s.counters.installed, 1);
  assert.ok(s.counters.stops > 0);
});

test('second launch focuses the dashboard and a shutdown launch quits instead of hiding', async () => {
  const s = await setup();
  s.app.emit('second-instance', {}, ['agent.exe']);
  assert.equal(s.windows[0].focused, true);
  assert.equal(s.counters.starts, 1);
  s.app.emit('second-instance', {}, ['agent.exe', '--quit-for-update']);
  await settle();
  assert.equal(s.counters.quit, 1);
  assert.equal(s.windows[0].closePrevented, undefined);
});

test('failed update installation resumes the agent instead of leaving polling stopped', async () => {
  const s = await setup();
  s.updater.emit('update-downloaded', { version: '1.1.6' });
  s.updater.quitAndInstall = () => s.updater.emit('error', new Error('Installer unavailable'));
  assert.equal(s.handlers.get('updater:install')().success, false);
  assert.equal(s.counters.starts, 2);
  assert.equal(s.counters.quit, 0);
  let prevented = false;
  s.windows[0].emit('close', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
});
