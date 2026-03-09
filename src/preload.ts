import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('worktonix', {
  isElectron: true,
  getApiUrl: () => ipcRenderer.invoke('get-api-url'),
  platform: process.platform,
  adspower: {
    start: (profileId: string) => ipcRenderer.invoke('adspower:start', profileId),
    stop: (profileId: string) => ipcRenderer.invoke('adspower:stop', profileId),
    status: () => ipcRenderer.invoke('adspower:status'),
    listProfiles: () => ipcRenderer.invoke('adspower:list-profiles'),
    bulkStart: (profileIds: string[]) => ipcRenderer.invoke('adspower:bulk-start', profileIds),
    stopAll: (profileIds: string[]) => ipcRenderer.invoke('adspower:stop-all', profileIds),
    setConfig: (apiUrl: string, apiKey: string) => ipcRenderer.invoke('adspower:set-config', apiUrl, apiKey),
    fetchConfig: (token: string) => ipcRenderer.invoke('adspower:fetch-config', token),
  },
});
