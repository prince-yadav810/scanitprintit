const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const agent = require('./agent');
const ipcHandlers = require('./ipc-handlers');
const { autoUpdater } = require('electron-updater');
const { createDiagnostics, recordDiagnostic } = require('./diagnostics');
const { verifyRenderer } = require('./renderer-self-test');
const { getAgentProcessSnapshot } = require('./windows-printer');
const { configureAppProfile, importSupportPairing } = require('./app-profile');
const diagnosticsOnly = process.argv.includes('--diagnostics-only') || Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
const profile = configureAppProfile(app, diagnosticsOnly);

function bootstrap() {
  // ─── Auto Updater setup ───────────────────────────────────────────────────────
  autoUpdater.autoDownload = !diagnosticsOnly;
  autoUpdater.autoInstallOnAppQuit = !diagnosticsOnly;

  function setupAutoUpdater(win) {
    autoUpdater.on('checking-for-update', () => {
      if (win && !win.isDestroyed()) win.webContents.send('updater:status', { status: 'checking' });
    });
    autoUpdater.on('update-available', (info) => {
      if (win && !win.isDestroyed()) win.webContents.send('updater:status', { status: 'available', version: info.version });
    });
    autoUpdater.on('update-not-available', () => {
      if (win && !win.isDestroyed()) win.webContents.send('updater:status', { status: 'up-to-date', version: app.getVersion() });
    });
    autoUpdater.on('download-progress', (p) => {
      if (win && !win.isDestroyed()) win.webContents.send('updater:progress', { percent: Math.round(p.percent), speed: p.bytesPerSecond, transferred: p.transferred, total: p.total });
    });
    autoUpdater.on('update-downloaded', (info) => {
      updateReady = true;
      if (win && !win.isDestroyed()) win.webContents.send('updater:status', { status: 'downloaded', version: info.version });
    });
    autoUpdater.on('error', (err) => {
      recordDiagnostic({ level: 'error', stage: 'updater', code: 'UPDATE_ERROR', message: err.message });
      if (installingUpdate) {
        installingUpdate = false;
        isQuitting = false;
        updateReady = false;
        startAgent();
      }
      if (win && !win.isDestroyed()) win.webContents.send('updater:status', { status: 'error', message: err.message });
    });
    autoUpdater.on('before-quit-for-update', () => {
      isQuitting = true;
    });
  }

  // IPC: renderer triggers check or install
  ipcMain.handle('updater:check', async () => {
    if (diagnosticsOnly) return { success: false, error: 'Support mode does not download updates. Open the latest support download instead.' };
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:install', () => {
    if (diagnosticsOnly) return { success: false, error: 'Support mode does not install updates. Use the installed agent or setup.' };
    if (agent.isPrinting()) return { success: false, error: 'A print job is running. Wait for it to finish before installing the update.' };
    if (!updateReady) return { success: false, error: 'No downloaded update is ready to install.' };
    agent.stop();
    isQuitting = true;
    installingUpdate = true;
    try { autoUpdater.quitAndInstall(false, true); }
    catch (error) { autoUpdater.emit('error', error); }
    return installingUpdate
      ? { success: true }
      : { success: false, error: 'Update installation failed. Check the update status and try again.' };
  });

  ipcMain.handle('updater:getVersion', () => app.getVersion());


  // ─── Crash visibility (dev) ───────────────────────────────────────────────────
  process.on('uncaughtException', (err) => {
    recordDiagnostic({ level: 'error', stage: 'runtime', code: 'UNCAUGHT_EXCEPTION', message: err.message, data: { stack: err.stack } });
    console.error('UNCAUGHT:', err);
    dialog.showErrorBox('Agent Error', err.message + '\n\n' + err.stack);
  });
  process.on('unhandledRejection', error => {
    recordDiagnostic({ level: 'error', stage: 'runtime', code: 'UNHANDLED_REJECTION', message: error?.message || String(error) });
  });

  const store = new Store();
  const pairingImported = importSupportPairing(store, profile);

  let mainWindow = null;
  let tray = null;
  let isQuitting = false;
  let quitRequested = false;
  let updateReady = false;
  let installingUpdate = false;
  let diagnostics;

  function startAgent() {
    agent.start(store, (event, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(event, data);
    }, { diagnosticsOnly });
  }

  async function requestQuit() {
    if (quitRequested) return;
    quitRequested = true;
    agent.stop();
    recordDiagnostic({ stage: 'shutdown', code: 'QUIT_REQUESTED', message: 'The operator requested shutdown', data: { printing: agent.isPrinting() } });
    if (agent.isPrinting() && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', { type: 'info', message: 'Finishing the current print job before closing the agent.' });
    }
    try { await agent.waitForIdle(); }
    finally {
      await diagnostics?.flush(true);
      isQuitting = true; app.quit();
    }
  }

  app.on('second-instance', (_, argv) => {
    if (argv.includes('--quit-for-update')) {
      requestQuit();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ─── Create Main Window ──────────────────────────────────────────────────────
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: diagnosticsOnly ? `ScanItPrintIt Support v${app.getVersion()}` : 'ScanItPrintIt Agent',
      backgroundColor: '#0f0f10',
      show: false, // Show after ready-to-show
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false, // Security: never expose Node to renderer
        autoplayPolicy: 'no-user-gesture-required', // Allow audio to play automatically
      },
    });

    const rendererPath = path.join(__dirname, '../../src/renderer/index.html');
    const fallbackPath = path.join(__dirname, '../renderer/index.html');
    const htmlPath = require('fs').existsSync(rendererPath) ? rendererPath : fallbackPath;
    mainWindow.loadFile(htmlPath);

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Show errors in the renderer
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
      recordDiagnostic({ level: 'error', stage: 'dashboard', code: 'DASHBOARD_LOAD_FAILED', message: desc, data: { errorCode: code } });
      console.error('Renderer failed to load:', code, desc);
      dialog.showErrorBox('Load Error', `Failed to load UI: ${desc} (${code})\nPath: ${htmlPath}`);
    });

    // Dev tools on Ctrl+Shift+I
    mainWindow.webContents.on('before-input-event', (e, input) => {
      if (input.control && input.shift && input.key === 'I') {
        mainWindow.webContents.toggleDevTools();
      }
    });

    // Minimize to tray on close — do NOT quit the agent
    mainWindow.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });
  }

  // ─── System Tray ─────────────────────────────────────────────────────────────
  function createTray() {
    // Resolve icon with fallbacks for different working dirs
    const iconPaths = [
      path.join(__dirname, '../../resources/tray-icon.png'),
      path.join(__dirname, '../../../resources/tray-icon.png'),
      path.join(app.getAppPath(), 'resources/tray-icon.png'),
    ];
    const fs = require('fs');
    const iconFile = iconPaths.find(p => fs.existsSync(p));
    const icon = iconFile ? nativeImage.createFromPath(iconFile) : nativeImage.createEmpty();
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Dashboard',
        click: () => {
          mainWindow.show();
          mainWindow.focus();
        },
      },
      { type: 'separator' },
      {
        label: diagnosticsOnly ? 'Quit ScanItPrintIt Support' : 'Quit ScanItPrintIt Agent',
        click: () => requestQuit(),
      },
    ]);

    tray.setToolTip(diagnosticsOnly ? `ScanItPrintIt Support v${app.getVersion()}` : 'ScanItPrintIt Agent');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      mainWindow.show();
      mainWindow.focus();
    });
  }

  // ─── App Lifecycle ────────────────────────────────────────────────────────────
  app.whenReady().then(() => {
    diagnostics = createDiagnostics({ store, directory: path.join(app.getPath('userData'), 'logs'), send: events => agent.sendDiagnostics(events) });
    createWindow();
    createTray();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'File', submenu: [{ label: 'Quit ScanItPrintIt Agent', accelerator: 'Alt+F4', click: () => requestQuit() }] },
      { role: 'editMenu' },
      { role: 'viewMenu' },
    ]));
    ipcHandlers.register(ipcMain, store, mainWindow);
    startAgent();
    diagnostics.start();
    recordDiagnostic({ stage: 'startup', code: 'RUN_MODE', message: diagnosticsOnly ? 'Standalone support mode: automatic order printing is paused' : 'Installed agent: automatic order processing enabled', data: { diagnosticsOnly } });
    if (diagnosticsOnly) recordDiagnostic({ stage: 'startup', code: 'SUPPORT_PROFILE', message: 'Support opened with its own profile and instance lock', data: { pairingImported } });
    void getAgentProcessSnapshot().then(snapshot => recordDiagnostic({ stage: 'installer', code: 'AGENT_PROCESS_SCAN', message: 'Agent processes visible to Windows', data: snapshot }));
    void verifyRenderer().then(result => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('agent:event', {
        type: result.success ? 'info' : 'error',
        message: result.success ? 'Document renderer self-test passed.' : `Document renderer self-test failed: ${result.error}`,
      });
      void diagnostics.flush(true);
    });

    // Setup auto-updater and check for updates 5s after launch (give time for UI to load)
    setupAutoUpdater(mainWindow);
    if (!diagnosticsOnly) setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.warn('Update check failed (possibly offline):', err.message);
      });
    }, 5000);
  });

  app.on('window-all-closed', () => {
    // Let the app actually quit when windows are forcefully closed by the updater
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', (event) => {
    if (!isQuitting && agent.isPrinting()) {
      event.preventDefault();
      requestQuit();
      return;
    }
    isQuitting = true;
    agent.stop();
    diagnostics?.stop();
  });

  // Auto-launch on Windows startup
  if (!diagnosticsOnly) app.setLoginItemSettings({
    openAtLogin: store.get('autoLaunch', true),
    path: app.getPath('exe'),
  });

}

// One process per profile. Support has a separate profile so an installed older
// agent cannot consume its launch or share its log/outbox files.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else if (process.argv.includes('--quit-for-update')) {
  app.exit(0);
} else {
  bootstrap();
}
