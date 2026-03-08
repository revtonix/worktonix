'use client';

import { useAuth } from '@/components/auth-provider';
import AdminDashboard from './views/admin-dashboard';
import TechDashboard from './views/tech-dashboard';
import ManagerDashboard from './views/manager-dashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'TECH':
      return <TechDashboard />;
    case 'MANAGER':
      return <ManagerDashboard />;
    default:
      return null;
  }
}
