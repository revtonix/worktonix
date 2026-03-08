import { getStoredToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  mode?: RequestMode;
  redirect?: RequestRedirect;
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
    body: body
      ? typeof body === 'string' ? body : JSON.stringify(body)
      : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(data.message || data.error || `API error ${res.status}`);
  }

  return res.json();
}

export async function login(email: string, password: string) {
  const data = await api<{
    token?: string;
    accessToken?: string;
    userId: string;
    name: string;
    role: string;
  }>('/api/auth/login', { method: 'POST', body: { email, password } });

  return {
    token: data.token || data.accessToken || '',
    userId: data.userId,
    name: data.name,
    role: data.role,
  };
}
