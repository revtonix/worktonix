import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('worktonix', {
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  platform: process.platform,
});
