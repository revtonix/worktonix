'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/hooks/use-auth';
import RequireRole from '@/components/require-role';
import { hasMinimumRole, type Role } from '@/lib/auth';
import { api } from '@/lib/api';

interface StaffUser {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/15 text-red-400',
  TECH: 'bg-purple-500/15 text-purple-400',
  MANAGER: 'bg-blue-500/15 text-blue-400',
  OPERATOR: 'bg-green-500/15 text-green-400',
  STAFF: 'bg-gray-500/15 text-gray-400',
};

const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'TECH', 'MANAGER', 'OPERATOR'];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin — Full system access',
  TECH: 'Tech — Manage workspaces & staff',
  MANAGER: 'Manager — View team workspaces',
  OPERATOR: 'Operator — Desktop app user',
};

export default function StaffPage() {
  const { user } = useAuth();
  const canCreate = user ? hasMinimumRole(user.role, 'TECH') : false;

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<StaffUser[]>('/api/users')
      .then((data) => { if (!cancelled) setStaff(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleCreated(newUser: StaffUser) {
    setStaff((prev) => [...prev, newUser]);
    setShowModal(false);
  }

  return (
    <RequireRole minRole="MANAGER">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff</h1>
          <p className="text-sm text-gray-400">
            {canCreate ? 'Create staff accounts and assign workspaces' : 'View your assigned staff'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
          >
            + Add Staff
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center text-gray-500">
          No staff members found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 bg-surface-card text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-surface-card">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-surface-hover transition">
                  <td className="px-5 py-3 font-medium text-white">{s.displayName}</td>
                  <td className="px-5 py-3 text-gray-400">{s.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[s.role] ?? ROLE_COLORS.STAFF}`}>
                      {s.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddStaffModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </RequireRole>
  );
}

/* ── Add Staff Modal ─────────────────────────────────────────────── */

function AddStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (u: StaffUser) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setSubmitting(true);
    try {
      const created = await api<StaffUser>('/api/users', {
        method: 'POST',
        body: {
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          role,
        },
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-700 shadow-2xl"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <h2 className="text-lg font-bold text-white">Add Staff Member</h2>
          <p className="text-xs text-gray-500 mt-0.5">Create a new account with a temporary password</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Full Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              placeholder="Jane Doe"
              style={{ backgroundColor: '#0f0f1a', color: '#fff' }}
              className="w-full rounded-lg border border-gray-600 px-3 py-2.5 text-sm placeholder-gray-500 outline-none focus:border-brand transition disabled:opacity-50"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="jane@worktonix.io"
              style={{ backgroundColor: '#0f0f1a', color: '#fff' }}
              className="w-full rounded-lg border border-gray-600 px-3 py-2.5 text-sm placeholder-gray-500 outline-none focus:border-brand transition disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              placeholder="Min. 8 characters"
              style={{ backgroundColor: '#0f0f1a', color: '#fff' }}
              className="w-full rounded-lg border border-gray-600 px-3 py-2.5 text-sm placeholder-gray-500 outline-none focus:border-brand transition disabled:opacity-50"
            />
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={submitting}
              style={{ backgroundColor: '#0f0f1a', color: '#fff' }}
              className="w-full appearance-none rounded-lg border border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-brand transition disabled:opacity-50"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r} style={{ backgroundColor: '#1a1a2e' }}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 transition hover:border-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Add Staff'}
          </button>
        </div>
      </form>
    </div>
  );
}
