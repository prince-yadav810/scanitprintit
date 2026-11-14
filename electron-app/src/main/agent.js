/**
 * agent.js — Electron Main Process Print Agent
 *
 * Ported from the standalone agent/index.js.
 * Adapted for Electron: no readline, no process.exit.
 * Communicates with the renderer via the emit() callback passed from main.
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const crypto = require('crypto');
const { printDocument } = require('./native-print');
const { recordDiagnostic, getDiagnostics } = require('./diagnostics');

const API_BASE = process.env.SCANITPRINTIT_API || 'https://www.scanitprintit.in/api';
const POLL_MS  = 5000;
const VERSION  = require('../../package.json').version;

let store    = null;
let emit     = null;
let pollTimer = null;
let connectivityTimer = null;
let isPolling = false;
let isPrinting = false; // Block disconnect while printing
let running = false;
let activeJob = null;
let diagnosticsOnly = false;

// ─── API Helpers ─────────────────────────────────────────────────────────────
function apiFetch(endpoint, method = 'GET', body = null) {
  const token   = store?.get('token');
  const url     = new URL(API_BASE + endpoint);
  const isHttps = url.protocol === 'https:';
  const client  = isHttps ? https : http;
  const payload = body ? JSON.stringify(body) : null;

  const options = {
    hostname: url.hostname,
    port:     url.port || (isHttps ? 443 : 80),
    path:     url.pathname + url.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    let req;
    const timer = setTimeout(() => { req?.destroy(); reject(new Error('Request timeout')); }, 10000);
    try { req = client.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('error', error => { clearTimeout(timer); reject(error); });
      res.on('aborted', () => { clearTimeout(timer); reject(new Error('API response was interrupted.')); });
      res.on('end', () => {
        clearTimeout(timer);
        try {
          const data = JSON.parse(raw);
          resolve({ status: res.statusCode, json: () => data });
        } catch {
          resolve({ status: res.statusCode, json: () => ({}) });
        }
      });
    }); } catch (error) { clearTimeout(timer); reject(error); return; }
    req.on('error', error => { clearTimeout(timer); reject(error); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function updateJobStatus(orderId, status) {
  const res = await apiFetch(`/agent/jobs/${orderId}/status`, 'POST', { status });
  const data = res.json();
  if (res.status < 200 || res.status >= 300 || !data.success) {
    const error = new Error(data.error || `Status update failed (HTTP ${res.status}).`);
    error.statusCode = res.status;
    throw error;
  }
}

// Persist final updates before sending: if the network fails after Windows
// accepts a job, the next poll (or restart) syncs its result without reprinting.
async function syncPendingStatuses() {
  const pending = store?.get('pendingStatuses', {}) || {};
  for (const [orderId, update] of Object.entries(pending)) {
    try {
      await updateJobStatus(orderId, update.status);
      delete pending[orderId];
      store?.set('pendingStatuses', pending);
    } catch (error) {
      emit('agent:event', { type: 'warn', message: `Order ${update.orderNumber}: status sync pending. ${error.message}` });
      if (update.lastError !== error.message) {
        recordDiagnostic({ level: 'warn', stage: 'status-sync', code: 'STATUS_SYNC_PENDING', orderId, message: error.message, data: { status: update.status, httpStatus: error.statusCode } });
        update.lastError = error.message;
        store?.set('pendingStatuses', pending);
      }
    }
  }
}

async function finishJob(job, status) {
  const pending = store?.get('pendingStatuses', {}) || {};
  pending[job.id] = { status, orderNumber: job.orderNumber };
  store?.set('pendingStatuses', pending);
  await syncPendingStatuses();
  emit('agent:jobStatus', { orderId: job.id, status, orderNumber: job.orderNumber });
}

function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    let activeRequest;
    let stream;
    let settled = false;
    let bytes = 0;
    let contentType;
    const timer = setTimeout(() => finish(new Error('Document download timed out.')), 30000);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        activeRequest?.destroy();
        stream?.destroy();
        fs.unlink(destPath, () => {});
        reject(error);
      } else resolve({ bytes, contentType });
    };
    const request = (currentUrl, redirectsLeft) => {
      try {
        const parsed = new URL(currentUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported document URL.');
        const client = parsed.protocol === 'https:' ? https : http;
        activeRequest = client.get(parsed, (res) => {
          if (settled) { res.resume(); return; }
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            if (!redirectsLeft) return finish(new Error('Too many document redirects.'));
            try { request(new URL(res.headers.location, parsed).href, redirectsLeft - 1); }
            catch (error) { finish(error); }
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            return finish(new Error(`Download failed: HTTP ${res.statusCode}`));
          }
          stream = fs.createWriteStream(destPath);
          contentType = res.headers?.['content-type'] || null;
          res.on('data', chunk => { bytes += chunk.length; });
          res.on('error', finish);
          res.on('aborted', () => finish(new Error('Document download was interrupted.')));
          stream.on('error', finish);
          stream.on('finish', () => stream.close(error => finish(error)));
          res.pipe(stream);
        });
        activeRequest.on('error', finish);
      } catch (error) { finish(error); }
    };
    request(url, maxRedirects);
  });
}

// ─── Connectivity check ───────────────────────────────────────────────────────
async function checkConnectivity() {
  try {
    const res = await apiFetch('/agent/ping').catch(() => null);
    const online = !!res && res.status < 500;
    emit('agent:connectivity', { online, apiReachable: online });
    return online;
  } catch {
    emit('agent:connectivity', { online: false, apiReachable: false });
    return false;
  }
}

// ─── Print a single job ───────────────────────────────────────────────────────
async function processJob(job) {
  isPrinting = true;
  let claimed = false;
  let stage = 'server-claim';
  const attemptId = crypto.randomUUID();
  const startedAt = Date.now();
  let currentFileId;
  const diagnostic = (code, message, data = {}, level = 'info') => recordDiagnostic({
    code, message, level, stage, orderId: job.id, attemptId, fileId: currentFileId,
    data: { ...data, elapsedMs: Date.now() - startedAt },
  });
  try {
    diagnostic('ATTEMPT_STARTED', 'Starting print attempt', { fileCount: job.files?.length || 0, settings: job.settings, selectedPrinter: store?.get('selectedPrinter') });
    // A 409 (already claimed) or rejected token must never result in a print.
    await updateJobStatus(job.id, 'PRINTING');
    claimed = true;
    store?.set('activePrintAttempt', { orderId: job.id, orderNumber: job.orderNumber, attemptId, startedAt: new Date().toISOString(), stage: 'claimed' });
    diagnostic('ORDER_CLAIMED', 'Server accepted the print claim');
    emit('agent:jobStatus', { orderId: job.id, status: 'PRINTING', orderNumber: job.orderNumber });
    stage = 'document-validation';
    if (!job.files?.length) throw new Error('This order has no documents to print.');

    const simMode = job.simulationEnabled === true;
    for (const file of job.files) {
      currentFileId = file.id;
      stage = 'document-download';
      const downloadUrl = file.convertedPdfUrl || file.cloudinaryUrl;
      if (!downloadUrl || file.status === 'EXPIRED') throw new Error('The document is no longer available. Its upload has expired; retrying cannot restore it.');
      const tempPath = path.join(os.tmpdir(), `sip_${crypto.randomUUID()}.pdf`);
      try {
        diagnostic('DOWNLOAD_STARTED', 'Downloading document');
        const download = await downloadFile(downloadUrl, tempPath);
        diagnostic('DOWNLOAD_COMPLETE', 'Document downloaded', download);
        if (simMode) {
          const simDir = path.join(os.homedir(), 'Desktop', 'scanitprintit-simulated-output');
          fs.mkdirSync(simDir, { recursive: true });
          const safeName = file.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
          fs.copyFileSync(tempPath, path.join(simDir, `sip_${job.orderNumber}_${safeName}.pdf`));
          const manifest = {
            orderId: job.id, orderNumber: job.orderNumber, fileName: file.originalName,
            pdfUrl: downloadUrl, pageCount: job.pageCount,
            selectedPrinter: 'ScanItPrintIt Simulator',
            copies: job.settings?.copies || 1, mode: job.settings?.mode || 'BW',
            sides: job.settings?.sides || 'SINGLE', paperSize: 'A4',
            timestamp: new Date().toISOString(), result: 'success',
          };
          fs.writeFileSync(path.join(simDir, `sip_${job.orderNumber}_${safeName}_manifest.json`), JSON.stringify(manifest, null, 2));
        } else {
          if (os.platform() !== 'win32') throw new Error('Physical printing requires Windows. Enable simulation on a test shop for development.');
          await printDocument(tempPath, job.settings, store?.get('selectedPrinter'), (message, detail = {}) => {
            stage = detail.stage || 'document-print';
            diagnostic(detail.code || 'PRINT_PROGRESS', message, detail, detail.level || 'info');
            if (['PRINT_SUBMIT', 'PRINT_ACCEPTED'].includes(detail.code)) {
              store?.set('activePrintAttempt', { orderId: job.id, orderNumber: job.orderNumber, attemptId, stage, fileId: currentFileId });
            }
            emit('agent:event', { type: 'info', message });
          });
          emit('agent:event', { type: 'info', message: `Document submitted to Windows: ${file.originalName}` });
        }
      } finally {
        // CAPT drivers may still have file handles after accepting the job.
        const cleanup = setTimeout(() => fs.unlink(tempPath, () => {}), 60000);
        cleanup.unref?.();
      }
    }

    const finalStatus = simMode ? 'SIMULATED_PRINTED' : 'PRINTED';
    const printedJobs = store?.get('printedJobs', []) || [];
    store?.set('printedJobs', [...printedJobs, job.id].slice(-50));
    stage = 'status-sync';
    await finishJob(job, finalStatus);
    store?.delete('activePrintAttempt');
    diagnostic('ATTEMPT_COMPLETED', 'Print attempt completed', { status: finalStatus });
  } catch (error) {
    stage = error.printStage || stage;
    diagnostic('ATTEMPT_FAILED', error.message, { errorCode: error.code, submissionUncertain: !!error.submissionUncertain, httpStatus: error.statusCode }, 'error');
    emit('agent:event', { type: 'error', message: `Order ${job.orderNumber} failed at ${stage}: ${error.message}` });
    // A transport failure can leave a successful claim in PRINTING. Report
    // attention in that case too, but never overwrite another agent's 409 claim.
    if (claimed || !error.statusCode || error.statusCode >= 500) {
      await finishJob(job, 'NEEDS_ATTENTION');
      store?.delete('activePrintAttempt');
    }
  } finally {
    isPrinting = false;
  }
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────
async function poll() {
  if (isPolling || isPrinting || !running) return;
  isPolling = true;

  try {
    const token = store?.get('token');
    if (!token) return;

    await syncPendingStatuses();
    const res  = await apiFetch('/agent/jobs');
    const data = res.json();

    if (res.status === 401) {
      store?.delete('token');
      emit('agent:event', { type: 'unpaired', message: 'Token rejected by server. Please re-pair.' });
      return;
    }

    if (!running || !data.success || !data.jobs?.length) return;

    const job = data.jobs[0];
    if (store?.get('pendingStatuses', {})?.[job.id]) return;
    const printedJobs = store?.get('printedJobs', []) || [];

    if (printedJobs.includes(job.id)) {
      const fallbackStatus = job.simulationEnabled ? 'SIMULATED_PRINTED' : 'PRINTED';
      await updateJobStatus(job.id, fallbackStatus);
      return;
    }

    emit('agent:newJob', job);
    activeJob = processJob(job);
    try { await activeJob; } finally { activeJob = null; }

  } catch (err) {
    emit('agent:connectivity', { online: false, apiReachable: false, error: err.message });
  } finally {
    isPolling = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {
  start(_store, _emit, options = {}) {
    this.stop();
    store = _store;
    emit  = _emit;
    diagnosticsOnly = options.diagnosticsOnly === true;
    const interrupted = store?.get('activePrintAttempt');
    if (interrupted && !isPrinting) {
      recordDiagnostic({ level: 'error', stage: 'recovery', code: 'INTERRUPTED_ATTEMPT', orderId: interrupted.orderId, attemptId: interrupted.attemptId,
        message: 'The agent closed during an active attempt. Check the Windows queue before retrying.', data: { lastStage: interrupted.stage } });
      const pending = store.get('pendingStatuses', {}) || {};
      // Preserve an already journaled success if the crash happened during final status sync.
      if (!pending[interrupted.orderId]) pending[interrupted.orderId] = { status: 'NEEDS_ATTENTION', orderNumber: interrupted.orderNumber };
      store.set('pendingStatuses', pending);
      store.delete('activePrintAttempt');
    }
    running = !diagnosticsOnly;
    if (running) pollTimer = setInterval(poll, POLL_MS);
    // Also check connectivity every 15s separately
    connectivityTimer = setInterval(checkConnectivity, 15000);
    checkConnectivity();
  },

  stop() {
    running = false;
    if (pollTimer) clearInterval(pollTimer);
    if (connectivityTimer) clearInterval(connectivityTimer);
    pollTimer = connectivityTimer = null;
  },

  isPrinting() {
    return isPrinting;
  },
  isDiagnosticsOnly() { return diagnosticsOnly; },

  waitForIdle() {
    return activeJob || Promise.resolve();
  },

  getVersion() {
    return VERSION;
  },

  async pair(code) {
    try {
      const res  = await apiFetch('/agent/pair', 'POST', { code: code.trim() });
      const data = res.json();
      if (data.success) {
        getDiagnostics()?.reset();
        store?.set('token', data.token);
        store?.set('printedJobs', []);
        store?.set('pendingStatuses', {});
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async getDashboard() {
    const res  = await apiFetch('/owner/dashboard');
    return res.json();
  },

  async getHistory(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const res = await apiFetch(`/owner/history${params ? '?' + params : ''}`);
    return res.json();
  },

  async getMonthlyStats() {
    const res = await apiFetch('/owner/stats/monthly');
    return res.json();
  },

  async saveSettings(settings) {
    const res = await apiFetch('/owner/settings', 'PATCH', settings);
    return res.json();
  },

  async getSettings() {
    const res = await apiFetch('/owner/settings', 'GET');
    return res.json();
  },

  async sendDiagnostics(events) {
    const response = await apiFetch('/agent/diagnostics', 'POST', { events });
    const data = response.json();
    if (response.status !== 200 || !data.success) throw new Error(data.error || `Diagnostics sync failed (HTTP ${response.status}).`);
    return data;
  },

  async retryJob(orderId) {
    if (isPrinting) return { success: false, error: 'Wait for the current print job to finish.' };
    await syncPendingStatuses();
    if (store?.get('pendingStatuses', {})?.[orderId]) return { success: false, error: 'This job still has a status update waiting to sync. Try again when connected.' };
    const response = await apiFetch(`/agent/jobs/${encodeURIComponent(orderId)}/actions`, 'POST', { action: 'retry' });
    const data = response.json();
    if (response.status !== 200 || !data.success) return { success: false, error: data.error || 'Could not requeue the order.' };
    store?.set('printedJobs', (store.get('printedJobs', []) || []).filter(id => id !== orderId));
    recordDiagnostic({ stage: 'recovery', code: 'RETRY_QUEUED', orderId, message: 'The operator requeued the order on the server' });
    return { success: true };
  },

  async cancelJob(orderId) {
    if (isPrinting) return { success: false, error: 'Wait for the current print job to finish.' };
    await syncPendingStatuses();
    if (store?.get('pendingStatuses', {})?.[orderId]) return { success: false, error: 'This job still has a status update waiting to sync. Try again when connected.' };
    const response = await apiFetch(`/agent/jobs/${encodeURIComponent(orderId)}/actions`, 'POST', { action: 'cancel' });
    const data = response.json();
    return response.status === 200 && data.success ? { success: true } : { success: false, error: data.error || 'Could not cancel the order.' };
  },

  async printTestPage() {
    if (isPrinting || isPolling) return { success: false, error: 'The agent is busy. Wait for the current job check or print to finish.' };
    if (os.platform() !== 'win32') return { success: false, error: 'The printer test requires Windows.' };
    isPrinting = true;
    const attemptId = crypto.randomUUID();
    const temp = path.join(os.tmpdir(), `sip_printer_test_${crypto.randomUUID()}.pdf`);
    const diagnostic = (message, detail = {}) => recordDiagnostic({
      attemptId, stage: detail.stage || 'printer-test', code: detail.code || 'TEST_PAGE_PROGRESS',
      level: detail.level || 'info', message, data: { ...detail, printerTest: true },
    });
    const task = (async () => {
      try {
        diagnostic('Operator requested a one-page printer test', { code: 'TEST_PAGE_STARTED' });
        const { fixturePdf } = require('./renderer-self-test');
        fs.writeFileSync(temp, fixturePdf());
        await printDocument(temp, { copies: 1, mode: 'BW', sides: 'SINGLE' }, store?.get('selectedPrinter'), diagnostic);
        diagnostic('Windows accepted the test page. Check the printer for physical output.', { code: 'TEST_PAGE_ACCEPTED' });
        return { success: true };
      } catch (error) {
        diagnostic(error.message, { level: 'error', code: 'TEST_PAGE_FAILED', stage: error.printStage || 'printer-test' });
        return { success: false, error: error.message };
      } finally {
        isPrinting = false;
        fs.unlink(temp, () => {});
        void getDiagnostics()?.flush(true);
      }
    })();
    activeJob = task;
    try { return await task; } finally { if (activeJob === task) activeJob = null; }
  },
};
