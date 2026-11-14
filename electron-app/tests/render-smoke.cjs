// Runs the real bundled renderer. Produces PDFs only; never sends a job to a
// printer or connects to the production API.
const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

app.disableHardwareAcceleration();
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanitprintit-render-'));
const timeout = setTimeout(() => { console.error('Renderer smoke test timed out.'); app.exit(1); }, 60000);

app.whenReady().then(async () => {
  const channel = `print:document:${crypto.randomUUID()}`;
  let bytes;
  const win = new BrowserWindow({ width: 850, height: 1200, show: false, webPreferences: {
    preload: path.resolve(__dirname, '../src/main/print-preload.js'),
    additionalArguments: [`--print-channel=${channel}`],
    contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
  } });
  win.webContents.on('console-message', (_, detail) => { if (detail.level === 'error') console.error('Renderer:', detail.message); });
  ipcMain.handle(channel, () => bytes);
  try {
    const fixture = `<style>@page { size: A4; margin: 0; } body { margin: 0; } section { box-sizing: border-box; padding: 24mm; height: 297mm; break-after: page; } section:last-child { break-after: auto; }</style><section><h1>ScanItPrintIt print test</h1><p>Page 1: readable PDF text</p><div style="width:100px;height:100px;background:#d97706"></div></section><section><h1>Second page</h1><p>Page 2: copies should remain complete documents.</p><p>1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ</p></section>`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fixture)}`);
    bytes = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    fs.writeFileSync(path.join(outputDir, 'input.pdf'), bytes);
    const printPage = path.resolve(__dirname, '../src/renderer/print.html');
    await win.loadFile(printPage);
    const result = await win.webContents.executeJavaScript('window.printReady');
    assert.equal(result.success, true, result.error);
    assert.equal(result.pages, 2);
    const screenshot = await win.webContents.capturePage({ x: 0, y: 0, width: 850, height: 1200 });
    fs.writeFileSync(path.join(outputDir, 'rendered.png'), screenshot.toPNG());
    bytes = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    fs.writeFileSync(path.join(outputDir, 'rendered.pdf'), bytes);
    await win.loadFile(printPage);
    const roundTrip = await win.webContents.executeJavaScript('window.printReady');
    assert.equal(roundTrip.success, true, roundTrip.error);
    assert.equal(roundTrip.pages, 2, 'Rasterized document must preserve page count without extra blank pages.');

    bytes = Buffer.from('<html>bad cloud download</html>');
    await win.loadFile(printPage);
    const invalid = await win.webContents.executeJavaScript('window.printReady');
    assert.equal(invalid.success, false);
    assert.match(invalid.error, /not a PDF/);
    const { verifyRenderer } = require('../src/main/renderer-self-test');
    const selfTest = await verifyRenderer();
    assert.equal(selfTest.success, true, selfTest.error);
    // verifyRenderer uses the same native-print service as production, with paper submission disabled.
    console.log(`PASS: real PDF renderer, two-page PDF round trip, invalid download rejection, startup self-test. Artifacts: ${outputDir}`);
    clearTimeout(timeout);
    ipcMain.removeHandler(channel);
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  }
}).catch(error => { console.error(error); app.exit(1); });
