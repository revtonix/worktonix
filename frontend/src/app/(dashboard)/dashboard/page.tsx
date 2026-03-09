'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { hasMinimumRole, type Role } from '@/lib/auth';
import { api } from '@/lib/api';

/* ── Shared types ────────────────────────────────────────────────── */
interface StaffTaskAssignment {
  userId: string;
  taskCount: number;
  uaStart: number;
  uaEnd: number;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  status: string;
  taskCount: number;
  profileId?: string;
  assignments?: StaffTaskAssignment[];
  config: Record<string, unknown>;
  createdAt: string;
}

interface OperatorUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

/* ── Admin / Tech cards ──────────────────────────────────────────── */
interface Card {
  title: string;
  desc: string;
  href: string;
  color: string;
  minRole: Role;
}

const ALL_CARDS: Card[] = [
  { title: 'Workspaces', desc: 'Manage workspaces', href: '/dashboard/workspaces', color: 'bg-blue-500/15 text-blue-400', minRole: 'MANAGER' },
  { title: 'Staff', desc: 'Manage staff accounts', href: '/dashboard/staff', color: 'bg-green-500/15 text-green-400', minRole: 'MANAGER' },
  { title: 'Billing', desc: 'Subscription & invoices', href: '/dashboard/billing', color: 'bg-amber-500/15 text-amber-400', minRole: 'ADMIN' },
  { title: 'Settings', desc: 'System configuration', href: '/dashboard/settings', color: 'bg-purple-500/15 text-purple-400', minRole: 'ADMIN' },
];

const ROLE_LABELS: Record<string, { title: string; subtitle: string }> = {
  ADMIN:   { title: 'Admin Dashboard',   subtitle: 'Full system access — workspaces, staff, billing, and settings.' },
  TECH:    { title: 'Tech Dashboard',     subtitle: 'Manage workspaces and staff assignments.' },
  MANAGER: { title: 'Manager Dashboard',  subtitle: 'View your team\'s workspaces and staff.' },
};

/* ── Status badge color map ──────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  IDLE: 'bg-gray-500/15 text-gray-400',
  LAUNCHING: 'bg-blue-500/15 text-blue-400',
  RUNNING: 'bg-green-500/15 text-green-400',
  STOPPED: 'bg-amber-500/15 text-amber-400',
  ERROR: 'bg-red-500/15 text-red-400',
};

/* ══════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'MANAGER') {
    return <ManagerDashboard userId={user.sub} />;
  }

  if (user.role === 'OPERATOR' || user.role === 'STAFF') {
    return <OperatorDashboard userId={user.sub} />;
  }

  // Admin / Tech view
  const cards = ALL_CARDS.filter((c) => hasMinimumRole(user.role, c.minRole));
  const labels = ROLE_LABELS[user.role] ?? { title: 'Dashboard', subtitle: '' };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">{labels.title}</h1>
      <p className="mb-8 text-gray-400">{labels.subtitle}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-gray-800 bg-surface-card p-5 transition hover:border-gray-700"
          >
            <div className={`mb-3 inline-flex rounded-lg p-2.5 ${card.color}`}>
              <span className="text-lg font-bold">{card.title.charAt(0)}</span>
            </div>
            <h3 className="mb-1 font-semibold text-white group-hover:text-brand">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/*  Manager Dashboard                                                */
/* ══════════════════════════════════════════════════════════════════ */

function ManagerDashboard({ userId }: { userId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchWorkspaces = useCallback(() => {
    setLoading(true);
    api<Workspace[]>(`/api/workspaces?ownerId=${userId}`)
      .then((list) => setWorkspaces(Array.isArray(list) ? list : []))
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load workspaces'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Manager Dashboard</h1>
      <p className="mb-8 text-gray-400">View your assigned workspaces and distribute tasks to operators.</p>

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
        <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center text-gray-400">
          No workspaces assigned to you yet.
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} onUpdated={fetchWorkspaces} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Workspace Card with Distribute Tasks panel ──────────────────── */

function WorkspaceCard({ workspace: ws, onUpdated }: { workspace: Workspace; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const distributed = (ws.assignments ?? []).reduce((sum, a) => sum + a.taskCount, 0);
  const remaining = ws.taskCount - distributed;

  return (
    <div className="rounded-xl border border-gray-800 bg-surface-card transition hover:border-gray-700">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">{ws.name}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ws.status] ?? 'bg-gray-500/15 text-gray-400'}`}>
            {ws.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            Total Tasks: {ws.taskCount.toLocaleString()}
          </span>
          <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
            Distributed: {distributed.toLocaleString()}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${remaining === 0 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
            Remaining: {remaining.toLocaleString()}
          </span>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-brand hover:text-white"
        >
          {expanded ? 'Close' : 'Distribute Tasks'}
        </button>
      </div>

      {expanded && (
        <DistributePanel workspace={ws} onUpdated={() => { setExpanded(false); onUpdated(); }} />
      )}
    </div>
  );
}

/* ── Distribute Tasks Panel ──────────────────────────────────────── */

interface OperatorAssignment {
  userId: string;
  displayName: string;
  email: string;
  tasks: number;
}

function DistributePanel({ workspace, onUpdated }: { workspace: Workspace; onUpdated: () => void }) {
  const [operators, setOperators] = useState<OperatorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<OperatorUser[]>('/api/users?role=OPERATOR')
      .then((data) => {
        if (cancelled) return;
        setOperators(data.map((u) => {
          const existing = (workspace.assignments ?? []).find((a) => a.userId === u.id);
          return {
            userId: u.id,
            displayName: u.displayName,
            email: u.email,
            tasks: existing?.taskCount ?? 0,
          };
        }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspace.assignments]);

  const totalAssigned = operators.reduce((s, o) => s + o.tasks, 0);
  const overBudget = totalAssigned > workspace.taskCount;
  const exactMatch = totalAssigned === workspace.taskCount;

  function setOperatorTasks(userId: string, value: number) {
    setOperators((prev) => prev.map((o) => o.userId === userId ? { ...o, tasks: value } : o));
  }

  async function handleConfirm() {
    setError('');
    setSubmitting(true);

    // Calculate UA index ranges in serial order
    const assignments: StaffTaskAssignment[] = [];
    let offset = 0;
    for (const op of operators) {
      if (op.tasks > 0) {
        assignments.push({
          userId: op.userId,
          taskCount: op.tasks,
          uaStart: offset,
          uaEnd: offset + op.tasks - 1,
        });
        offset += op.tasks;
      }
    }

    try {
      await api(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        body: {
          config: { ...workspace.config, staffTaskAssignments: assignments },
        },
      });
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save distribution');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="border-t border-gray-800 p-5">
        <div className="flex h-20 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-800 p-5">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {operators.length === 0 ? (
        <p className="text-sm text-gray-500">No operators found. Add operators in Staff Management first.</p>
      ) : (
        <>
          <table className="w-full text-left text-sm mb-4">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Staff Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2 text-right">Tasks to Assign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {operators.map((op) => (
                <tr key={op.userId}>
                  <td className="py-2 text-white">{op.displayName}</td>
                  <td className="py-2 text-gray-400">{op.email}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={workspace.taskCount}
                      value={op.tasks}
                      onChange={(e) => setOperatorTasks(op.userId, Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={submitting}
                      className="w-24 rounded border border-gray-700 px-2 py-1 text-right text-white outline-none focus:border-brand disabled:opacity-50 [background-color:#0f0f1a]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${overBudget ? 'text-red-400' : exactMatch ? 'text-green-400' : 'text-gray-400'}`}>
              {totalAssigned.toLocaleString()} / {workspace.taskCount.toLocaleString()} tasks assigned
            </span>
            <button
              onClick={handleConfirm}
              disabled={submitting || overBudget}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Confirm Distribution'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/*  Operator / Staff Dashboard                                       */
/* ══════════════════════════════════════════════════════════════════ */

/* eslint-disable @typescript-eslint/no-explicit-any */
function getAdsPowerBridge(): { start: (id: string) => Promise<any>; stop: (id: string) => Promise<any> } | null {
  if (typeof window === 'undefined') return null;
  return (window as any).worktonix?.adspower ?? null;
}

async function adsPowerStart(profileId: string): Promise<{ debugPort: string; webdriver: string }> {
  const bridge = getAdsPowerBridge();
  let body: any;

  if (bridge) {
    body = await bridge.start(profileId);
  } else {
    const res = await fetch(`http://local.adspower.net:50325/api/v1/browser/start?user_id=${encodeURIComponent(profileId)}`);
    body = await res.json();
  }

  if (body.code !== 0) throw new Error(body.msg || 'AdsPower failed to start browser');
  return { debugPort: body.data?.debug_port ?? '', webdriver: body.data?.webdriver ?? '' };
}

async function adsPowerStop(profileId: string): Promise<void> {
  const bridge = getAdsPowerBridge();
  let body: any;

  if (bridge) {
    body = await bridge.stop(profileId);
  } else {
    const res = await fetch(`http://local.adspower.net:50325/api/v1/browser/stop?user_id=${encodeURIComponent(profileId)}`);
    body = await res.json();
  }

  if (body.code !== 0) throw new Error(body.msg || 'AdsPower failed to stop browser');
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function OperatorDashboard({ userId }: { userId: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [launching, setLaunching] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState('');

  const fetchWorkspaces = useCallback(() => {
    setLoading(true);
    api<Workspace[]>(`/api/workspaces?ownerId=${userId}`)
      .then((list) => setWorkspaces(Array.isArray(list) ? list : []))
      .catch((err) => setFetchError(err instanceof Error ? err.message : 'Failed to load workspaces'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  async function updateBackendStatus(workspaceId: string, status: string, debugPort?: string) {
    try {
      await api(`/api/workspaces/${workspaceId}/status`, {
        method: 'PATCH',
        body: { status, ...(debugPort && { debugPort }) },
      });
    } catch { /* best-effort status sync */ }
  }

  async function handleLaunch(ws: Workspace) {
    if (!ws.profileId) {
      setLaunchError('No profile ID configured for this workspace. Ask your admin to set one.');
      return;
    }
    setLaunching(ws.id);
    setLaunchError('');

    await updateBackendStatus(ws.id, 'LAUNCHING');

    try {
      const result = await adsPowerStart(ws.profileId);
      await updateBackendStatus(ws.id, 'RUNNING', result.debugPort);
      fetchWorkspaces();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to launch';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setLaunchError('Cannot reach AdsPower. Make sure the AdsPower desktop app is running on this computer.');
      } else {
        setLaunchError(msg);
      }
      await updateBackendStatus(ws.id, 'ERROR');
      fetchWorkspaces();
    } finally {
      setLaunching(null);
    }
  }

  async function handleStop(ws: Workspace) {
    if (!ws.profileId) return;
    setLaunching(ws.id);
    setLaunchError('');

    try {
      await adsPowerStop(ws.profileId);
      await updateBackendStatus(ws.id, 'STOPPED');
      fetchWorkspaces();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to stop';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setLaunchError('Cannot reach AdsPower. Make sure the AdsPower desktop app is running.');
      } else {
        setLaunchError(msg);
      }
      fetchWorkspaces();
    } finally {
      setLaunching(null);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">My Workspaces</h1>
      <p className="mb-8 text-gray-400">Your assigned workspaces and browser profiles.</p>

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {fetchError}
        </div>
      )}

      {launchError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {launchError}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : workspaces.length === 0 && !fetchError ? (
        <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center text-gray-400">
          No workspaces assigned to you yet. Please contact your manager.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const proxy = (ws.config as Record<string, any>)?.proxy;
            const location = (ws.config as Record<string, any>)?.location;
            const isActive = ws.status === 'RUNNING';
            const isLaunching = launching === ws.id;
            return (
              <div
                key={ws.id}
                className="rounded-xl border border-gray-800 bg-surface-card p-5 transition hover:border-gray-700"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-white">{ws.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ws.status] ?? 'bg-gray-500/15 text-gray-400'}`}>
                    {ws.status}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-400">
                  {proxy?.host && (
                    <p>Proxy: <span className="text-gray-300">{proxy.type}://{proxy.host}:{proxy.port}</span></p>
                  )}
                  {location && (
                    <p>Location: <span className="text-gray-300">{location}</span></p>
                  )}
                  {typeof ws.taskCount === 'number' && ws.taskCount > 0 && (
                    <p>Tasks: <span className="text-gray-300">{ws.taskCount.toLocaleString()}</span></p>
                  )}
                  {ws.profileId && (
                    <p>Profile: <span className="font-mono text-gray-300">{ws.profileId}</span></p>
                  )}
                </div>

                <div className="mt-4">
                  {isActive ? (
                    <button
                      disabled={isLaunching}
                      className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                      onClick={() => handleStop(ws)}
                    >
                      {isLaunching ? 'Stopping...' : 'Stop Workspace'}
                    </button>
                  ) : (
                    <button
                      disabled={isLaunching || !ws.profileId}
                      className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
                      onClick={() => handleLaunch(ws)}
                    >
                      {isLaunching ? 'Launching...' : ws.profileId ? 'Launch Workspace' : 'No Profile Set'}
                    </button>
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
    </div>
  );
}
