const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createDiagnostics, redact } = require('../src/main/diagnostics');

function setup(send = async events => ({ success: true, accepted: events.map(event => event.id) }), saved = {}) {
  const data = { token: 'private-test-token', ...saved };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sip-diagnostics-test-'));
  const store = { get: (key, fallback) => data[key] ?? fallback, set: (key, value) => { data[key] = structuredClone(value); } };
  const client = createDiagnostics({ store, directory, send });
  return { client, data, store, directory, cleanup() { client.stop(); fs.rmSync(directory, { recursive: true, force: true }); } };
}

test('events persist locally and redact credentials, download URLs, paths, and customer data', () => {
  const s = setup();
  try {
    s.client.record({ level: 'error', stage: 'download', code: 'FAILED', message: 'Bearer my-secret at https://files.test/private.pdf?token=secret from C:\\Users\\Alice\\test.pdf',
      data: { token: 'my-secret', customerName: 'Alice', fileName: 'private.pdf', url: 'https://private.test', error: 'token=hidden', bytes: 120 } });
    const file = fs.readFileSync(path.join(s.directory, 'agent.jsonl'), 'utf8');
    assert(!file.includes('my-secret')); assert(!file.includes('private.pdf')); assert(!file.includes('Alice')); assert(!file.includes('hidden'));
    assert.equal(s.data.diagnosticOutbox.length, 2);
    assert.equal(s.data.diagnosticHistory.at(-1).data.bytes, 120);
  } finally { s.cleanup(); }
});

test('offline diagnostics survive a restart and are removed only after server acknowledgement', async () => {
  const s = setup(async () => { throw new Error('Offline'); });
  let restarted;
  try {
    s.client.record({ code: 'FAILED', message: 'Printer failed', level: 'error' });
    await s.client.flush(true);
    assert.equal(s.client.status().pending, 2);
    assert.equal(s.client.status().lastError, 'Offline');
    restarted = setup(undefined, s.data);
    await restarted.client.flush(true);
    assert.equal(restarted.client.status().pending, 0);
    assert(restarted.client.status().lastSyncedAt);
    assert.equal(restarted.client.status().history.filter(event => event.code === 'FAILED').length, 1);
  } finally { s.cleanup(); restarted?.cleanup(); }
});

test('new events appended while a batch is uploading remain queued', async () => {
  let acknowledge;
  const s = setup(events => new Promise(resolve => { acknowledge = () => resolve({ success: true, accepted: events.map(event => event.id) }); }));
  try {
    const syncing = s.client.flush(true);
    const event = s.client.record({ code: 'APPENDED', message: 'During upload' });
    acknowledge(); await syncing;
    assert.equal(s.client.status().pending, 1);
    assert.equal(s.data.diagnosticOutbox[0].id, event.id);
  } finally { s.cleanup(); }
});

test('bounded diagnostics preserve errors during prolonged offline operation', () => {
  const s = setup();
  try {
    s.client.record({ code: 'IMPORTANT_FAILURE', level: 'error', message: 'Keep this failure' });
    // Avoid doing thousands of disk writes; resume a persisted full outbox.
    const failure = s.data.diagnosticOutbox.at(-1);
    const full = Array.from({ length: 2000 }, (_, i) => ({ id: `info-${i}`, level: 'info' }));
    full[0] = failure;
    const t = setup(undefined, { diagnosticOutbox: full });
    try {
      t.client.record({ code: 'NEW', message: 'Latest progress' });
      assert.equal(t.data.diagnosticOutbox.length, 2000);
      assert(t.data.diagnosticOutbox.some(event => event.id === failure.id));
    } finally { t.cleanup(); }
  } finally { s.cleanup(); }
});

test('re-pairing clears the old shop outbox and local history', () => {
  const s = setup();
  try {
    s.client.reset();
    assert.equal(s.client.status().pending, 0);
    assert.equal(s.client.status().history.length, 0);
    assert.equal(redact('password=secret'), '[credential redacted]');
  } finally { s.cleanup(); }
});
