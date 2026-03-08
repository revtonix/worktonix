'use client';

import RequireRole from '@/components/require-role';

export default function SettingsPage() {
  return (
    <RequireRole minRole="ADMIN">
      <h1 className="mb-1 text-2xl font-bold text-white">Settings</h1>
      <p className="mb-6 text-sm text-gray-400">System configuration and preferences.</p>
      <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center text-gray-500">
        Settings will load from the API.
      </div>
    </RequireRole>
  );
}
