'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import RequireRole from '@/components/require-role';
import { hasMinimumRole } from '@/lib/auth';
import { api } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  status: 'ACTIVE' | 'PAUSED';
  config: {
    proxy?: { type?: string; host?: string; port?: number };
    location?: string;
  };
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-400',
  PAUSED: 'bg-amber-500/15 text-amber-400',
};

export default function WorkspacesPage() {
  const { user } = useAuth();
  const canCreate = user ? hasMinimumRole(user.role, 'TECH') : false;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<Workspace[]>('/api/workspaces')
      .then((data) => { if (!cancelled) setWorkspaces(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <RequireRole minRole="MANAGER">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Workspaces</h1>
          <p className="text-sm text-gray-400">
            {canCreate ? 'Create, edit, and assign workspaces' : 'View your team\'s workspaces'}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/workspaces/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
          >
            + New Workspace
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center">
          <p className="text-gray-400">No workspaces yet.</p>
          {canCreate && (
            <Link
              href="/dashboard/workspaces/new"
              className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Create your first workspace
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="rounded-xl border border-gray-800 bg-surface-card p-5 transition hover:border-gray-700"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white">{ws.name}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ws.status] ?? STATUS_COLORS.ACTIVE}`}>
                  {ws.status}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                <p>Owner: <span className="text-gray-300">{ws.ownerName}</span></p>
                {ws.config?.proxy?.host && (
                  <p>Proxy: <span className="text-gray-300">{ws.config.proxy.type}://{ws.config.proxy.host}:{ws.config.proxy.port}</span></p>
                )}
                {ws.config?.location && (
                  <p>Location: <span className="text-gray-300">{ws.config.location}</span></p>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-600">
                Created {new Date(ws.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </RequireRole>
  );
}
