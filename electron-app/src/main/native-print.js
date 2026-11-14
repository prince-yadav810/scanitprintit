const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BrowserWindow, ipcMain } = require('electron');
const { getPrinterSnapshot } = require('./windows-printer');
const { describePrinter } = require('./printer-health');

function bounded(operation, timeoutMs, message, abort) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([operation, timeout, abort]).finally(() => clearTimeout(timer));
}

// Print rendered pages, rather than Chromium's PDF viewer. The PDF plugin can
// bypass the normal print completion callback even when it submits a job.
async function printDocument(filePath, settings = {}, deviceName, log = () => {}, options = {}) {
  const copies = Number(settings.copies ?? 1);
  if (!Number.isInteger(copies) || copies < 1) throw new Error('Invalid number of copies.');

  const channel = `print:document:${crypto.randomUUID()}`;
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'print-preload.js'),
      additionalArguments: [`--print-channel=${channel}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  let disposed = false;
  let stage = 'printer-discovery';
  let selectedPrinter;
  const startedAt = Date.now();
  const report = (message, detail = {}) => log(message, { stage, elapsedMs: Date.now() - startedAt, ...detail });
  let rejectAbort;
  const abort = new Promise((_, reject) => { rejectAbort = reject; });
  // Also handle a close between stages, before the next Promise.race attaches.
  abort.catch(() => {});
  const onClosed = () => rejectAbort(new Error('The print window closed before completion.'));
  const onCrash = (_, details) => rejectAbort(new Error(`Print renderer stopped: ${details.reason}`));
  win.once('closed', onClosed);
  win.webContents.once('render-process-gone', onCrash);
  const onPreloadError = (_, __, error) => report('Print preload failed', { level: 'error', code: 'PRELOAD_FAILED', error: error.message });
  const onConsole = (_, detail, legacyMessage) => {
    const level = typeof detail === 'object' ? detail.level : detail;
    if (level === 'error' || level === 'warning' || level > 1) {
      report('Print renderer diagnostic', { level: level === 'error' || level > 2 ? 'error' : 'warn', code: 'RENDERER_CONSOLE', error: typeof detail === 'object' ? detail.message : legacyMessage });
    }
  };
  win.webContents.on('preload-error', onPreloadError);
  win.webContents.on('console-message', onConsole);

  ipcMain.handle(channel, async (event) => {
    if (disposed || event.sender.id !== win.webContents.id) throw new Error('Invalid print document request.');
    return fs.promises.readFile(filePath);
  });

  try {
    report('Starting printer discovery', { code: 'PRINT_PREPARING', validateOnly: !!options.validateOnly });
    if (!options.validateOnly) {
    const printers = await bounded(win.webContents.getPrintersAsync(), 15000, 'Printer discovery timed out.', abort);
    const printer = deviceName
      ? printers.find(p => p.name === deviceName)
      : printers.find(p => p.isDefault);
    if (!printer) throw new Error(deviceName
      ? `Printer "${deviceName}" is unavailable. Check Settings and the Windows driver.`
      : 'No default printer found. Select a printer in Settings.');
    selectedPrinter = printer.name;
    report('Printer selected', { code: 'PRINTER_SELECTED', printer: printer.name, status: printer.status, printerCount: printers.length });
    const snapshot = await getPrinterSnapshot(printer.name);
    report('Windows printer status before submission', { code: 'SPOOLER_BEFORE', ...snapshot });
    const health = describePrinter(snapshot, printer.name);
    if (health.blocking) throw new Error(`${health.label}. Check the printer and Windows queue before retrying.`);
    }

    stage = 'document-load';
    await bounded(win.loadFile(path.join(__dirname, '../renderer/print.html')), 30000, 'Print page failed to load.', abort);
    stage = 'document-render';
    const result = await bounded(win.webContents.executeJavaScript(`(async () => {
      if (typeof window.printDocument?.read !== 'function') throw new Error('Print preload bridge is unavailable.');
      if (!window.printReady || typeof window.printReady.then !== 'function') throw new Error('Print renderer module did not initialize.');
      return window.printReady;
    })()`), 120000, 'Document rendering timed out.', abort);
    if (!result?.success || !result.pages) throw new Error(result?.error || 'The document has no printable pages.');
    report(`Rendered ${result.pages} page(s).`, { code: 'RENDER_COMPLETE', pages: result.pages, copies });
    if (options.validateOnly) {
      const output = await bounded(win.webContents.printToPDF({ pageSize: 'A4', printBackground: true }), 30000, 'Renderer self-test PDF export timed out.', abort);
      if (output.length < 500) throw new Error('Renderer self-test produced an empty PDF.');
      report('Renderer self-test passed without printing paper', { code: 'RENDER_SELF_TEST_PASSED', pages: result.pages, bytes: output.length });
      return { pages: result.pages };
    }

    stage = 'windows-submission';
    report('Submitting rendered pages to Windows', { code: 'PRINT_SUBMIT', printer: selectedPrinter, copies, mode: settings.mode, sides: settings.sides });
    await bounded(new Promise((resolve, reject) => {
      // WebContents.print returns void; its callback reports the
      // result. Awaiting print() itself would close the window too early.
      win.webContents.print({
        silent: true,
        deviceName: selectedPrinter,
        copies,
        collate: true,
        color: settings.mode === 'COLOR',
        duplexMode: settings.sides === 'DOUBLE' ? 'longEdge' : 'simplex',
        printBackground: true,
        pageSize: 'A4',
        margins: { marginType: 'none' },
      }, (success, reason) => {
        if (disposed) return;
        if (success) resolve();
        else reject(new Error(`Windows rejected the print job: ${reason || 'Unknown print error'}`));
      });
    }), 120000, 'Print completion timed out. Check the Windows queue before retrying; pages may already have printed.', abort);

    stage = 'windows-spooling';
    report('Windows accepted the print job. Keeping the document open while the driver spools.', { code: 'PRINT_ACCEPTED' });
    await bounded(new Promise(resolve => setTimeout(resolve, 8000)), 10000, 'Spooling wait timed out.', abort);
    report('Windows printer status after submission', { code: 'SPOOLER_AFTER', ...(await getPrinterSnapshot(selectedPrinter)) });
  } catch (error) {
    error.printStage = stage;
    error.submissionUncertain = ['windows-submission', 'windows-spooling'].includes(stage);
    report(error.message, { level: 'error', code: 'PRINT_FAILED', error: error.message, submissionUncertain: error.submissionUncertain });
    if (selectedPrinter) report('Windows printer status after failure', { code: 'SPOOLER_FAILURE', ...(await getPrinterSnapshot(selectedPrinter)) });
    throw error;
  } finally {
    disposed = true;
    ipcMain.removeHandler(channel);
    win.removeListener('closed', onClosed);
    win.webContents.removeListener('render-process-gone', onCrash);
    win.webContents.removeListener('preload-error', onPreloadError);
    win.webContents.removeListener('console-message', onConsole);
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { printDocument };
