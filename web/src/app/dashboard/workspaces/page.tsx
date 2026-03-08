'use client';

import { useAuth } from '@/components/auth-provider';
import RequireRole from '@/components/require-role';
import { hasMinimumRole } from '@/lib/auth';

export default function WorkspacesPage() {
  const { user } = useAuth();
  const canCreate = user ? hasMinimumRole(user.role, 'TECH') : false;

  return (
    <RequireRole minRole="MANAGER">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Workspaces</h1>
            <p className="text-sm text-gray-400">
              {canCreate ? 'Create, edit, and assign workspaces' : 'View your team\'s workspaces'}
            </p>
          </div>
          {canCreate && (
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
              + New Workspace
            </button>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center text-gray-500">
          <p>Workspace list will load from the API.</p>
          <p className="mt-1 text-xs text-gray-600">
            Role: {user?.role} — {canCreate ? 'Full CRUD access' : 'Read-only access'}
          </p>
        </div>
      </div>
    </RequireRole>
  );
}
