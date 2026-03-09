import { app, BrowserWindow, ipcMain, net } from 'electron';
import * as path from 'path';

const APP_URL = 'https://worktonix.vercel.app';
const BACKEND_URL = 'https://worktonix-workspace-production.up.railway.app';

// Cached AdsPower config — fetched from backend on startup
let adspowerBase = 'http://local.adspower.net:50325';
let adspowerApiKey = '';

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

// ── AdsPower helpers ──────────────────────────────────────────────

function adsPowerFetch(endpoint: string): Promise<unknown> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const apiKeyParam = adspowerApiKey ? `api_key=${encodeURIComponent(adspowerApiKey)}` : '';
  const url = `${adspowerBase}${endpoint}${apiKeyParam ? separator + apiKeyParam : ''}`;

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

async function adsPowerStartWithRetry(
  profileId: string,
  maxRetries = 3,
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await adsPowerFetch(
        `/api/v1/browser/start?user_id=${encodeURIComponent(profileId)}`,
      );
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRateLimit = lastError.message.includes('429') || lastError.message.includes('connection refused');
      const delay = isRateLimit ? 2000 : Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError ?? new Error('Failed after retries');
}

// ── IPC handlers ──────────────────────────────────────────────────

ipcMain.handle('adspower:start', async (_event, profileId: string) => {
  return adsPowerStartWithRetry(profileId);
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

ipcMain.handle('adspower:bulk-start', async (_event, profileIds: string[]) => {
  const results: Array<{ profileId: string; success: boolean; error?: string }> = [];
  const batchSize = 10;
  const delayMs = 500;

  for (let i = 0; i < profileIds.length; i += batchSize) {
    const batch = profileIds.slice(i, i + batchSize);

    for (const profileId of batch) {
      try {
        const result = await adsPowerStartWithRetry(profileId) as { code: number; msg?: string };
        results.push({
          profileId,
          success: result.code === 0,
          error: result.code !== 0 ? (result.msg || 'Unknown error') : undefined,
        });
      } catch (err) {
        results.push({
          profileId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Delay between each launch within a batch
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
});

ipcMain.handle('adspower:stop-all', async (_event, profileIds: string[]) => {
  const results: Array<{ profileId: string; success: boolean; error?: string }> = [];

  for (const profileId of profileIds) {
    try {
      const result = await adsPowerFetch(
        `/api/v1/browser/stop?user_id=${encodeURIComponent(profileId)}`,
      ) as { code: number; msg?: string };
      results.push({
        profileId,
        success: result.code === 0,
        error: result.code !== 0 ? (result.msg || 'Unknown error') : undefined,
      });
    } catch (err) {
      results.push({
        profileId,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
});

ipcMain.handle('get-api-url', () => APP_URL);

// ── Fetch AdsPower config from backend ──

async function fetchAdspowerConfig(token: string): Promise<void> {
  try {
    const url = `${BACKEND_URL}/api/adspower/config`;
    const response = await net.fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const config = await response.json() as { apiUrl?: string } | null;
      if (config?.apiUrl) {
        adspowerBase = config.apiUrl;
      }
    }
  } catch {
    // Use defaults if backend unreachable
  }
}

ipcMain.handle('adspower:set-config', async (_event, apiUrl: string, apiKey: string) => {
  adspowerBase = apiUrl || adspowerBase;
  adspowerApiKey = apiKey || adspowerApiKey;
});

ipcMain.handle('adspower:fetch-config', async (_event, token: string) => {
  await fetchAdspowerConfig(token);
  return { apiUrl: adspowerBase };
});

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
