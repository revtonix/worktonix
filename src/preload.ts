import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('worktonix', {
  isElectron: true,
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  platform: process.platform,
});
