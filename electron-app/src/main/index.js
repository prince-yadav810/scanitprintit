const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const agent = require('./agent');
const ipcHandlers = require('./ipc-handlers');

// ─── Crash visibility (dev) ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err);
  dialog.showErrorBox('Agent Error', err.message + '\n\n' + err.stack);
});

const store = new Store();

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ─── Create Main Window ──────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ScanItPrintIt Agent',
    backgroundColor: '#0f0f10',
    show: false, // Show after ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false, // Security: never expose Node to renderer
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
      label: 'Quit ScanItPrintIt Agent',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('ScanItPrintIt Agent');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  ipcHandlers.register(ipcMain, store, mainWindow);
  agent.start(store, (event, data) => {
    // Forward agent events to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, data);
    }
  });
});

app.on('window-all-closed', (e) => {
  // On macOS, app stays in dock. On Windows, prevent quit when closing window.
  e.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
  agent.stop();
});

// Auto-launch on Windows startup
app.setLoginItemSettings({
  openAtLogin: store.get('autoLaunch', true),
  path: app.getPath('exe'),
});
