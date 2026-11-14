const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { load, clock, settle } = require('./helpers.cjs');

function setup(options = {}) {
  const timers = clock();
  const handlers = new Map();
  let win;
  class Window extends EventEmitter {
    constructor(config) {
      super(); this.config = config; this.destroyed = false;
      this.webContents = Object.assign(new EventEmitter(), {
        id: 7,
        getPrintersAsync: async () => options.printers ?? [{ name: 'Canon LBP2900', isDefault: true }],
        executeJavaScript: async () => options.render ?? { success: true, pages: 2 },
        print: (settings, callback) => { this.settings = settings; this.callback = callback; },
        printToPDF: async () => Buffer.alloc(1000),
      });
      win = Object.assign(this, {});
    }
    loadFile(file) { this.loadedFile = file; return options.load?.() ?? Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const service = load(path.resolve(__dirname, '../src/main/native-print.js'), {
    electron: { BrowserWindow: Window, ipcMain: {
      handle: (channel, handler) => handlers.set(channel, handler),
      removeHandler: channel => handlers.delete(channel),
    } },
    fs: { promises: { readFile: async () => Buffer.from('%PDF-1.4') } },
    './windows-printer': { getPrinterSnapshot: async () => options.snapshot ?? { available: false } },
  }, timers);
  return { ...service, timers, handlers, get win() { return win; } };
}

test('waits for the callback and driver grace period, retaining pages and print options', async () => {
  const s = setup();
  let done = false;
  const printing = s.printDocument('/tmp/test document.pdf', { copies: 3, mode: 'COLOR', sides: 'DOUBLE' }).then(() => { done = true; });
  await settle();
  assert.equal(done, false);
  assert.equal(s.win.destroyed, false);
  assert.equal(s.win.settings.copies, 3);
  assert.equal(s.win.settings.deviceName, 'Canon LBP2900');
  assert.equal(s.win.settings.color, true);
  assert.equal(s.win.settings.duplexMode, 'longEdge');
  assert.match(s.win.loadedFile, /print\.html$/);
  s.win.callback(true);
  await settle();
  assert.equal(done, false);
  assert.equal(s.win.destroyed, false);
  s.timers.advance(8000);
  await printing;
  assert.equal(s.win.destroyed, true);
  assert.equal(s.handlers.size, 0);
});

test('Windows rejection becomes a failure and cleans up the window', async () => {
  const s = setup();
  const printing = s.printDocument('/tmp/document.pdf');
  const rejected = assert.rejects(printing, /Windows rejected.*Invalid printer settings/);
  await settle();
  s.win.callback(false, 'Invalid printer settings');
  await rejected;
  assert.equal(s.win.destroyed, true);
  assert.equal(s.handlers.size, 0);
});

test('an installed but offline printer is rejected before any paper submission', async () => {
  const s = setup({ snapshot: { available: true, printer: { Name: 'Canon LBP2900', WorkOffline: true } } });
  await assert.rejects(s.printDocument('/tmp/document.pdf'), /Windows reports offline/);
  assert.equal(s.win.callback, undefined);
  assert.equal(s.win.destroyed, true);
  assert.equal(s.handlers.size, 0);
});

test('a missing print callback times out without reporting success or printing twice', async () => {
  const s = setup();
  const printing = s.printDocument('/tmp/document.pdf');
  const rejected = assert.rejects(printing, /Print completion timed out/);
  await settle();
  s.timers.advance(120000);
  await rejected;
  assert.equal(s.win.destroyed, true);
  s.win.callback(true); // A late callback is ignored.
  assert.equal(s.handlers.size, 0);
});

test('a hung document load times out and never calls print', async () => {
  const s = setup({ load: () => new Promise(() => {}) });
  const rejected = assert.rejects(s.printDocument('/tmp/document.pdf'), /Print page failed to load/);
  await settle();
  s.timers.advance(30000);
  await rejected;
  assert.equal(s.win.callback, undefined);
  assert.equal(s.win.destroyed, true);
});

test('render failure and an unavailable selected printer are surfaced before printing', async () => {
  for (const options of [{ render: { success: false, error: 'Invalid PDF' } }, { printers: [] }]) {
    const s = setup(options);
    await assert.rejects(s.printDocument('/tmp/document.pdf', {}, 'Canon LBP2900'), /Invalid PDF|unavailable/);
    assert.equal(s.win.callback, undefined);
    assert.equal(s.win.destroyed, true);
  }
});

test('renderer crash releases the pending print', async () => {
  const s = setup();
  const rejected = assert.rejects(s.printDocument('/tmp/document.pdf'), /Print renderer stopped: crashed/);
  await settle();
  s.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  await rejected;
  assert.equal(s.win.destroyed, true);
});

test('only the dedicated print window may read the current document', async () => {
  const s = setup();
  const printing = s.printDocument('/tmp/document.pdf');
  await settle();
  const handler = [...s.handlers.values()][0];
  await assert.rejects(handler({ sender: { id: 88 } }), /Invalid print document request/);
  assert.equal((await handler({ sender: { id: 7 } })).toString(), '%PDF-1.4');
  s.win.callback(true);
  await settle();
  s.timers.advance(8000);
  await printing;
});

test('startup verification renders and exports the document without submitting a physical print', async () => {
  const s = setup({ printers: [] });
  const result = await s.printDocument('/tmp/test.pdf', {}, null, () => {}, { validateOnly: true });
  assert.equal(result.pages, 2);
  assert.equal(s.win.callback, undefined);
  assert.equal(s.win.destroyed, true);
});

test('failure preserves the exact print stage and whether Windows submission was attempted', async () => {
  const s = setup({ render: { success: false, error: 'Invalid PDF' } });
  await assert.rejects(s.printDocument('/tmp/test.pdf'), error => error.printStage === 'document-render' && !error.submissionUncertain);
  const t = setup();
  const rejected = assert.rejects(t.printDocument('/tmp/test.pdf'), error => error.printStage === 'windows-submission' && error.submissionUncertain);
  await settle(); t.win.callback(false, 'Invalid printer settings'); await rejected;
});
