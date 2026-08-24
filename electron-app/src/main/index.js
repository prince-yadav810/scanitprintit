const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const agent = require('./agent');
const ipcHandlers = require('./ipc-handlers');

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

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
  const iconPath = path.join(__dirname, '../../resources/tray-icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));

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
