'use client';

import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { hasMinimumRole } from '@/lib/auth';
import { api } from '@/lib/api';

/* ── US state list for the Location dropdown ──────────────────────── */
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
] as const;

const TASK_COUNT_OPTIONS = [100, 200, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];

/* ── Types ────────────────────────────────────────────────────────── */
interface StaffUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

interface FormErrors {
  name?: string;
  ownerId?: string;
  taskCount?: string;
  proxyHost?: string;
  proxyPort?: string;
  userAgents?: string;
}

/* ── Shared input class ───────────────────────────────────────────── */
const inputCls =
  'w-full rounded-lg border border-gray-700 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-brand disabled:opacity-50 [background-color:#0f0f1a]';
const labelCls = 'mb-1 block text-sm text-gray-400';
const sectionCls = 'mt-6 border-t border-gray-800 pt-5';

export default function NewWorkspacePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  /* ── Access guard ─────────────────────────────────────────────── */
  useEffect(() => {
    if (loading) return;
    if (!user || !hasMinimumRole(user.role, 'TECH')) {
      router.replace('/dashboard/workspaces');
    }
  }, [user, loading, router]);

  /* ── Staff dropdown state ─────────────────────────────────────── */
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<StaffUser[]>('/api/users?role=OPERATOR')
      .then((data) => { if (!cancelled) setStaff(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setStaffLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /* ── Form state ───────────────────────────────────────────────── */
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [proxyType, setProxyType] = useState<'HTTP' | 'HTTPS' | 'SOCKS5'>('HTTP');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [location, setLocation] = useState('');
  const [userAgents, setUserAgents] = useState<string[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── User Agent file upload handler ──────────────────────────── */
  function handleUaFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length === 0) {
        setErrors((prev) => ({ ...prev, userAgents: 'File contains no valid user agent lines' }));
        setUserAgents([]);
      } else {
        setErrors((prev) => { const { userAgents: _, ...rest } = prev; return rest; });
        setUserAgents(lines);
      }
    };
    reader.readAsText(file);
  }

  /* ── Validation ───────────────────────────────────────────────── */
  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!name.trim() || name.trim().length < 3) e.name = 'Name is required (min 3 characters)';
    if (!ownerId) e.ownerId = 'Please select a staff member';
    if (taskCount === null) e.taskCount = 'Please select a task count';
    if (!proxyHost.trim()) e.proxyHost = 'Proxy host is required';
    const port = Number(proxyPort);
    if (!proxyPort || !Number.isInteger(port) || port < 1 || port > 65535) {
      e.proxyPort = 'Port must be an integer between 1 and 65535';
    }
    if (userAgents.length === 0) e.userAgents = 'Please upload a user agent list (.txt file)';
    return e;
  }

  /* ── Submit ───────────────────────────────────────────────────── */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      await api('/api/workspaces', {
        method: 'POST',
        body: {
          name: name.trim(),
          ownerId,
          taskCount,
          config: {
            proxy: {
              type: proxyType,
              host: proxyHost.trim(),
              port: Number(proxyPort),
              username: proxyUsername.trim() || undefined,
              password: proxyPassword || undefined,
            },
            location: location || undefined,
            userAgents,
          },
        },
      });
      router.push('/dashboard/workspaces');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Guard render ─────────────────────────────────────────────── */
  if (loading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-white">Create Workspace</h1>
      <p className="mb-6 text-sm text-gray-400">
        Configure a new browser workspace with proxy and fingerprint settings.
      </p>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-800 bg-surface-card p-6 space-y-5"
      >
        {serverError && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{serverError}</div>
        )}

        {/* ── Workspace Name ──────────────────────────────────── */}
        <div>
          <label htmlFor="ws-name" className={labelCls}>Workspace Name</label>
          <input
            id="ws-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            placeholder="e.g. US-East Profile 1"
            className={inputCls}
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
        </div>

        {/* ── Assign to Staff ─────────────────────────────────── */}
        <div>
          <label htmlFor="ws-owner" className={labelCls}>Assign to Staff</label>
          <select
            id="ws-owner"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={submitting || staffLoading}
            className={inputCls}
          >
            <option value="">
              {staffLoading ? 'Loading staff...' : '— Select a staff member —'}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.email})
              </option>
            ))}
          </select>
          {errors.ownerId && <p className="mt-1 text-xs text-red-400">{errors.ownerId}</p>}
        </div>

        {/* ── Total Tasks ──────────────────────────────────────── */}
        <div>
          <label htmlFor="ws-tasks" className={labelCls}>Total Tasks</label>
          <select
            id="ws-tasks"
            value={taskCount ?? ''}
            onChange={(e) => setTaskCount(e.target.value ? Number(e.target.value) : null)}
            disabled={submitting}
            className={inputCls}
          >
            <option value="">— Select task count —</option>
            {TASK_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n.toLocaleString()}</option>
            ))}
          </select>
          {errors.taskCount && <p className="mt-1 text-xs text-red-400">{errors.taskCount}</p>}
        </div>

        {/* ── Proxy Settings ──────────────────────────────────── */}
        <div className={sectionCls}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Proxy Settings
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="proxy-type" className={labelCls}>Proxy Type</label>
              <select
                id="proxy-type"
                value={proxyType}
                onChange={(e) => setProxyType(e.target.value as 'HTTP' | 'HTTPS' | 'SOCKS5')}
                disabled={submitting}
                className={inputCls}
              >
                <option value="HTTP">HTTP</option>
                <option value="HTTPS">HTTPS</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </div>

            <div>
              <label htmlFor="proxy-host" className={labelCls}>Proxy Host</label>
              <input
                id="proxy-host"
                type="text"
                value={proxyHost}
                onChange={(e) => setProxyHost(e.target.value)}
                disabled={submitting}
                placeholder="192.168.1.1"
                className={inputCls}
              />
              {errors.proxyHost && <p className="mt-1 text-xs text-red-400">{errors.proxyHost}</p>}
            </div>

            <div>
              <label htmlFor="proxy-port" className={labelCls}>Proxy Port</label>
              <input
                id="proxy-port"
                type="number"
                min={1}
                max={65535}
                value={proxyPort}
                onChange={(e) => setProxyPort(e.target.value)}
                disabled={submitting}
                placeholder="8080"
                className={inputCls}
              />
              {errors.proxyPort && <p className="mt-1 text-xs text-red-400">{errors.proxyPort}</p>}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="proxy-user" className={labelCls}>Proxy Username</label>
              <input
                id="proxy-user"
                type="text"
                value={proxyUsername}
                onChange={(e) => setProxyUsername(e.target.value)}
                disabled={submitting}
                placeholder="(optional)"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="proxy-pass" className={labelCls}>Proxy Password</label>
              <input
                id="proxy-pass"
                type="password"
                value={proxyPassword}
                onChange={(e) => setProxyPassword(e.target.value)}
                disabled={submitting}
                placeholder="(optional)"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* ── Browser Settings ────────────────────────────────── */}
        <div className={sectionCls}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Browser Settings
          </h2>

          <div>
            <label htmlFor="ws-location" className={labelCls}>Location</label>
            <select
              id="ws-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={submitting}
              className={inputCls}
            >
              <option value="">— Select a state (optional) —</option>
              {US_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* ── User Agent List Upload ──────────────────────────── */}
          <div className="mt-4">
            <label className={labelCls}>User Agent List</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-brand hover:text-white disabled:opacity-50"
              >
                Upload .txt File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleUaFileChange}
                className="hidden"
              />
              {userAgents.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400">
                  ✓ {userAgents.length.toLocaleString()} user agents loaded
                </span>
              )}
            </div>
            {errors.userAgents && <p className="mt-1 text-xs text-red-400">{errors.userAgents}</p>}
          </div>
        </div>

        {/* ── Submit ───────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/workspaces')}
            disabled={submitting}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 transition hover:border-gray-500 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {submitting && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {submitting ? 'Creating...' : 'Create Workspace'}
          </button>
        </div>
      </form>
    </div>
  );
}
