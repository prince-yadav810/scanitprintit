/**
 * ipc-handlers.js — Registers all IPC handlers for the renderer.
 * The renderer calls window.api.xxx() → preload → ipcMain here.
 */

const { shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const agent = require('./agent');
const { getDiagnostics } = require('./diagnostics');
const { getPrinterSnapshot } = require('./windows-printer');
const { describePrinter } = require('./printer-health');

module.exports = {
  register(ipcMain, store, mainWindow) {
    let posterCache;
    async function getShopPoster() {
      const token = store.get('token');
      const slug = store.get('shopSlug');
      if (!token || !slug) throw new Error('Pair this device and load your shop before opening its poster.');
      const url = new URL(`/s/${encodeURIComponent(slug)}/poster`, process.env.SCANITPRINTIT_API || 'https://www.scanitprintit.in');
      if (posterCache?.url === url.href) return { slug, buffer: posterCache.buffer };

      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
        throw new Error('Could not load the shop poster.');
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (store.get('token') !== token) throw new Error('The device signed out.');
      posterCache = { url: url.href, buffer };
      return { slug, buffer };
    }

    // ── Auth ─────────────────────────────────────────────────────────────────
    ipcMain.handle('auth:pair', async (_, code) => {
      const result = await agent.pair(code);
      return result;
    });
    ipcMain.handle('auth:trial', (_, details) => agent.startTrial(details));
    ipcMain.handle('trial:plans', () => shell.openExternal('https://www.scanitprintit.in/pricing'));

    ipcMain.handle('auth:unpair', () => {
      const result = agent.signOut();
      if (result.success) posterCache = undefined;
      return result;
    });

    ipcMain.handle('auth:getState', () => {
      return {
        paired: !!store.get('token'),
        canResumeTrial: !!store.get('trialActivationKey'),
        diagnosticsOnly: agent.isDiagnosticsOnly(),
        shopName: store.get('shopName'),
        shopSlug: store.get('shopSlug'),
        shopId:   store.get('shopId'),
      };
    });

    // ── Dashboard ─────────────────────────────────────────────────────────────
    ipcMain.handle('dashboard:get', async () => {
      const token = store.get('token');
      try {
        const data = await agent.getDashboard();
        // Cache for offline use
        if (token && store.get('token') === token && data.success !== false) {
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
        const cache = token && store.get('token') === token && store.get('dashboardCache');
        if (cache) {
          return { ...cache.data, _cached: true, _cachedAt: cache.cachedAt };
        }
        throw err;
      }
    });

    // ── History ───────────────────────────────────────────────────────────────
    ipcMain.handle('history:get', async (_, filters) => {
      const token = store.get('token');
      try {
        const data = await agent.getHistory(filters);
        if (token && store.get('token') === token) store.set('historyCache', { data, cachedAt: Date.now() });
        return data;
      } catch {
        const cache = token && store.get('token') === token && store.get('historyCache');
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
    ipcMain.handle('queue:approve', async (_, orderId) => {
      try { return await agent.approveJob(orderId); }
      catch (error) { return { success: false, error: error.message }; }
    });
    ipcMain.handle('queue:retry', async (_, orderId) => {
      try { return await agent.retryJob(orderId); }
      catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('queue:cancel', async (_, orderId) => {
      try { return await agent.cancelJob(orderId); }
      catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('diagnostics:status', () => getDiagnostics()?.status() || { pending: 0, lastSyncedAt: null, history: [] });
    ipcMain.handle('diagnostics:printTestPage', () => agent.printTestPage());
    ipcMain.handle('engine:status', () => agent.getRendererReadiness());

    // ── Settings ──────────────────────────────────────────────────────────────
    ipcMain.handle('settings:get', () => {
      return {
        selectedPrinter:    store.get('selectedPrinter', null),
        soundEnabled:       store.get('soundEnabled', false),
        printerHealthEnabled: store.get('printerHealthEnabled', true),
        autoLaunch:         !agent.isDiagnosticsOnly() && store.get('autoLaunch', true),
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
      if ('autoLaunch' in settings && !agent.isDiagnosticsOnly()) {
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

    ipcMain.handle('settings:printerHealth', async () => {
      const selected = store.get('selectedPrinter', null);
      if (!store.get('printerHealthEnabled', true)) return {
        state: 'disabled', label: 'Printer monitoring off', printer: selected, checkedAt: new Date().toISOString(),
      };
      return describePrinter(await getPrinterSnapshot(selected), selected);
    });

    ipcMain.handle('settings:getPrinters', async () => {
      try {
        if (os.platform() === 'win32') {
          const printers = await mainWindow.webContents.getPrintersAsync();
          return { success: true, printers: printers.map(p => p.name), defaultPrinter: printers.find(p => p.isDefault)?.name || null };
        }
        return { success: true, printers: [] };
      } catch (error) {
        return { success: false, printers: [], error: error.message };
      }
    });

    ipcMain.handle('settings:getQrCode', async () => {
      try {
        const { buffer } = await getShopPoster();
        return { success: true, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
      } catch {
        return { success: false, error: 'Could not load the QR poster. Check your connection and try again.' };
      }
    });

    ipcMain.handle('settings:downloadQrCode', async () => {
      try {
        const { slug, buffer } = await getShopPoster();
        const filename = `scanitprintit-qr-${slug.replace(/[^a-z0-9_-]/gi, '-')}.png`;
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
          defaultPath: path.join(os.homedir(), 'Desktop', filename),
          filters: [{ name: 'PNG Image', extensions: ['png'] }],
        });
        if (!filePath) return { success: false, cancelled: true };
        await fs.promises.writeFile(filePath, buffer);
        shell.showItemInFolder(filePath);
        return { success: true };
      } catch {
        return { success: false, error: 'Could not save the QR poster. Check your connection and try again.' };
      }
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
