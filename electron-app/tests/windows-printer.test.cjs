const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { load } = require('./helpers.cjs');

test('Windows diagnostics use a bounded read-only query and encode printer names as data', async () => {
  let invocation;
  const service = load(path.resolve(__dirname, '../src/main/windows-printer.js'), {
    'node:child_process': { execFile: (file, args, config, callback) => {
      invocation = { file, args, config };
      callback(null, '\uFEFF{"available":true,"printer":{"DriverName":"Canon CAPT"},"jobs":[]}');
    } },
  }, { process: { platform: 'win32' } });
  const printer = "Canon'; $(unexpected-command)";
  const result = await service.getPrinterSnapshot(printer);
  assert.equal(result.printer.DriverName, 'Canon CAPT');
  assert.equal(invocation.file, 'powershell.exe');
  assert.equal(invocation.config.timeout, 8000);
  assert(invocation.config.windowsHide);
  const script = Buffer.from(invocation.args.at(-1), 'base64').toString('utf16le');
  assert(!script.includes(printer));
  assert(script.includes(Buffer.from(printer).toString('base64')));
  assert(!/Remove-PrintJob|Restart-Service|Stop-Service|Win32_Process/.test(script));
});

test('missing PowerShell or printer query timeout produces diagnostics, without rejecting the print', async () => {
  const service = load(path.resolve(__dirname, '../src/main/windows-printer.js'), {
    'node:child_process': { execFile: (_, __, ___, callback) => callback({ killed: true, code: 'ETIMEDOUT' }) },
  }, { process: { platform: 'win32' } });
  const result = await service.getPrinterSnapshot('Canon');
  assert.equal(result.available, false); assert.match(result.reason, /timed out/);
});
