const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./helpers.cjs');

function setup(support, printerSnapshot = async () => ({ available: false })) {
  const handlers = new Map();
  const values = {};
  const startup = [];
  const store = { get: (key, fallback) => values[key] ?? fallback, set: (key, value) => { values[key] = value; } };
  const ipc = load(path.resolve(__dirname, '../src/main/ipc-handlers.js'), {
    electron: { app: { setLoginItemSettings: value => startup.push(value) } },
    './agent': { isDiagnosticsOnly: () => support },
    './windows-printer': { getPrinterSnapshot: printerSnapshot },
  });
  ipc.register({ handle: (channel, handler) => handlers.set(channel, handler) }, store, {});
  return { handlers, values, startup };
}

test('selecting a printer in support mode cannot register the temporary executable for Windows startup', async () => {
  const s = setup(true);
  await s.handlers.get('settings:save')({}, { selectedPrinter: 'Canon LBP2900', autoLaunch: true });
  assert.equal(s.values.selectedPrinter, 'Canon LBP2900');
  assert.equal(s.values.autoLaunch, undefined);
  assert.equal(s.startup.length, 0);
  assert.equal(s.handlers.get('settings:get')().autoLaunch, false);
});

test('the installed agent can still change its Windows startup preference', async () => {
  const s = setup(false);
  await s.handlers.get('settings:save')({}, { autoLaunch: false });
  assert.equal(s.values.autoLaunch, false);
  assert.equal(s.startup.length, 1);
  assert.equal(s.startup[0].openAtLogin, false);
});

test('health requests refresh Windows status rather than reusing installed printer presence', async () => {
  let offline = false;
  const s = setup(true, async name => ({ available: true, printer: { Name: name, WorkOffline: offline, PrinterStatus: 3 } }));
  s.values.selectedPrinter = 'Canon';
  assert.equal(s.handlers.get('settings:get')().printerHealthEnabled, true);
  assert.equal((await s.handlers.get('settings:printerHealth')()).state, 'idle');
  offline = true;
  assert.equal((await s.handlers.get('settings:printerHealth')()).state, 'offline');
  s.values.printerHealthEnabled = false;
  assert.equal((await s.handlers.get('settings:printerHealth')()).state, 'disabled');
});
