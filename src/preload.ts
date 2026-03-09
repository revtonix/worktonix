import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('worktonix', {
  isElectron: true,
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  platform: process.platform,
  adspower: {
    start: (profileId: string) => ipcRenderer.invoke('adspower:start', profileId),
    stop: (profileId: string) => ipcRenderer.invoke('adspower:stop', profileId),
    status: () => ipcRenderer.invoke('adspower:status'),
  },
});
