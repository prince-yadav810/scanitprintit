const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const version = require('../../package.json').version;

let active = null;
function redact(value, max = 2000) {
  return String(value)
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(?:token|password|secret|api[_-]?key)\s*[:=]\s*["']?[^\s,"'}]+/gi, '[credential redacted]')
    .replace(/(?:[A-Za-z]:\\|\/(?:Users|home|private|var|tmp)\/)[^\r\n"'<>]+/g, '[local path]')
    .slice(0, max);
}
function sanitize(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 3) return {};
  if (Array.isArray(value)) return value.slice(0, 20).map(item =>
    typeof item === 'object' ? sanitize(item, depth + 1) : redact(item, 500));
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    if (/token|secret|password|authorization|cookie|url|path|document|filename|customer|username|computername/i.test(key)) continue;
    if (item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) result[key] = item;
    else if (typeof item === 'string') result[key] = redact(item, 500);
    else if (typeof item === 'object') result[key] = sanitize(item, depth + 1);
  }
  return result;
}

function createDiagnostics({ store, directory, send, now = () => new Date() }) {
  let pending = store.get('diagnosticOutbox', []) || [];
  let history = store.get('diagnosticHistory', []) || [];
  let timer;
  let flushing = false;
  let backoff = 5000;
  let nextFlush = 0;
  let lastError = null;
  let lastSyncedAt = store.get('diagnosticLastSyncedAt', null);
  let localError = null;
  const logFile = path.join(directory, 'agent.jsonl');
  function persist(key, value) {
    try { store.set(key, value); } catch (error) { localError = redact(error.message); }
  }
  function writeLocal(event) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2 * 1024 * 1024) {
        for (let i = 3; i >= 1; i--) {
          const source = i === 1 ? logFile : `${logFile}.${i - 1}`;
          const target = `${logFile}.${i}`;
          if (fs.existsSync(target)) fs.unlinkSync(target);
          if (fs.existsSync(source)) fs.renameSync(source, target);
        }
      }
      fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
    } catch (error) { localError = redact(error.message); }
  }
  const client = {
    record(input) {
      const event = {
        id: crypto.randomUUID(), timestamp: now().toISOString(), version,
        level: ['info', 'warn', 'error'].includes(input.level) ? input.level : 'info',
        stage: String(input.stage || 'agent').slice(0, 80),
        code: String(input.code || 'EVENT').slice(0, 100), message: redact(input.message || input.code || 'Agent event'),
        orderId: input.orderId || null, attemptId: input.attemptId || null, fileId: input.fileId || null,
        data: sanitize(input.data),
      };
      if (Buffer.byteLength(JSON.stringify(event.data)) > 8192) event.data = { truncated: true };
      writeLocal(event);
      history = [...history, event].slice(-200);
      // Keep error evidence preferentially if an extended outage fills the queue.
      if (pending.length >= 2000) {
        const index = pending.findIndex(item => item.level === 'info');
        pending.splice(index === -1 ? 0 : index, 1);
      }
      pending.push(event);
      persist('diagnosticHistory', history);
      persist('diagnosticOutbox', pending);
      return event;
    },
    async flush(force = false) {
      if (flushing || !pending.length || !store.get('token') || (!force && Date.now() < nextFlush)) return;
      flushing = true;
      const batch = [];
      let bytes = 0;
      for (const event of pending.slice(0, 50)) {
        const size = Buffer.byteLength(JSON.stringify(event));
        if (batch.length && bytes + size > 180 * 1024) break;
        batch.push(event); bytes += size;
      }
      const pairedToken = store.get('token');
      try {
        const response = await send(batch);
        if (store.get('token') !== pairedToken) return;
        if (!response?.success || !Array.isArray(response.accepted)) throw new Error('Server did not acknowledge diagnostics.');
        const accepted = new Set(response.accepted);
        // A reset/re-pair or newly appended events must not be overwritten by an in-flight flush.
        pending = pending.filter(event => !accepted.has(event.id));
        persist('diagnosticOutbox', pending);
        lastSyncedAt = now().toISOString();
        persist('diagnosticLastSyncedAt', lastSyncedAt);
        lastError = null;
        backoff = 5000;
        nextFlush = 0;
      } catch (error) {
        lastError = redact(error.message);
        nextFlush = Date.now() + backoff;
        backoff = Math.min(backoff * 2, 300000);
      } finally { flushing = false; }
    },
    reset() {
      pending = []; history = []; lastSyncedAt = null; lastError = null;
      backoff = 5000; nextFlush = 0;
      persist('diagnosticOutbox', pending); persist('diagnosticHistory', history); persist('diagnosticLastSyncedAt', null);
    },
    status() { return { pending: pending.length, lastSyncedAt, lastError, localError, history: history.slice(-50) }; },
    start() {
      if (timer) return;
      timer = setInterval(() => { void client.flush(); }, 5000);
      timer.unref?.();
      void client.flush();
    },
    stop() { clearInterval(timer); timer = null; },
  };
  active = client;
  client.record({ stage: 'startup', code: 'AGENT_STARTED', message: 'Agent started', data: {
    platform: process.platform, arch: process.arch, osRelease: os.release(),
    electron: process.versions.electron || 'not-electron', chrome: process.versions.chrome || 'unknown',
  } });
  return client;
}

function recordDiagnostic(event) { try { return active?.record(event); } catch { /* Logging never breaks printing. */ } }
module.exports = { createDiagnostics, recordDiagnostic, redact, sanitize, getDiagnostics: () => active };
