// Windows-only integration test of the actual packaged modules and renderer.
// No OS print submission is allowed. getPrintersAsync is real; only its returned
// test device, its hardware snapshot, and the final print call are substituted.
const { app, BrowserWindow, session, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');

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

async function orderFlow(archive, fixturePdf) {
  const printerName = 'ScanItPrintIt CI Printer';
  const orderId = 'ci-synthetic-order';
  const token = 'ci-local-pairing';
  const settings = { copies: 2, mode: 'COLOR', sides: 'DOUBLE' };
  const pdf = fixturePdf();
  const statuses = [];
  let polls = 0;
  let downloads = 0;
  let enumerations = 0;
  let submissions = 0;
  let serverError;
  const data = { token, selectedPrinter: printerName };
  const store = {
    get: (key, fallback) => data[key] ?? fallback,
    set: (key, value) => { data[key] = value; },
    delete: key => { delete data[key]; },
  };
  server = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      try {
        if (request.url === '/fixture.pdf') {
          downloads++;
          response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length });
          response.end(pdf);
          return;
        }
        assert.equal(request.headers.authorization, `Bearer ${token}`);
        response.setHeader('Content-Type', 'application/json');
        if (request.url === '/api/agent/ping') {
          response.end(JSON.stringify({ ok: true }));
        } else if (request.method === 'GET' && request.url === '/api/agent/jobs') {
          polls++;
          // Deliberately return the same order again after completion. The
          // durable printed-job cache must sync its status without reprinting.
          response.end(JSON.stringify({ success: true, jobs: [{
            id: orderId, orderNumber: 'CI-ONLY', settings, simulationEnabled: false,
            files: [{ id: 'ci-file', originalName: 'fixture.pdf', status: 'UPLOADED',
              cloudinaryUrl: `http://127.0.0.1:${server.address().port}/fixture.pdf` }],
          }] }));
        } else if (request.method === 'POST' && request.url === `/api/agent/jobs/${orderId}/status`) {
          statuses.push(JSON.parse(body).status);
          response.end(JSON.stringify({ success: true }));
        } else {
          throw new Error(`Unexpected synthetic API request: ${request.method} ${request.url}`);
        }
      } catch (error) {
        serverError = error;
        response.statusCode = 500;
        response.end(JSON.stringify({ error: error.message }));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.SCANITPRINTIT_API = `http://127.0.0.1:${server.address().port}/api`;
  const windowsModule = require(path.join(archive, 'src/main/windows-printer.js'));
  windowsModule.getPrinterSnapshot = async () => ({ available: false, reason: 'CI has no physical printer' });
  delete require.cache[require.resolve(path.join(archive, 'src/main/native-print.js'))];
  app.on('web-contents-created', (_, contents) => {
    const enumerate = contents.getPrintersAsync.bind(contents);
    contents.getPrintersAsync = async () => {
      const printers = await enumerate();
      enumerations++;
      report.events.push({ event: 'real-windows-printer-enumeration', names: printers.map(printer => printer.name) });
      return [...printers, { name: printerName, isDefault: false }];
    };
    contents.print = (options, callback) => {
      assert.equal(options.deviceName, printerName);
      assert.equal(options.copies, settings.copies);
      assert.equal(options.color, true);
      assert.equal(options.duplexMode, 'longEdge');
      submissions++;
      report.printSettings = options;
      contents.printToPDF({ pageSize: 'A4', printBackground: true }).then(bytes => {
        assert(bytes.length > 500);
        fs.writeFileSync(path.join(directory, 'rendered-order.pdf'), bytes);
        callback(true);
      }).catch(error => callback(false, error.message));
    };
  });
  // API_BASE is captured at import; set the synthetic local URL first. The
  // packaged agent, downloads, PDF rendering, status sync, and cache stay real.
  const agent = require(path.join(archive, 'src/main/agent.js'));
  const { createDiagnostics } = require(path.join(archive, 'src/main/diagnostics.js'));
  const diagnostics = createDiagnostics({ store, directory: path.join(directory, 'logs'), send: async () => {
    throw new Error('The order-flow test must never upload diagnostics');
  } });
  try {
    agent.start(store, (event, detail) => report.events.push({ event, detail }));
    // Startup self-test has its own mode; this mode isolates the customer-order
    // pipeline, which still performs real rendering before its print callback.
    agent.setRendererReadiness({ status: 'ready' });
    await eventually(() => {
      if (serverError) throw serverError;
      if (statuses.includes('NEEDS_ATTENTION')) {
        const failure = diagnostics.status().history.find(event => event.code === 'ATTEMPT_FAILED');
        throw new Error(`Synthetic order failed: ${failure?.message || 'NEEDS_ATTENTION'}`);
      }
      return statuses.filter(status => status === 'PRINTED').length >= 2;
    });
    agent.stop();
    await agent.waitForIdle();
    assert.equal(statuses.filter(status => status === 'PRINTING').length, 1);
    assert.equal(downloads, 1);
    assert.equal(submissions, 1);
    assert.equal(enumerations, 1);
    assert(polls >= 2);
    assert(data.printedJobs.includes(orderId));
    assert.equal(data.activePrintAttempt, undefined);
    assert.equal(Object.keys(data.pendingStatuses).length, 0);
    assert(diagnostics.status().history.some(event => event.code === 'RENDER_COMPLETE' && event.data.pages === 1));
  } finally {
    agent.stop();
    diagnostics.stop();
    report.orderFlow = { polls, downloads, enumerations, submissions, statuses,
      diagnostics: diagnostics.status().history };
  }
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
  if (mode === 'load-probes') {
    // Diagnostic matrix only. Individual failures are retained in report.json
    // rather than hiding the other routes behind the first failed load.
    const page = path.join(archive, 'src/renderer/print.html');
    report.probes = [];
    for (const probe of [
      { name: 'loadFile-immediate', discover: false, route: 'file' },
      { name: 'loadFile-after-discovery', discover: true, route: 'file' },
      { name: 'pathToFileURL-after-discovery', discover: true, route: 'url' },
      { name: 'data-page-after-discovery', discover: true, route: 'data' },
    ]) {
      const channel = `print:document:${crypto.randomUUID()}`;
      const window = new BrowserWindow({ show: false, webPreferences: {
        preload: path.join(archive, 'src/main/print-preload.js'),
        additionalArguments: [`--print-channel=${channel}`], contextIsolation: true,
        nodeIntegration: false, sandbox: true, backgroundThrottling: false,
      } });
      ipcMain.handle(channel, () => fixturePdf());
      const result = { ...probe };
      try {
        if (probe.discover) result.printerCount = (await window.webContents.getPrintersAsync()).length;
        if (probe.route === 'file') await window.loadFile(page);
        else if (probe.route === 'url') await window.loadURL(pathToFileURL(page).href);
        else await window.loadURL('data:text/html;charset=utf-8,<h1>Windows loading probe</h1>');
        result.loaded = true;
        if (probe.route !== 'data') result.render = await window.webContents.executeJavaScript('window.printReady');
      } catch (error) { result.loaded = false; result.error = error.message; }
      finally { ipcMain.removeHandler(channel); window.destroy(); }
      report.probes.push(result);
      console.log('LOAD PROBE:', JSON.stringify(result));
    }
  } else if (mode === 'render') {
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
  } else if (mode === 'order-flow') {
    await orderFlow(archive, fixturePdf);
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
