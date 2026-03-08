'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function UseElectronPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="rounded-xl bg-surface-card p-10 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/15">
            <svg className="h-10 w-10 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
            </svg>
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-white">Use the Desktop App</h1>
        <p className="mb-6 max-w-sm text-gray-400">
          Your account role (<span className="font-medium text-brand">{user.role}</span>) requires the
          WorkTonix Electron desktop application to access workspaces.
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Download and install the WorkTonix desktop app, then sign in with your credentials.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="#"
            className="inline-block rounded-lg bg-brand px-6 py-2.5 font-medium text-white transition hover:bg-brand-dark"
          >
            Download Desktop App
          </a>
          <button
            onClick={logout}
            className="text-sm text-gray-500 transition hover:text-gray-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
