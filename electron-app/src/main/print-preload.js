const { contextBridge, ipcRenderer } = require('electron');

const channel = process.argv.find(arg => arg.startsWith('--print-channel='))?.slice('--print-channel='.length);
contextBridge.exposeInMainWorld('printDocument', {
  read: () => ipcRenderer.invoke(channel),
});
