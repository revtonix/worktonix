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

const ASSIGNABLE_ROLES: Role[] = ['MANAGER', 'OPERATOR', 'STAFF'];

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-surface px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-brand disabled:opacity-50';

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
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
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

function AddStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (u: StaffUser) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!displayName.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api<StaffUser>('/api/users', {
        method: 'POST',
        body: { displayName: displayName.trim(), email: email.trim(), role },
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-surface-card p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-white">Add Staff Member</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-400">Full Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              placeholder="Jane Doe"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="jane@worktonix.io"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-400">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={submitting}
              className={inputCls}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
