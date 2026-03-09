'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import RequireRole from '@/components/require-role';
import { hasMinimumRole } from '@/lib/auth';
import { api } from '@/lib/api';

interface StaffUser {
  id: string;
  displayName: string;
  email: string;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  owner?: { id: string; displayName: string; email: string };
  status: string;
  taskCount?: number;
  profileId?: string;
  config: {
    proxy?: { type?: string; host?: string; port?: number };
    location?: string;
    userAgents?: string[];
  };
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-400',
  READY: 'bg-green-500/15 text-green-400',
  PAUSED: 'bg-amber-500/15 text-amber-400',
  PENDING: 'bg-amber-500/15 text-amber-400',
  LAUNCHING: 'bg-blue-500/15 text-blue-400',
  FAILED: 'bg-red-500/15 text-red-400',
};

export default function WorkspacesPage() {
  const { user } = useAuth();
  const canCreate = user ? hasMinimumRole(user.role, 'TECH') : false;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [reassigning, setReassigning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Workspace[] | { data: Workspace[] }>('/api/workspaces')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : [];
        setWorkspaces(list);
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load workspaces');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    if (canCreate) {
      api<StaffUser[]>('/api/users?role=OPERATOR')
        .then((data) => { if (!cancelled) setStaffList(data); })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [canCreate]);

  async function handleReassign(workspaceId: string, newOwnerId: string) {
    setReassigning(workspaceId);
    try {
      const updated = await api<Workspace>('/api/workspaces', {
        method: 'PUT',
        body: { id: workspaceId, ownerId: newOwnerId },
      });
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === workspaceId ? { ...ws, ...updated } : ws)),
      );
    } catch { /* ignore */ }
    setReassigning(null);
  }

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

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {fetchError}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : workspaces.length === 0 && !fetchError ? (
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
          {workspaces.map((ws) => {
            const uaCount = Array.isArray(ws.config?.userAgents) ? ws.config.userAgents.length : 0;
            return (
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
                  <p>Owner: <span className="text-gray-300">{ws.owner?.displayName ?? ws.ownerName}</span></p>
                  {canCreate && (
                    <div className="mt-1">
                      <select
                        value={ws.ownerId}
                        disabled={reassigning === ws.id}
                        onChange={(e) => handleReassign(ws.id, e.target.value)}
                        className="w-full rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 outline-none focus:border-brand [background-color:#0f0f1a]"
                      >
                        <option value={ws.ownerId}>
                          {ws.owner?.displayName ?? ws.ownerName} (current)
                        </option>
                        {staffList
                          .filter((s) => s.id !== ws.ownerId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.displayName} ({s.email})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {ws.config?.proxy?.host && (
                    <p>Proxy: <span className="text-gray-300">{ws.config.proxy.type}://{ws.config.proxy.host}:{ws.config.proxy.port}</span></p>
                  )}
                  {ws.config?.location && (
                    <p>Location: <span className="text-gray-300">{ws.config.location}</span></p>
                  )}
                </div>

                {/* ── New badges ──────────────────────────────────── */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {typeof ws.taskCount === 'number' && ws.taskCount > 0 && (
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-400">
                      Tasks: {ws.taskCount.toLocaleString()}
                    </span>
                  )}
                  {uaCount > 0 && (
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-400">
                      UA: {uaCount.toLocaleString()} agents
                    </span>
                  )}
                  {ws.profileId && (
                    <span className="rounded-full bg-gray-500/15 px-2 py-0.5 font-mono text-xs text-gray-400">
                      Profile: {ws.profileId}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs text-gray-600">
                  Created {new Date(ws.createdAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </RequireRole>
  );
}
