'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';
import { getNavItemsForRole, hasMinimumRole } from '@/lib/auth';

/* Simple SVG icons keyed by nav item label */
function NavIcon({ label }: { label: string }) {
  const cls = 'h-5 w-5 shrink-0';
  switch (label) {
    case 'Dashboard':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      );
    case 'Workspaces':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
        </svg>
      );
    case 'Staff Management':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      );
    case 'Secrets':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      );
    case 'Audit Logs':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    default:
      return <span className={cls} />;
  }
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const navItems = getNavItemsForRole(user.role);
  const canCreate = hasMinimumRole(user.role, 'TECH');

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-800 bg-surface-card">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          W
        </div>
        <span className="text-lg font-semibold text-white">WorkTonix</span>
      </div>

      {/* Nav links — filtered by role */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <div key={item.href} className="flex items-center gap-1">
              <Link
                href={item.href}
                className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-brand/15 text-brand'
                    : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                }`}
              >
                <NavIcon label={item.label} />
                {item.label}
              </Link>
              {item.label === 'Workspaces' && canCreate && (
                <Link
                  href="/dashboard/workspaces/new"
                  className="rounded-md p-1.5 text-gray-500 transition hover:bg-brand/15 hover:text-brand"
                  title="Create Workspace"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* User info + Sign out */}
      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/20 text-sm font-medium text-brand">
            {user.displayName?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
            <p className="truncate text-xs text-gray-500">{user.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 transition hover:border-red-500/50 hover:text-red-400"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
