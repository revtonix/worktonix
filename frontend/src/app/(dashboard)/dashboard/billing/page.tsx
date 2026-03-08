'use client';

import RequireRole from '@/components/require-role';

export default function BillingPage() {
  return (
    <RequireRole minRole="ADMIN">
      <h1 className="mb-1 text-2xl font-bold text-white">Billing</h1>
      <p className="mb-6 text-sm text-gray-400">Manage subscription and view invoices.</p>
      <div className="rounded-xl border border-gray-800 bg-surface-card p-8 text-center text-gray-500">
        Billing information will load from the API.
      </div>
    </RequireRole>
  );
}
