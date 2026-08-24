const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, typed API to the renderer process.
// The renderer can ONLY call these functions — it never touches Node.js directly.
contextBridge.exposeInMainWorld('api', {
  // ── Auth ──────────────────────────────────────────────────────────────────
  pair: (code) => ipcRenderer.invoke('auth:pair', code),
  unpair: () => ipcRenderer.invoke('auth:unpair'),
  getAuthState: () => ipcRenderer.invoke('auth:getState'),

  // ── Dashboard ─────────────────────────────────────────────────────────────
  getDashboard: () => ipcRenderer.invoke('dashboard:get'),
  getHistory: (filters) => ipcRenderer.invoke('history:get', filters),
  getMonthlyStats: () => ipcRenderer.invoke('stats:monthly'),

  // ── Queue Actions ─────────────────────────────────────────────────────────
  retryJob: (orderId) => ipcRenderer.invoke('queue:retry', orderId),
  cancelJob: (orderId) => ipcRenderer.invoke('queue:cancel', orderId),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  getPrinters: () => ipcRenderer.invoke('settings:getPrinters'),
  getQrCode: () => ipcRenderer.invoke('settings:getQrCode'),
  downloadQrCode: () => ipcRenderer.invoke('settings:downloadQrCode'),
  exportHistoryCsv: (filters) => ipcRenderer.invoke('history:exportCsv', filters),

  // ── Real-Time Events (Agent → Renderer) ───────────────────────────────────
  onAgentEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('agent:event', handler);
    return () => ipcRenderer.removeListener('agent:event', handler);
  },
  onNewJob: (callback) => {
    const handler = (_, job) => callback(job);
    ipcRenderer.on('agent:newJob', handler);
    return () => ipcRenderer.removeListener('agent:newJob', handler);
  },
  onJobStatusChange: (callback) => {
    const handler = (_, update) => callback(update);
    ipcRenderer.on('agent:jobStatus', handler);
    return () => ipcRenderer.removeListener('agent:jobStatus', handler);
  },
  onConnectivityChange: (callback) => {
    const handler = (_, state) => callback(state);
    ipcRenderer.on('agent:connectivity', handler);
    return () => ipcRenderer.removeListener('agent:connectivity', handler);
  },
});
