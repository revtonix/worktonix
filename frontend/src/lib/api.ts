import { getStoredToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getStoredToken();
  const { body, headers: extra, ...rest } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(data.message || data.error || `API error ${res.status}`);
  }

  return res.json();
}

export async function login(email: string, password: string) {
  return api<{ token: string; userId: string; name: string; role: string }>(
    '/api/auth/login',
    { method: 'POST', body: { email, password } },
  );
}
