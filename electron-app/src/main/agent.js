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
const { exec } = require('child_process');
const { BrowserWindow } = require('electron');
const util = require('util');
const execPromise = util.promisify(exec);

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

function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl, redirectsLeft) => {
      const client = currentUrl.startsWith('https') ? https : http;
      client.get(currentUrl, (res) => {
        // Follow redirects (301, 302, 307, 308)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          // Handle relative redirects
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(currentUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          emit('agent:event', { type: 'info', message: `Following redirect → ${redirectUrl.substring(0, 80)}...` });
          doRequest(redirectUrl, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const stream = fs.createWriteStream(destPath);
        res.pipe(stream);
        stream.on('finish', () => { 
          stream.close(() => resolve()); 
        });
        stream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };
    doRequest(url, maxRedirects);
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
        // ── Step 1: Validate downloaded file exists and is non-empty
        const fileStats = fs.statSync(tempPath);
        if (fileStats.size < 100) {
          throw new Error(`Downloaded file too small (${fileStats.size} bytes) — likely corrupt`);
        }
        emit('agent:event', { type: 'info', message: `📄 File downloaded: ${(fileStats.size / 1024).toFixed(1)} KB → ${tempPath}` });

        // ── Step 2: Validate the file is actually a PDF (check magic bytes)
        const headerBuf = Buffer.alloc(5);
        const fd = fs.openSync(tempPath, 'r');
        fs.readSync(fd, headerBuf, 0, 5, 0);
        fs.closeSync(fd);
        const headerStr = headerBuf.toString('ascii', 0, 4);
        if (headerStr !== '%PDF') {
          // Log what we actually got so we can debug
          const preview = fs.readFileSync(tempPath, 'utf8').substring(0, 200);
          emit('agent:event', { type: 'error', message: `❌ NOT a PDF! Header: "${headerStr}" | Preview: ${preview}` });
          throw new Error(`Downloaded file is not a valid PDF (got "${headerStr}" instead of "%PDF"). The download URL may have redirected to an HTML page.`);
        }
        emit('agent:event', { type: 'info', message: `✅ PDF validated (header: %PDF)` });

        // ── Step 3: Resolve printer (auto-pick first available if none configured)
        let selectedPrinter = store?.get('selectedPrinter') || null;
        if (!selectedPrinter) {
          try {
            const availPrinters = await ptp.getPrinters();
            emit('agent:event', { type: 'info', message: `🖨️ Available printers: ${availPrinters.map(p => p.name).join(', ')}` });
            if (availPrinters.length > 0) {
              selectedPrinter = availPrinters[0].name;
              emit('agent:event', { type: 'info', message: `Auto-selected printer: ${selectedPrinter}` });
            }
          } catch (printerErr) {
            emit('agent:event', { type: 'error', message: `Printer detection error: ${printerErr.message}` });
          }
        }
        if (!selectedPrinter) throw new Error('No printer found. Configure one in Settings.');

        emit('agent:event', { type: 'info', message: `🖨️ Sending to: "${selectedPrinter}" via Electron Native Print...` });
        
        const copies = parseInt(job.settings?.copies) || 1;
        
        // ── Step 4: Print using Electron Chromium Engine
        await new Promise((resolvePrint, rejectPrint) => {
          let printWin = new BrowserWindow({ 
            show: false,
            webPreferences: { plugins: true } // Required to load PDFs natively
          });

          // Safety timeout
          const safetyTimer = setTimeout(() => {
            if (printWin) {
              printWin.close();
              rejectPrint(new Error('Print job timed out. The printer might be offline or unresponsive.'));
            }
          }, 60000); // 60s timeout

          printWin.on('closed', () => { printWin = null; });

          printWin.loadURL(`file://${tempPath}`);
          printWin.webContents.on('did-finish-load', () => {
            // Wait 2 seconds for PDF viewer to initialize
            setTimeout(() => {
              let currentCopy = 1;
              const doPrint = async () => {
                emit('agent:event', { type: 'info', message: `Printing copy ${currentCopy}/${copies}...` });
                try {
                  await printWin.webContents.print({
                    silent: true,
                    deviceName: selectedPrinter,
                    copies: 1 // Print one copy at a time for safety
                  });
                  emit('agent:event', { type: 'info', message: `Copy ${currentCopy} spooled successfully` });
                  if (currentCopy < copies) {
                    currentCopy++;
                    setTimeout(doPrint, 3000); // Wait 3s between copies
                  } else {
                    clearTimeout(safetyTimer);
                    printWin.close();
                    resolvePrint();
                  }
                } catch (printErr) {
                  clearTimeout(safetyTimer);
                  printWin.close();
                  rejectPrint(new Error(`Native print failed: ${printErr.message}`));
                }
              };
              doPrint();
            }, 2000);
          });
        });

        // ── Step 5: Wait for CAPT/GDI printer to fully spool the job
        //    Canon LBP2900 is a host-based printer — it needs the computer to
        //    finish rendering before the data is sent to the hardware.
        emit('agent:event', { type: 'info', message: `⏳ Waiting for printer spooler to finish...` });
        await new Promise(r => setTimeout(r, 8000));
        
        emit('agent:event', { type: 'info', message: `✅ Print complete: ${file.originalName}` });
      } catch (err) {
        emit('agent:event', { type: 'error', message: `❌ Print error: ${err.message}` });
        allPrinted = false;
        await updateJobStatus(job.id, 'NEEDS_ATTENTION');
      }
    } else {
      // macOS/Linux dev simulation
      await new Promise(r => setTimeout(r, 1500));
    }

    // DELAY UNLINK by 60 seconds! 
    // Basic GDI printers (like Canon LBP2900) take a long time to spool and will fail if the file is deleted too quickly.
    setTimeout(() => {
      fs.unlink(tempPath, () => {});
    }, 60000);
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
