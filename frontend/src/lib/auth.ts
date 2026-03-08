export type Role = 'ADMIN' | 'TECH' | 'MANAGER' | 'OPERATOR' | 'STAFF';

/** JWT payload returned by the backend */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  displayName: string;
  iat?: number;
  exp?: number;
}

const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 4,
  TECH: 3,
  MANAGER: 2,
  OPERATOR: 1,
  STAFF: 1,
};

/** Check if a user role meets the minimum required level. */
export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? Infinity);
}

/** Decode JWT payload without cryptographic verification (backend verifies). */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

// --------------- LocalStorage helpers ---------------

const TOKEN_KEY = 'worktonix_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): JwtPayload | null {
  const token = getStoredToken();
  return token ? decodeToken(token) : null;
}

// --------------- Navigation items ---------------

export interface NavItem {
  label: string;
  href: string;
  /** Minimum role required to see this item. */
  minRole: Role;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview',   href: '/dashboard',            minRole: 'MANAGER' },
  { label: 'Workspaces', href: '/dashboard/workspaces',  minRole: 'MANAGER' },
  { label: 'Staff Management', href: '/dashboard/staff',  minRole: 'MANAGER' },
  { label: 'Billing',    href: '/dashboard/billing',     minRole: 'ADMIN' },
  { label: 'Settings',   href: '/dashboard/settings',    minRole: 'ADMIN' },
];

/** Return only the nav items visible to the given role. */
export function getNavItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => hasMinimumRole(role, item.minRole));
}

/** Roles that should use the Electron desktop app instead of the web dashboard. */
export function shouldUseElectron(role: Role): boolean {
  return role === 'STAFF' || role === 'OPERATOR';
}
