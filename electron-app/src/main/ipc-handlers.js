/**
 * ipc-handlers.js — Registers all IPC handlers for the renderer.
 * The renderer calls window.api.xxx() → preload → ipcMain here.
 */

const { shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const ptp  = require('pdf-to-printer');
const QRCode = require('qrcode');
const agent = require('./agent');

module.exports = {
  register(ipcMain, store, mainWindow) {

    // ── Auth ─────────────────────────────────────────────────────────────────
    ipcMain.handle('auth:pair', async (_, code) => {
      const result = await agent.pair(code);
      return result;
    });

    ipcMain.handle('auth:unpair', async () => {
      if (agent.isPrinting()) {
        return { success: false, error: 'A print job is in progress. Wait for it to finish before disconnecting.' };
      }
      store.delete('token');
      store.delete('printedJobs');
      return { success: true };
    });

    ipcMain.handle('auth:getState', () => {
      return {
        paired: !!store.get('token'),
        shopName: store.get('shopName'),
        shopSlug: store.get('shopSlug'),
        shopId:   store.get('shopId'),
      };
    });

    // ── Dashboard ─────────────────────────────────────────────────────────────
    ipcMain.handle('dashboard:get', async () => {
      try {
        const data = await agent.getDashboard();
        // Cache for offline use
        if (data.success !== false) {
          store.set('dashboardCache', { data, cachedAt: Date.now() });
          // Also persist shop info
          if (data.shop) {
            store.set('shopName', data.shop.name);
            store.set('shopSlug', data.shop.slug);
            store.set('shopId',   data.shop.id);
          }
        }
        return data;
      } catch (err) {
        // Return cached data on failure
        const cache = store.get('dashboardCache');
        if (cache) {
          return { ...cache.data, _cached: true, _cachedAt: cache.cachedAt };
        }
        throw err;
      }
    });

    // ── History ───────────────────────────────────────────────────────────────
    ipcMain.handle('history:get', async (_, filters) => {
      try {
        const data = await agent.getHistory(filters);
        store.set('historyCache', { data, cachedAt: Date.now() });
        return data;
      } catch {
        const cache = store.get('historyCache');
        if (cache) return { ...cache.data, _cached: true, _cachedAt: cache.cachedAt };
        throw new Error('Offline and no cached data available.');
      }
    });

    ipcMain.handle('stats:monthly', async () => {
      try {
        return await agent.getMonthlyStats();
      } catch {
        return store.get('monthlyStatsCache') || { error: 'Offline' };
      }
    });

    // ── Queue Actions ─────────────────────────────────────────────────────────
    ipcMain.handle('queue:retry', async (_, orderId) => {
      // Remove from printed cache so agent picks it up again
      const printedJobs = store.get('printedJobs', []);
      store.set('printedJobs', printedJobs.filter(id => id !== orderId));
      return { success: true };
    });

    ipcMain.handle('queue:cancel', async (_, orderId) => {
      const res = await agent.cancelJob(orderId);
      return res;
    });

    // ── Settings ──────────────────────────────────────────────────────────────
    ipcMain.handle('settings:get', () => {
      return {
        selectedPrinter:    store.get('selectedPrinter', null),
        soundEnabled:       store.get('soundEnabled', false),
        printerHealthEnabled: store.get('printerHealthEnabled', false),
        autoLaunch:         store.get('autoLaunch', true),
      };
    });

    ipcMain.handle('settings:getRemote', async () => {
      try {
        return await agent.getSettings();
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('settings:save', async (_, settings) => {
      // Save local settings to electron-store
      if ('selectedPrinter' in settings) store.set('selectedPrinter', settings.selectedPrinter);
      if ('soundEnabled' in settings)    store.set('soundEnabled', settings.soundEnabled);
      if ('printerHealthEnabled' in settings) store.set('printerHealthEnabled', settings.printerHealthEnabled);
      if ('autoLaunch' in settings) {
        store.set('autoLaunch', settings.autoLaunch);
        const { app } = require('electron');
        app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
      }

      // Save remote settings (pricing, auto-print, etc.) to backend
      if (settings.remote) {
        return await agent.saveSettings(settings.remote);
      }
      return { success: true };
    });

    ipcMain.handle('settings:getPrinters', async () => {
      try {
        if (os.platform() === 'win32') {
          const printers = await ptp.getPrinters();
          return { success: true, printers: printers.map(p => p.name) };
        }
        return { success: true, printers: [] };
      } catch {
        return { success: true, printers: [] };
      }
    });

    ipcMain.handle('settings:getQrCode', async () => {
      const slug = store.get('shopSlug');
      if (!slug) return { success: false, error: 'Not paired yet.' };
      const url = `https://www.scanitprintit.in/s/${slug}`;
      const dataUrl = await QRCode.toDataURL(url, { margin: 2, scale: 12, color: { dark: '#1a1915', light: '#ffffff' } });
      return { success: true, dataUrl, url };
    });

    ipcMain.handle('settings:downloadQrCode', async () => {
      const slug = store.get('shopSlug');
      if (!slug) return { success: false, error: 'Not paired yet.' };
      const url = `https://www.scanitprintit.in/s/${slug}`;
      const dataUrl = await QRCode.toDataURL(url, { margin: 2, scale: 20, color: { dark: '#1a1915', light: '#ffffff' } });

      // Convert data URL to buffer and save
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(os.homedir(), 'Desktop', `scanitprintit-qr-${slug}.png`),
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (filePath) {
        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: 'Cancelled' };
    });

    // ── CSV Export ────────────────────────────────────────────────────────────
    ipcMain.handle('history:exportCsv', async (_, filters) => {
      const historyData = await agent.getHistory(filters);
      const orders = historyData.orders || [];

      const rows = [
        ['Order ID', 'Date', 'Pages', 'Mode', 'Copies', 'Amount (INR)', 'Status'],
        ...orders.map(o => [
          o.orderNumber,
          new Date(o.createdAt).toLocaleDateString('en-IN'),
          o.pageCount,
          o.settings?.mode || 'BW',
          o.settings?.copies || 1,
          o.totalAmount.toFixed(2),
          o.status,
        ])
      ];

      const csv = rows.map(r => r.join(',')).join('\n');
      const { filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(os.homedir(), 'Desktop', `scanitprintit-orders-${Date.now()}.csv`),
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (filePath) {
        fs.writeFileSync(filePath, csv, 'utf8');
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: 'Cancelled' };
    });
  }
};
