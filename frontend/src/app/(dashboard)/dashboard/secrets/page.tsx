'use client';

import { useState } from 'react';
import RequireRole from '@/components/require-role';

interface Secret {
  id: string;
  name: string;
  lastRotated: string;
  masked: string;
}

const INITIAL_SECRETS: Secret[] = [
  { id: '1', name: 'PROXY_API_KEY', lastRotated: 'Mar 1, 2026', masked: '••••••••••••sk-3f8a' },
  { id: '2', name: 'ENCRYPTION_KEY', lastRotated: 'Feb 15, 2026', masked: '••••••••••••enc-9b2c' },
  { id: '3', name: 'WEBHOOK_SECRET', lastRotated: 'Jan 20, 2026', masked: '••••••••••••wh-7d4e' },
];

export default function SecretsPage() {
  const [secrets] = useState<Secret[]>(INITIAL_SECRETS);

  return (
    <RequireRole minRole="ADMIN">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Secrets</h1>
          <p className="text-sm text-gray-400">Manage API keys and encryption secrets.</p>
        </div>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
          + Add Secret
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-800 bg-surface-card text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Value</th>
              <th className="px-5 py-3">Last Rotated</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-surface-card">
            {secrets.map((s) => (
              <tr key={s.id} className="hover:bg-surface-hover transition">
                <td className="px-5 py-3 font-medium text-white font-mono text-xs">{s.name}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.masked}</td>
                <td className="px-5 py-3 text-gray-400">{s.lastRotated}</td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button className="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition hover:border-brand hover:text-brand">
                      Rotate
                    </button>
                    <button className="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition hover:border-red-500 hover:text-red-400">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RequireRole>
  );
}
