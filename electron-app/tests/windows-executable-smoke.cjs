// Run with Windows Node, not Electron:
// node tests/windows-executable-smoke.cjs <extracted packaged .exe> <evidence directory>
// The actual packaged executable runs unchanged, in support mode and an empty
// profile. It can reach only the synthetic local API and never receives orders.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function main() {
  assert.equal(process.platform, 'win32', 'This check must execute the real packaged Windows application.');
  assert(process.argv[2], 'Pass the extracted packaged executable as the first argument.');
  const executable = path.resolve(process.argv[2]);
  assert(fs.statSync(executable).isFile(), 'The packaged executable must exist.');
  const directory = path.resolve(process.argv[3] || 'windows-executable-results');
  fs.mkdirSync(directory, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sip-executable-profile-'));
  const userProfile = path.join(profile, 'user');
  const appData = path.join(userProfile, 'AppData', 'Roaming');
  const localAppData = path.join(userProfile, 'AppData', 'Local');
  const temporary = path.join(localAppData, 'Temp');
  for (const folder of [userProfile, appData, localAppData, temporary]) fs.mkdirSync(folder, { recursive: true });
  const diagnosticFile = path.join(appData, 'ScanItPrintIt Support', 'logs', 'agent.jsonl');
  const report = { executable, platform: process.platform, node: process.version,
    profile, diagnosticFile, startedAt: new Date().toISOString(), requests: [], events: [] };
  const output = { stdout: '', stderr: '' };
  let child;
  let childExit;
  let spawnError;
  let forbiddenRequest;
  let failure;
  let rawDiagnostics = '';
  const server = http.createServer((request, response) => {
    report.requests.push({ method: request.method, path: request.url });
    // No token, documents, or successful order response is ever provided.
    if (request.url.includes('/agent/jobs')) forbiddenRequest = 'Support executable attempted to access customer orders.';
    response.setHeader('Content-Type', 'application/json');
    response.statusCode = request.url === '/api/agent/ping' ? 200 : 401;
    response.end(JSON.stringify(response.statusCode === 200 ? { ok: true } : { error: 'This isolated smoke test has no pairing.' }));
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const env = { ...process.env, APPDATA: appData, LOCALAPPDATA: localAppData,
      USERPROFILE: userProfile, TEMP: temporary, TMP: temporary,
      SCANITPRINTIT_API: `http://127.0.0.1:${server.address().port}/api` };
    // Avoid inheriting development-only behavior or a portable launcher's
    // temporary metadata. The real --diagnostics-only flag selects support.
    for (const key of ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'PORTABLE_EXECUTABLE_FILE',
      'PORTABLE_EXECUTABLE_DIR', 'PORTABLE_EXECUTABLE_APP_FILENAME']) delete env[key];
    child = spawn(executable, ['--diagnostics-only', '--enable-logging=stderr',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'], {
      cwd: path.dirname(executable), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    report.pid = child.pid;
    child.on('error', error => { spawnError = error; });
    child.on('exit', (code, signal) => { childExit = { code, signal }; });
    for (const name of ['stdout', 'stderr']) child[name].on('data', chunk => {
      output[name] = (output[name] + chunk.toString()).slice(-1024 * 1024);
    });
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (forbiddenRequest) throw new Error(forbiddenRequest);
      try { rawDiagnostics = fs.readFileSync(diagnosticFile, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      // A write may be in progress; only complete JSONL records are evidence.
      report.events = rawDiagnostics.split('\n').filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
      const failed = report.events.find(event => ['RENDER_SELF_TEST_FAILED', 'UNCAUGHT_EXCEPTION'].includes(event.code));
      if (failed) throw new Error(`Packaged executable ${failed.code}: ${failed.message}`);
      assert(!report.events.some(event => ['ATTEMPT_STARTED', 'PRINT_SUBMIT'].includes(event.code)),
        'The executable smoke check must never submit an order or physical print.');
      const passed = report.events.find(event => event.code === 'RENDER_SELF_TEST_PASSED');
      if (passed) {
        assert(report.events.some(event => event.code === 'RUN_MODE' && event.data?.diagnosticsOnly === true),
          'The actual executable must report support mode.');
        assert(passed.data?.bytes > 500, 'Actual packaged self-test must produce a nonempty PDF.');
        report.selfTest = passed;
        report.success = true;
        break;
      }
      if (childExit) throw new Error(`Packaged executable exited before its self-test: ${JSON.stringify(childExit)}`);
      await delay(250);
    }
    assert(report.success, 'Timed out after 90 seconds waiting for the isolated packaged executable self-test.');
  } catch (error) {
    failure = error;
    report.error = error.stack || String(error);
  } finally {
    // This is our own process tree only; never kill unrelated installed agents.
    if (child?.pid) {
      report.termination = await new Promise(resolve => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
        let text = '';
        killer.stdout.on('data', chunk => { text += chunk; });
        killer.stderr.on('data', chunk => { text += chunk; });
        const killTimer = setTimeout(() => { killer.kill(); resolve({ error: 'taskkill exceeded 10 seconds', output: text }); }, 10000);
        killer.on('error', error => { clearTimeout(killTimer); resolve({ error: error.message }); });
        killer.on('close', code => { clearTimeout(killTimer); resolve({ code, output: text }); });
      });
    }
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    report.childExit = childExit;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(directory, 'agent.jsonl'), rawDiagnostics);
    fs.writeFileSync(path.join(directory, 'stdout.log'), output.stdout);
    fs.writeFileSync(path.join(directory, 'stderr.log'), output.stderr);
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  }
  if (failure) throw failure;
  console.log(`PASS: actual packaged executable ${report.selfTest.version} rendered its startup PDF in isolated support mode.`);
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
