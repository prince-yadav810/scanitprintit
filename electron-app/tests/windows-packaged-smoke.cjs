// Windows-only integration test of the actual packaged modules and renderer.
// No OS print submission is allowed. getPrintersAsync is real; only its returned
// test device, its hardware snapshot, and the final print call are substituted.
const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

let report;
let directory;
let timer;
let server;

function finish(error) {
  if (error) {
    console.error(error.stack || error);
    if (report) report.error = error.stack || String(error);
  }
  if (directory && report) fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  clearTimeout(timer);
  server?.close();
  app.exit(error ? 1 : 0);
}

async function eventually(check, timeoutMs = 60000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for packaged application startup.');
}

async function main() {
  const archive = path.resolve(process.argv[2]);
  const mode = process.argv[3] || 'render';
  const outputRoot = path.resolve(process.argv[4] || 'windows-print-results');
  directory = path.join(outputRoot, mode);
  fs.mkdirSync(directory, { recursive: true });
  const pkg = require(path.join(archive, 'package.json'));
  report = { platform: process.platform, runtime: process.versions, archive, version: pkg.version, mode, events: [] };
  timer = setTimeout(() => finish(new Error('Windows packaged smoke test exceeded 120 seconds.')), 120000);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sip-ci-profile-'));
  for (const name of ['appData', 'userData', 'sessionData']) {
    const folder = path.join(profile, name);
    fs.mkdirSync(folder, { recursive: true });
    app.setPath(name, folder);
  }
  app.on('window-all-closed', () => {});
  app.on('web-contents-created', (_, contents) => {
    // A regression must never send paper, including during real main startup.
    contents.print = () => { throw new Error('Unexpected physical print submission in CI'); };
    contents.on('did-fail-load', (_, code, description, url, mainFrame) => {
      report.events.push({ event: 'did-fail-load', code, description, url, mainFrame });
    });
    contents.on('render-process-gone', (_, details) => report.events.push({ event: 'render-process-gone', ...details }));
    contents.on('preload-error', (_, filename, error) => report.events.push({ event: 'preload-error', filename, error: error.message }));
  });

  if (mode === 'startup') {
    // Exercise the real app's startup hooks in an empty support profile. The
    // package code remains unchanged, and the API is a local synthetic endpoint.
    server = http.createServer((request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.statusCode = request.url === '/api/agent/ping' ? 200 : 401;
      response.end(JSON.stringify(request.url === '/api/agent/ping' ? { ok: true } : { error: 'CI has no pairing' }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    process.env.SCANITPRINTIT_API = `http://127.0.0.1:${server.address().port}/api`;
    process.env.PORTABLE_EXECUTABLE_FILE = path.join(profile, 'Support.exe');
    process.argv.push('--diagnostics-only');
    const originalLoginSettings = app.setLoginItemSettings;
    app.setLoginItemSettings = () => { throw new Error('Support mode attempted to register Windows startup'); };
    // The harness runs packaged main.js in Electron, so make app identity match
    // the archive rather than Electron's development executable.
    app.getVersion = () => pkg.version;
    app.getAppPath = () => archive;
    await app.whenReady();
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
      callback({ cancel: !details.url.startsWith(process.env.SCANITPRINTIT_API + '/') });
    });
    require(path.join(archive, 'src/main/index.js'));
    const { getDiagnostics } = require(path.join(archive, 'src/main/diagnostics.js'));
    const result = await eventually(() => {
      const history = getDiagnostics()?.status().history || [];
      const failure = history.find(event => event.code === 'RENDER_SELF_TEST_FAILED');
      if (failure) throw new Error(`Real startup renderer self-test failed: ${failure.message}`);
      return history.find(event => event.code === 'RENDER_SELF_TEST_PASSED');
    });
    report.selfTest = result;
    const dashboard = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/index.html'));
    assert(dashboard, 'Packaged dashboard must load during real startup');
    const bridge = await dashboard.webContents.executeJavaScript('typeof window.api?.getAuthState');
    assert.equal(bridge, 'function');
    const agent = require(path.join(archive, 'src/main/agent.js'));
    assert.equal(agent.isDiagnosticsOnly(), true, 'The startup smoke test must not poll customer orders');
    agent.stop();
    getDiagnostics()?.stop();
    app.setLoginItemSettings = originalLoginSettings;
    report.success = true;
    console.log(`PASS: real Windows packaged main startup, dashboard/preload, renderer self-test. Version ${pkg.version}.`);
    finish();
    return;
  }

  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }));
  const { fixturePdf } = require(path.join(archive, 'src/main/renderer-self-test.js'));
  const fixture = path.join(directory, 'input.pdf');
  fs.writeFileSync(fixture, fixturePdf());
  const { printDocument } = require(path.join(archive, 'src/main/native-print.js'));
  if (mode === 'render') {
    await printDocument(fixture, {}, null, (message, detail) => report.events.push({ message, ...detail }), { validateOnly: true });
  } else if (mode === 'discovery-first') {
    // Exact production ordering: getPrintersAsync before loading print.html.
    // The underlying Chromium printer enumeration still executes on Windows.
    const windowsModule = require(path.join(archive, 'src/main/windows-printer.js'));
    windowsModule.getPrinterSnapshot = async () => ({ available: false, reason: 'CI has no physical printer' });
    // native-print captures getPrinterSnapshot at import, so reload after the stub.
    delete require.cache[require.resolve(path.join(archive, 'src/main/native-print.js'))];
    const native = require(path.join(archive, 'src/main/native-print.js'));
    let enumerations = 0;
    let submissions = 0;
    app.on('web-contents-created', (_, contents) => {
      const enumerate = contents.getPrintersAsync.bind(contents);
      contents.getPrintersAsync = async () => {
        const printers = await enumerate();
        enumerations++;
        report.events.push({ event: 'real-windows-printer-enumeration', names: printers.map(printer => printer.name) });
        return [...printers, { name: 'ScanItPrintIt CI Printer', isDefault: false }];
      };
      contents.print = (settings, callback) => {
        assert.equal(settings.deviceName, 'ScanItPrintIt CI Printer');
        submissions++;
        contents.printToPDF({ pageSize: 'A4', printBackground: true }).then(bytes => {
          assert(bytes.length > 500);
          fs.writeFileSync(path.join(directory, 'rendered.pdf'), bytes);
          callback(true);
        }, error => callback(false, error.message));
      };
    });
    await native.printDocument(fixture, { copies: 1, mode: 'BW', sides: 'SINGLE' }, 'ScanItPrintIt CI Printer',
      (message, detail) => report.events.push({ message, ...detail }));
    assert.equal(enumerations, 1);
    assert.equal(submissions, 1);
  } else throw new Error(`Unknown mode: ${mode}`);
  report.success = true;
  console.log(`PASS: Windows ${mode} against packaged version ${pkg.version}; physical print submission disabled.`);
  finish();
}

if (process.platform !== 'win32') {
  console.error('This regression check must run in real Windows Electron.');
  app.exit(1);
} else {
  main().catch(error => finish(error));
}
