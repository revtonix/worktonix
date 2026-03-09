import { app, BrowserWindow, ipcMain, net } from 'electron';
import * as path from 'path';

const APP_URL = 'https://worktonix.vercel.app';
const ADSPOWER_BASE = 'http://local.adspower.net:50325';
const ADSPOWER_API_KEY = '32bd8fc3024d3de11ddb5efcb7fe2f5500781143a9666f96';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WorkTonix',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── AdsPower IPC handlers (bypasses CORS by running in Node.js) ──

async function adsPowerFetch(endpoint: string): Promise<unknown> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${ADSPOWER_BASE}${endpoint}${separator}api_key=${ADSPOWER_API_KEY}`;

  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let body = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString(); });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON from AdsPower: ${body.slice(0, 200)}`));
        }
      });
    });

    request.on('error', (err) => {
      reject(new Error(`Cannot reach AdsPower: ${err.message}`));
    });

    request.end();
  });
}

ipcMain.handle('adspower:start', async (_event, profileId: string) => {
  return adsPowerFetch(`/api/v1/browser/start?user_id=${encodeURIComponent(profileId)}`);
});

ipcMain.handle('adspower:stop', async (_event, profileId: string) => {
  return adsPowerFetch(`/api/v1/browser/stop?user_id=${encodeURIComponent(profileId)}`);
});

ipcMain.handle('adspower:status', async () => {
  return adsPowerFetch('/api/v1/status');
});

ipcMain.handle('adspower:list-profiles', async () => {
  return adsPowerFetch('/api/v1/user/list?page_size=100');
});

ipcMain.handle('get-api-url', () => APP_URL);

// ── App lifecycle ──

app.whenReady().then(() => {
  app.userAgentFallback = `${app.userAgentFallback} WorkTonix-Electron`;
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
