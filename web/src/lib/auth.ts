export type Role = 'ADMIN' | 'TECH' | 'MANAGER' | 'STAFF';

export interface UserPayload {
  id: string;
  email: string;
  role: Role;
  displayName: string;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 4,
  TECH: 3,
  MANAGER: 2,
  STAFF: 1,
};

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? Infinity);
}

/** Decode a JWT payload without verification (verification happens server-side). */
export function decodeToken(token: string): UserPayload | null {
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;
    const json = atob(base64Payload);
    return JSON.parse(json) as UserPayload;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('worktonix_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('worktonix_token', token);
}

export function clearStoredToken(): void {
  localStorage.removeItem('worktonix_token');
}

export function getUser(): UserPayload | null {
  const token = getStoredToken();
  if (!token) return null;
  return decodeToken(token);
}

/** Sidebar navigation items with role-based visibility. */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  minRole: Role;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: 'grid', minRole: 'MANAGER' },
  { label: 'Workspaces', href: '/dashboard/workspaces', icon: 'monitor', minRole: 'MANAGER' },
  { label: 'Staff', href: '/dashboard/staff', icon: 'users', minRole: 'MANAGER' },
  { label: 'Billing', href: '/dashboard/billing', icon: 'credit-card', minRole: 'ADMIN' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings', minRole: 'ADMIN' },
];

export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => hasMinimumRole(role, item.minRole));
}
