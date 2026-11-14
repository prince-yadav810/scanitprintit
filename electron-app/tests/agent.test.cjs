const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const path = require('node:path');
const { load, clock, settle } = require('./helpers.cjs');

function setup(options = {}) {
  const data = options.saved ?? { token: 'paired-token' };
  const store = { get: (key, fallback) => data[key] ?? fallback, set: (key, value) => { data[key] = value; }, delete: key => { delete data[key]; } };
  const events = [];
  const statuses = [];
  const intervals = new Map();
  const timers = clock();
  const job = { id: 'order-1', orderNumber: 'ABC123', settings: { copies: 2, mode: 'BW', sides: 'SINGLE' }, files: [{ originalName: 'test.pdf', cloudinaryUrl: 'https://files.test/document.pdf' }] };
  let state = 'PAID_QUEUED';
  let prints = 0;
  let downloadRequest;
  const client = {
    request(config, callback) {
      const req = new EventEmitter();
      let body;
      req.write = value => { body = JSON.parse(value); };
      req.setTimeout = () => {};
      req.destroy = () => {};
      req.end = () => queueMicrotask(() => {
        let result = { status: 200, data: { success: true } };
        if (config.path === '/api/agent/jobs') result.data.jobs = state === 'PAID_QUEUED' ? [job] : [];
        if (config.path.endsWith('/actions')) {
          if (options.actionRejected) result = { status: 422, data: { error: 'Documents expired' } };
          else state = body.action === 'retry' ? 'PAID_QUEUED' : 'CANCELLED';
        }
        if (body?.status) {
          statuses.push(body.status);
          if (body.status === 'PRINTING' && options.claimRejected) result = { status: 409, data: { error: 'Already claimed' } };
          else if (body.status === 'PRINTED' && options.syncFails?.()) result = { status: 500, data: { error: 'Server unavailable' } };
          else state = body.status;
        }
        const res = new EventEmitter();
        res.statusCode = result.status;
        callback(res);
        res.emit('data', JSON.stringify(result.data)); res.emit('end');
      });
      return req;
    },
    get(url, callback) {
      const req = new EventEmitter();
      req.destroy = () => {};
      downloadRequest = req;
      if (!options.downloadHangs) queueMicrotask(() => {
        const res = new PassThrough();
        res.statusCode = options.downloadFails ? 404 : 200;
        callback(res);
        res.end('%PDF-1.4 test content');
      });
      return req;
    },
  };
  const agent = load(path.resolve(__dirname, '../src/main/agent.js'), {
    https: client, http: client,
    os: { ...require('node:os'), platform: () => 'win32' },
    fs: {
      writeFileSync() {},
      createWriteStream: () => {
        const stream = new PassThrough(); stream.resume();
        stream.close = callback => callback(); return stream;
      },
      unlink: (_, callback) => callback(),
    },
    './native-print': { printDocument: async (...args) => { prints++; return options.print?.(...args); } },
    './renderer-self-test': { fixturePdf: () => Buffer.from('%PDF-1.4 test page') },
  }, { ...timers, setInterval: (callback, delay) => { intervals.set(delay, callback); return delay; }, clearInterval: delay => intervals.delete(delay) });
  agent.start(store, (event, detail) => events.push({ event, detail }));
  return { agent, data, events, statuses, timers, job, poll: () => intervals.get(5000)(), get prints() { return prints; }, get state() { return state; }, get intervals() { return intervals; }, get downloadRequest() { return downloadRequest; } };
}

test('server rejects a duplicate claim: no download, no print, no status overwrite', async () => {
  const s = setup({ claimRejected: true });
  await s.poll();
  assert.equal(s.prints, 0);
  assert.deepEqual(s.statuses, ['PRINTING']);
  assert.equal(s.agent.isPrinting(), false);
  s.agent.stop();
});

test('download failure updates the server to NEEDS_ATTENTION and releases the job', async () => {
  const s = setup({ downloadFails: true });
  await s.poll();
  assert.equal(s.state, 'NEEDS_ATTENTION');
  assert.equal(s.prints, 0);
  assert.equal(s.agent.isPrinting(), false);
  s.agent.stop();
});

test('a hung download times out instead of leaving the shop permanently printing', async () => {
  const s = setup({ downloadHangs: true });
  const polling = s.poll();
  await settle();
  assert.equal(s.agent.isPrinting(), true);
  s.timers.advance(30000);
  await polling;
  assert.equal(s.state, 'NEEDS_ATTENTION');
  assert.equal(s.agent.isPrinting(), false);
  s.agent.stop();
});

test('native printing rejection updates the server, without recording a printed job', async () => {
  const s = setup({ print: () => { throw new Error('Printer offline'); } });
  await s.poll();
  assert.equal(s.state, 'NEEDS_ATTENTION');
  assert.equal(s.data.printedJobs, undefined);
  assert.equal(s.agent.isPrinting(), false);
  s.agent.stop();
});

test('successful print retries an offline final status after restart without reprinting', async () => {
  let offline = true;
  const s = setup({ syncFails: () => offline });
  await s.poll();
  assert.equal(s.prints, 1);
  assert.equal(s.state, 'PRINTING');
  assert.equal(s.data.pendingStatuses['order-1'].status, 'PRINTED');
  assert.equal(s.data.printedJobs[0], 'order-1');
  s.agent.stop();
  offline = false;
  const restarted = setup({ saved: s.data });
  await restarted.poll();
  assert.equal(restarted.state, 'PRINTED');
  assert.equal(restarted.prints, 0);
  assert.equal(Object.keys(restarted.data.pendingStatuses).length, 0);
  restarted.agent.stop();
});

test('stopping the agent prevents new polling while allowing the current print to finish', async () => {
  let complete;
  const s = setup({ print: () => new Promise(resolve => { complete = resolve; }) });
  const poll = s.poll();
  await settle();
  assert.equal(s.agent.isPrinting(), true);
  s.agent.stop();
  assert.equal(s.intervals.size, 0);
  let idle = false;
  const waiting = s.agent.waitForIdle().then(() => { idle = true; });
  await settle();
  assert.equal(idle, false);
  complete();
  await Promise.all([poll, waiting]);
  assert.equal(s.state, 'PRINTED');
  assert.equal(s.agent.isPrinting(), false);
});

test('restart turns an interrupted attempt into operator attention without printing it again', async () => {
  const s = setup({ saved: { token: 'paired-token', activePrintAttempt: { orderId: 'order-1', orderNumber: 'ABC123', stage: 'windows-submission' } } });
  assert.equal(s.data.pendingStatuses['order-1'].status, 'NEEDS_ATTENTION');
  await s.poll();
  assert.equal(s.prints, 0);
  assert.equal(s.state, 'NEEDS_ATTENTION');
  assert.equal(s.data.activePrintAttempt, undefined);
  s.agent.stop();
});

test('restart preserves an already persisted successful result rather than downgrading it', async () => {
  const s = setup({ saved: { token: 'paired-token', activePrintAttempt: { orderId: 'order-1' }, pendingStatuses: { 'order-1': { status: 'PRINTED', orderNumber: 'ABC123' } } } });
  await s.poll();
  assert.equal(s.state, 'PRINTED'); assert.equal(s.prints, 0);
  s.agent.stop();
});

test('retry invokes the server and clears the printed cache only after acceptance', async () => {
  const s = setup({ saved: { token: 'paired-token', printedJobs: ['order-1'] } });
  assert.equal((await s.agent.retryJob('order-1')).success, true);
  assert.deepEqual(s.data.printedJobs, []);
  s.agent.stop();
  const rejected = setup({ actionRejected: true, saved: { token: 'paired-token', printedJobs: ['order-1'] } });
  const result = await rejected.agent.retryJob('order-1');
  assert.equal(result.success, false); assert.match(result.error, /expired/);
  assert.deepEqual(rejected.data.printedJobs, ['order-1']);
  rejected.agent.stop();
});

test('a local printer test uses the real print service without a paid order or server status changes', async () => {
  const s = setup();
  const result = await s.agent.printTestPage();
  assert.equal(result.success, true); assert.equal(s.prints, 1);
  assert.equal(s.statuses.length, 0); assert.equal(s.agent.isPrinting(), false);
  s.agent.stop();
});

test('a local printer test blocks polling and shutdown waits for it to finish', async () => {
  let finish;
  const s = setup({ print: () => new Promise(resolve => { finish = resolve; }) });
  const testPage = s.agent.printTestPage();
  await settle();
  assert.equal(s.agent.isPrinting(), true);
  assert.equal((await s.agent.printTestPage()).success, false);
  await s.poll(); assert.equal(s.statuses.length, 0);
  let idle = false;
  const waiting = s.agent.waitForIdle().then(() => { idle = true; });
  await settle(); assert.equal(idle, false);
  finish(); await testPage; await waiting;
  assert.equal(idle, true); s.agent.stop();
});

test('a failed printer test returns its error and releases the queue', async () => {
  const s = setup({ print: () => { throw new Error('Canon rejected the job'); } });
  const result = await s.agent.printTestPage();
  assert.equal(result.success, false); assert.match(result.error, /Canon/);
  assert.equal(s.agent.isPrinting(), false); assert.equal(s.statuses.length, 0);
  s.agent.stop();
});

test('standalone support mode never polls customer jobs but still allows a direct printer test', async () => {
  const s = setup();
  const store = { get: (key, fallback) => s.data[key] ?? fallback, set: (key, value) => { s.data[key] = value; }, delete: key => { delete s.data[key]; } };
  s.agent.start(store, () => {}, { diagnosticsOnly: true });
  assert.equal(s.agent.isDiagnosticsOnly(), true);
  assert.equal(s.intervals.has(5000), false);
  assert.equal((await s.agent.printTestPage()).success, true);
  assert.equal(s.statuses.length, 0);
  s.agent.stop();
});
