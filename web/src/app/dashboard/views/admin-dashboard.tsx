'use client';

import Link from 'next/link';

const CARDS = [
  { title: 'Workspaces', desc: 'Create, edit, and manage all workspaces', href: '/dashboard/workspaces', color: 'bg-blue-500/15 text-blue-400' },
  { title: 'Staff', desc: 'Manage staff accounts and assignments', href: '/dashboard/staff', color: 'bg-green-500/15 text-green-400' },
  { title: 'Billing', desc: 'View invoices and manage subscription', href: '/dashboard/billing', color: 'bg-amber-500/15 text-amber-400' },
  { title: 'Settings', desc: 'System configuration and preferences', href: '/dashboard/settings', color: 'bg-purple-500/15 text-purple-400' },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-white">Admin Dashboard</h1>
      <p className="mb-8 text-gray-400">Full system access — manage workspaces, staff, billing, and settings.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
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
