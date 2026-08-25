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
const ptp   = require('pdf-to-printer');

const API_BASE = process.env.SCANITPRINTIT_API || 'https://www.scanitprintit.in/api';
const POLL_MS  = 5000;
const VERSION  = '1.0.0';

let store    = null;
let emit     = null;
let pollTimer = null;
let isPolling = false;
let isPrinting = false; // Block disconnect while printing

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
    const req = client.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: () => JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, json: () => ({}) });
        }
      });
    });
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function updateJobStatus(orderId, status) {
  try {
    await apiFetch(`/agent/jobs/${orderId}/status`, 'POST', { status });
  } catch (err) {
    emit('agent:event', { type: 'warn', message: `Could not update status: ${err.message}` });
  }
}

function downloadFile(url, destPath) {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(destPath);
    client.get(url, (res) => {
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
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
  emit('agent:jobStatus', { orderId: job.id, status: 'PRINTING', orderNumber: job.orderNumber });
  await updateJobStatus(job.id, 'PRINTING');

  const simMode = job.simulationEnabled === true;
  const printedJobs = store?.get('printedJobs', []) || [];
  let allPrinted = true;

  for (const file of job.files) {
    let downloadUrl = file.cloudinaryUrl;
    const tempPath = path.join(os.tmpdir(), `sip_${job.orderNumber}_${Date.now()}.pdf`);

    try {
      await downloadFile(downloadUrl, tempPath);
    } catch (err) {
      emit('agent:event', { type: 'error', message: `Download failed for ${file.originalName}: ${err.message}` });
      allPrinted = false;
      continue;
    }

    if (simMode) {
      try {
        const simDir = path.join(os.homedir(), 'Desktop', 'scanitprintit-simulated-output');
        if (!fs.existsSync(simDir)) fs.mkdirSync(simDir, { recursive: true });
        const safeName = file.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const finalPdfPath = path.join(simDir, `sip_${job.orderNumber}_${safeName}.pdf`);
        fs.copyFileSync(tempPath, finalPdfPath);
        const manifest = {
          orderId: job.id, orderNumber: job.orderNumber, fileName: file.originalName,
          pdfUrl: downloadUrl, pageCount: job.pageCount,
          selectedPrinter: 'ScanItPrintIt Simulator',
          copies: job.settings?.copies || 1,
          mode: job.settings?.mode || 'BW',
          sides: job.settings?.sides || 'SINGLE',
          paperSize: 'A4',
          timestamp: new Date().toISOString(), result: 'success',
        };
        fs.writeFileSync(path.join(simDir, `sip_${job.orderNumber}_manifest.json`), JSON.stringify(manifest, null, 2));
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        allPrinted = false;
      }
    } else if (os.platform() === 'win32') {
      try {
        const selectedPrinter = store?.get('selectedPrinter') || undefined;
        const printOptions = {
          copies: job.settings?.copies || 1,
          sides: job.settings?.sides === 'DOUBLE' ? 'two-sided-long-edge' : 'one-sided',
          ...(selectedPrinter ? { printer: selectedPrinter } : {}),
        };
        await ptp.print(tempPath, printOptions);
      } catch (err) {
        emit('agent:event', { type: 'error', message: `Print failed: ${err.message}` });
        allPrinted = false;
        await updateJobStatus(job.id, 'NEEDS_ATTENTION');
      }
    } else {
      // macOS/Linux dev simulation
      await new Promise(r => setTimeout(r, 1500));
    }

    fs.unlink(tempPath, () => {});
  }

  if (allPrinted) {
    const finalStatus = simMode ? 'SIMULATED_PRINTED' : 'PRINTED';
    // Cache printed job ID (keep last 50 for idempotency)
    printedJobs.push(job.id);
    if (printedJobs.length > 50) printedJobs.shift();
    store?.set('printedJobs', printedJobs);
    await updateJobStatus(job.id, finalStatus);
    emit('agent:jobStatus', { orderId: job.id, status: finalStatus, orderNumber: job.orderNumber });
  } else {
    emit('agent:jobStatus', { orderId: job.id, status: 'NEEDS_ATTENTION', orderNumber: job.orderNumber });
  }

  isPrinting = false;
}

// ─── Poll Loop ────────────────────────────────────────────────────────────────
async function poll() {
  if (isPolling) return;
  isPolling = true;

  try {
    const token = store?.get('token');
    if (!token) return;

    const res  = await apiFetch('/agent/jobs');
    const data = res.json();

    if (res.status === 401) {
      store?.delete('token');
      emit('agent:event', { type: 'unpaired', message: 'Token rejected by server. Please re-pair.' });
      return;
    }

    if (!data.success || !data.jobs?.length) return;

    const job = data.jobs[0];
    const printedJobs = store?.get('printedJobs', []) || [];

    if (printedJobs.includes(job.id)) {
      const fallbackStatus = job.simulationEnabled ? 'SIMULATED_PRINTED' : 'PRINTED';
      await updateJobStatus(job.id, fallbackStatus);
      return;
    }

    emit('agent:newJob', job);
    await processJob(job);

  } catch (err) {
    emit('agent:connectivity', { online: false, apiReachable: false, error: err.message });
  } finally {
    isPolling = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
module.exports = {
  start(_store, _emit) {
    store = _store;
    emit  = _emit;
    pollTimer = setInterval(poll, POLL_MS);
    // Also check connectivity every 15s separately
    setInterval(checkConnectivity, 15000);
    checkConnectivity();
  },

  stop() {
    if (pollTimer) clearInterval(pollTimer);
  },

  isPrinting() {
    return isPrinting;
  },

  getVersion() {
    return VERSION;
  },

  async pair(code) {
    try {
      const res  = await apiFetch('/agent/pair', 'POST', { code: code.trim() });
      const data = res.json();
      if (data.success) {
        store?.set('token', data.token);
        store?.set('printedJobs', []);
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
};
