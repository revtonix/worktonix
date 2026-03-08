'use client';

import RequireRole from '@/components/require-role';

export default function BillingPage() {
  return (
    <RequireRole minRole="ADMIN">
      <h1 className="mb-1 text-2xl font-bold text-white">Billing</h1>
      <p className="mb-6 text-sm text-gray-400">Manage subscription and view invoices.</p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-gray-800 bg-surface-card p-5">
          <p className="text-sm text-gray-500">Current Plan</p>
          <p className="mt-1 text-xl font-bold text-white">Pro</p>
          <p className="mt-1 text-sm text-brand">$49/mo</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-surface-card p-5">
          <p className="text-sm text-gray-500">Workspaces Used</p>
          <p className="mt-1 text-xl font-bold text-white">0 / 25</p>
          <p className="mt-1 text-sm text-gray-600">Unlimited on Enterprise</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-surface-card p-5">
          <p className="text-sm text-gray-500">Next Invoice</p>
          <p className="mt-1 text-xl font-bold text-white">Apr 1, 2026</p>
          <p className="mt-1 text-sm text-gray-600">Auto-renew enabled</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-surface-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Recent Invoices
        </h2>
        <div className="divide-y divide-gray-800 text-sm">
          {[
            { date: 'Mar 1, 2026', amount: '$49.00', status: 'Paid' },
            { date: 'Feb 1, 2026', amount: '$49.00', status: 'Paid' },
            { date: 'Jan 1, 2026', amount: '$49.00', status: 'Paid' },
          ].map((inv) => (
            <div key={inv.date} className="flex items-center justify-between py-3">
              <span className="text-gray-400">{inv.date}</span>
              <span className="text-white">{inv.amount}</span>
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs text-green-400">
                {inv.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </RequireRole>
  );
}
