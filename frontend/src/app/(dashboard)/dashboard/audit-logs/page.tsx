'use client';

import RequireRole from '@/components/require-role';

const SAMPLE_LOGS = [
  { id: '1', action: 'USER_LOGIN', user: 'admin@worktonix.io', detail: 'Logged in from 192.168.1.10', time: '2 minutes ago' },
  { id: '2', action: 'WORKSPACE_CREATED', user: 'tech@worktonix.io', detail: 'Created workspace "US-East Profile 1"', time: '15 minutes ago' },
  { id: '3', action: 'STAFF_ADDED', user: 'admin@worktonix.io', detail: 'Added operator@worktonix.io as OPERATOR', time: '1 hour ago' },
  { id: '4', action: 'SETTINGS_UPDATED', user: 'admin@worktonix.io', detail: 'Updated session timeout to 60 minutes', time: '2 hours ago' },
  { id: '5', action: 'USER_LOGIN', user: 'manager@worktonix.io', detail: 'Logged in from 10.0.0.5', time: '3 hours ago' },
  { id: '6', action: 'WORKSPACE_PAUSED', user: 'tech@worktonix.io', detail: 'Paused workspace "Test Profile"', time: '5 hours ago' },
];

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: 'bg-blue-500/15 text-blue-400',
  WORKSPACE_CREATED: 'bg-green-500/15 text-green-400',
  WORKSPACE_PAUSED: 'bg-amber-500/15 text-amber-400',
  STAFF_ADDED: 'bg-purple-500/15 text-purple-400',
  SETTINGS_UPDATED: 'bg-gray-500/15 text-gray-400',
};

export default function AuditLogsPage() {
  return (
    <RequireRole minRole="ADMIN">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-sm text-gray-400">Track all system activity and changes.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-800 bg-surface-card text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Detail</th>
              <th className="px-5 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-surface-card">
            {SAMPLE_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-surface-hover transition">
                <td className="px-5 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] ?? ACTION_COLORS.SETTINGS_UPDATED}`}>
                    {log.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-300">{log.user}</td>
                <td className="px-5 py-3 text-gray-400">{log.detail}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{log.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RequireRole>
  );
}
