'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { type Role, hasMinimumRole, shouldUseElectron } from '@/lib/auth';

interface Props {
  minRole: Role;
  children: React.ReactNode;
}

export default function RequireRole({ minRole, children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (shouldUseElectron(user.role)) router.replace('/use-electron');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  if (!hasMinimumRole(user.role, minRole)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-gray-500">
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
