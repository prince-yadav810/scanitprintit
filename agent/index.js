const readline = require('readline');
const os       = require('os');
const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const http     = require('http');
const ptp      = require('pdf-to-printer');

// ─── Config ────────────────────────────────────────────────────────────────
const API_BASE    = process.env.PRINTDESK_API || 'https://www.scanitprintit.in/api';
const CONFIG_PATH = path.join(os.homedir(), '.printdesk_agent.json');
const POLL_MS     = 5000;
const VERSION     = '1.0.0';

let config = { token: null, printedJobs: [] };

if (fs.existsSync(CONFIG_PATH)) {
  try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) {}
}

function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── Terminal UI helpers ────────────────────────────────────────────────────
const W = 52; // box width (inner)

function line(char = '─') { return char.repeat(W); }

function box(text, fill = ' ') {
  const pad = W - text.length;
  const l   = Math.floor(pad / 2);
  const r   = pad - l;
  return `│${fill.repeat(l)}${text}${fill.repeat(r)}│`;
}

function ts() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}

function log(level, msg) {
  const levels = { INFO: '  ', WAIT: '..', OK: 'OK', WARN: '!!', ERR: 'XX', JOB: '>>' };
  const tag = levels[level] || '  ';
  console.log(`  [${ts()}] [${tag}] ${msg}`);
}

function printHeader() {
  console.clear();
  console.log(`\n┌${line()}┐`);
  console.log(box('PrintDesk Print Agent'));
  console.log(box(`v${VERSION}   ${os.hostname()}`));
  console.log(`├${line()}┤`);
  console.log(box(`API  ${API_BASE}`));
  console.log(box(`OS   ${os.type()} ${os.arch()}`));
  console.log(`└${line()}┘\n`);
}

function printSection(title) {
  console.log(`\n  ${title}`);
  console.log(`  ${line('─')}\n`);
}

// ─── Pairing ────────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function promptPairing() {
  if (config.token) {
    log('INFO', 'Saved credentials found. Reconnecting...');
    startPolling();
    return;
  }

  printSection('PAIRING');
  log('INFO', 'No credentials found. Pairing required.');
  log('INFO', 'Generate a pairing code from your Shop Dashboard.');

  rl.question('\n  Enter 6-digit code: ', async (code) => {
    console.log('');
    try {
      const res  = await apiFetch('/agent/pair', 'POST', { code: code.trim() });
      const data = await res.json();

      if (data.success) {
        config.token = data.token;
        config.printedJobs = [];
        saveConfig();
        log('OK',   'Paired successfully.');
        log('INFO', 'Token saved. Will reconnect automatically on restart.');
        startPolling();
      } else {
        log('ERR', `Pairing failed: ${data.error}`);
        promptPairing();
      }
    } catch (err) {
      log('ERR', `Network error: ${err.message}`);
      promptPairing();
    }
  });
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────
function apiFetch(endpoint, method = 'GET', body = null) {
  const url      = new URL(API_BASE + endpoint);
  const isHttps  = url.protocol === 'https:';
  const agent    = isHttps ? https : http;
  const payload  = body ? JSON.stringify(body) : null;

  const options = {
    hostname: url.hostname,
    port:     url.port || (isHttps ? 443 : 80),
    path:     url.pathname + url.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(config.token ? { 'Authorization': `Bearer ${config.token}` } : {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    },
  };

  return new Promise((resolve, reject) => {
    const req = agent.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, json: () => JSON.parse(raw) });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function updateJobStatus(orderId, status) {
  try {
    await apiFetch(`/agent/jobs/${orderId}/status`, 'POST', { status });
    log('INFO', `Job status -> ${status}`);
  } catch (err) {
    log('WARN', `Could not update status: ${err.message}`);
  }
}

// ─── File download ──────────────────────────────────────────────────────────
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

// ─── Poll loop ──────────────────────────────────────────────────────────────
async function startPolling() {
  printSection('READY');
  log('INFO', `Polling every ${POLL_MS / 1000}s for new print jobs...`);
  log('INFO', 'Press Ctrl+C to stop.\n');

  setInterval(async () => {
    try {
      const res  = await apiFetch('/agent/jobs');
      const data = await res.json();

      if (res.status === 401) {
        log('ERR', 'Token rejected. Clearing credentials and re-pairing.');
        config.token = null;
        saveConfig();
        process.exit(1);
      }

      if (!data.success || !data.jobs?.length) return; // nothing to do

      const job = data.jobs[0];

      // Server-side idempotency guard
      if (config.printedJobs.includes(job.id)) {
        log('WARN', `Job ${job.orderNumber} already printed. Notifying server.`);
        const fallbackStatus = job.simulationEnabled ? 'SIMULATED_PRINTED' : 'PRINTED';
        await updateJobStatus(job.id, fallbackStatus);
        return;
      }

      // ── New job ──────────────────────────────────────────────────────
      console.log(`\n  ┌${line('─')}┐`);
      console.log(box(`  NEW JOB: ${job.orderNumber}`));
      console.log(`  ├${line('─')}┤`);
      console.log(box(`  Pages : ${job.pageCount}`));
      console.log(box(`  Mode  : ${job.settings?.mode || 'BW'}`));
      console.log(box(`  Sides : ${job.settings?.sides || 'SINGLE'}`));
      console.log(box(`  Copies: ${job.settings?.copies || 1}`));
      console.log(`  └${line('─')}┘\n`);

      await updateJobStatus(job.id, 'PRINTING');

      let allPrinted = true;
      const simMode = job.simulationEnabled === true;
      
      if (simMode) {
        log('INFO', '*** SIMULATED PRINTER MODE ACTIVE ***');
      }

      for (const file of job.files) {
        let downloadUrl = file.cloudinaryUrl;
        if (file.resourceType === 'image' && !downloadUrl.endsWith('.pdf')) {
          downloadUrl = downloadUrl.replace(/\.[^/.]+$/, '.pdf');
        }

        if (!downloadUrl.endsWith('.pdf') && file.format !== 'pdf') {
          log('WARN', `Skipping non-PDF file: ${file.originalName}`);
          continue;
        }

        const tempPath = path.join(os.tmpdir(), `pd_${job.orderNumber}_${Date.now()}.pdf`);
        log('INFO', `Downloading: ${file.originalName}`);

        try {
          await downloadFile(downloadUrl, tempPath);
          log('OK',   `Downloaded to temp: ${path.basename(tempPath)}`);
        } catch (err) {
          log('ERR', `Download failed: ${err.message}`);
          allPrinted = false;
          continue;
        }

        if (simMode) {
          try {
            const simDir = path.join(os.homedir(), 'Desktop', 'printdesk-simulated-output');
            if (!fs.existsSync(simDir)) fs.mkdirSync(simDir, { recursive: true });
            
            const safeName = file.originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const finalPdfPath = path.join(simDir, `pd_${job.orderNumber}_${safeName}.pdf`);
            fs.copyFileSync(tempPath, finalPdfPath);
            
            const manifest = {
              orderId: job.id,
              orderNumber: job.orderNumber,
              fileName: file.originalName,
              pdfUrl: downloadUrl,
              pageCount: job.pageCount,
              selectedPrinter: 'PrintDesk Simulator',
              copies: job.settings?.copies || 1,
              mode: job.settings?.mode || 'BW',
              sides: job.settings?.sides || 'SINGLE',
              paperSize: 'A4',
              timestamp: new Date().toISOString(),
              result: 'success'
            };
            fs.writeFileSync(path.join(simDir, `pd_${job.orderNumber}_manifest.json`), JSON.stringify(manifest, null, 2));
            
            log('OK', `[SIMULATION] Saved PDF and manifest to Desktop/printdesk-simulated-output`);
            await new Promise(r => setTimeout(r, 2000)); // fake delay
          } catch (err) {
            log('ERR', `[SIMULATION] Failed: ${err.message}`);
            allPrinted = false;
            await updateJobStatus(job.id, 'NEEDS_ATTENTION');
          }
        } else if (os.platform() === 'win32') {
          try {
            const printOptions = {
              copies: job.settings?.copies || 1,
              sides: job.settings?.sides === 'DOUBLE' ? 'two-sided-long-edge' : 'one-sided',
            };
            log('INFO', `Sending to Windows spooler...`);
            await ptp.print(tempPath, printOptions);
            log('OK',   `Printed: ${file.originalName}`);
          } catch (err) {
            log('ERR',  `Print failed: ${err.message}`);
            allPrinted = false;
            await updateJobStatus(job.id, 'NEEDS_ATTENTION');
          }
        } else {
          // Dev / non-Windows simulation (legacy fallback)
          log('INFO', `[Dev Simulation] Would print ${file.originalName} x${job.settings?.copies || 1}`);
          await new Promise((r) => setTimeout(r, 1500));
          log('OK',   `[Dev Simulation] Done.`);
        }

        fs.unlink(tempPath, () => {});
      }

      if (allPrinted) {
        // Cache job ID (keep last 50)
        config.printedJobs.push(job.id);
        if (config.printedJobs.length > 50) config.printedJobs.shift();
        saveConfig();

        const finalStatus = simMode ? 'SIMULATED_PRINTED' : 'PRINTED';
        await updateJobStatus(job.id, finalStatus);
        log('OK',   `Job ${job.orderNumber} complete (${finalStatus}).\n`);
      }

    } catch (err) {
      log('WARN', `Poll error: ${err.message}`);
    }
  }, POLL_MS);
}

// ─── Startup ────────────────────────────────────────────────────────────────
printHeader();
promptPairing();
