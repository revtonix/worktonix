'use client';

import { useState } from 'react';
import RequireRole from '@/components/require-role';

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-surface px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-brand disabled:opacity-50';

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('https://api.worktonix.io');
  const [sessionTimeout, setSessionTimeout] = useState('60');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <RequireRole minRole="ADMIN">
      <h1 className="mb-1 text-2xl font-bold text-white">Settings</h1>
      <p className="mb-6 text-sm text-gray-400">System configuration and preferences.</p>

      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-gray-800 bg-surface-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            General
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-400">API Base URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Session Timeout (minutes)</label>
              <input
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-surface-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Security
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Two-Factor Authentication</span>
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs text-green-400">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">IP Whitelisting</span>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-400">Disabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Audit Logging</span>
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs text-green-400">Enabled</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-400">Settings saved!</span>
          )}
        </div>
      </div>
    </RequireRole>
  );
}
