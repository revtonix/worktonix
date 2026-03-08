'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { login } from '@/lib/api';

export default function LoginPage() {
  const { loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Backend login accepts ALL roles — no role filtering
      const data = await login(email, password);
      // After login, AuthProvider decodes the JWT to get the role
      // and redirects accordingly (dashboard or /use-electron)
      loginWithToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface-card p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">WorkTonix</h1>
        <p className="mb-6 text-center text-sm text-gray-400">
          Sign in to the management dashboard
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-gray-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-surface px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-brand"
              placeholder="you@worktonix.io"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-gray-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-surface px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-brand"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
