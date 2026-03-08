'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { hasMinimumRole, type Role } from '@/lib/auth';

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

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

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
