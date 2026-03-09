'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import RequireRole from '@/components/require-role';
import { hasMinimumRole } from '@/lib/auth';
import { api } from '@/lib/api';

interface AdsPowerProfile {
  user_id: string;
  serial_number: string;
  name: string;
}

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
  IDLE: 'bg-gray-500/15 text-gray-400',
  LAUNCHING: 'bg-blue-500/15 text-blue-400',
  RUNNING: 'bg-green-500/15 text-green-400',
  STOPPED: 'bg-amber-500/15 text-amber-400',
  ERROR: 'bg-red-500/15 text-red-400',
};

export default function WorkspacesPage() {
  const { user } = useAuth();
  const canCreate = user ? hasMinimumRole(user.role, 'TECH') : false;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [adsPowerProfiles, setAdsPowerProfiles] = useState<AdsPowerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [profileInput, setProfileInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchWorkspaces = useCallback(() => {
    api<Workspace[]>('/api/workspaces')
      .then((list) => setWorkspaces(Array.isArray(list) ? list : []))
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load workspaces'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWorkspaces();

    if (canCreate) {
      api<StaffUser[]>('/api/users?role=OPERATOR')
        .then((data) => setStaffList(data))
        .catch(() => {});

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bridge = typeof window !== 'undefined' ? (window as any).worktonix?.adspower : null;
      if (bridge?.listProfiles) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bridge.listProfiles().then((res: any) => {
          if (res?.code === 0 && Array.isArray(res.data?.list)) {
            setAdsPowerProfiles(res.data.list);
          }
        }).catch(() => {});
      }
    }
  }, [canCreate, fetchWorkspaces]);

  async function handleReassign(workspaceId: string, newOwnerId: string) {
    setReassigning(workspaceId);
    try {
      const updated = await api<Workspace>(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: { ownerId: newOwnerId },
      });
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === workspaceId ? { ...ws, ...updated } : ws)),
      );
    } catch { /* ignore */ }
    setReassigning(null);
  }

  async function handleSaveProfile(workspaceId: string) {
    setSavingProfile(true);
    try {
      const updated = await api<Workspace>(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: { profileId: profileInput.trim() },
      });
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === workspaceId ? { ...ws, ...updated } : ws)),
      );
      setEditingProfile(null);
    } catch { /* ignore */ }
    setSavingProfile(false);
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

                {/* ── Badges ─────────────────────────────────────── */}
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
                </div>

                {/* ── Profile ID (editable) ─────────────────────── */}
                {canCreate && (
                  <div className="mt-3">
                    {editingProfile === ws.id ? (
                      <div className="flex items-center gap-2">
                        {adsPowerProfiles.length > 0 ? (
                          <select
                            value={profileInput}
                            onChange={(e) => setProfileInput(e.target.value)}
                            disabled={savingProfile}
                            className="flex-1 rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 outline-none focus:border-brand [background-color:#0f0f1a]"
                          >
                            <option value="">— Select profile —</option>
                            {adsPowerProfiles.map((p) => (
                              <option key={p.user_id} value={p.serial_number}>
                                {p.name || p.serial_number} (#{p.serial_number})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={profileInput}
                            onChange={(e) => setProfileInput(e.target.value)}
                            disabled={savingProfile}
                            placeholder="e.g. k1a7qgw8"
                            className="flex-1 rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 outline-none focus:border-brand [background-color:#0f0f1a]"
                          />
                        )}
                        <button
                          onClick={() => handleSaveProfile(ws.id)}
                          disabled={savingProfile || !profileInput.trim()}
                          className="rounded bg-brand px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {savingProfile ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingProfile(null)}
                          disabled={savingProfile}
                          className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingProfile(ws.id); setProfileInput(ws.profileId || ''); }}
                        className="text-xs text-gray-400 hover:text-brand transition"
                      >
                        {ws.profileId
                          ? <>Profile: <span className="font-mono text-gray-300">{ws.profileId}</span> (edit)</>
                          : '+ Set AdsPower Profile'}
                      </button>
                    )}
                  </div>
                )}
                {!canCreate && ws.profileId && (
                  <p className="mt-3 font-mono text-xs text-gray-400">Profile: {ws.profileId}</p>
                )}

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
