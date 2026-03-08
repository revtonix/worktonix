'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  type UserPayload,
  getUser,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
} from '@/lib/auth';

interface AuthContextValue {
  user: UserPayload | null;
  token: string | null;
  loading: boolean;
  loginWithToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  loginWithToken: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      const decoded = getUser();
      if (decoded) {
        setToken(stored);
        setUser(decoded);
      } else {
        clearStoredToken();
      }
    }
    setLoading(false);
  }, []);

  const loginWithToken = useCallback(
    (newToken: string) => {
      setStoredToken(newToken);
      setToken(newToken);
      const decoded = getUser();
      setUser(decoded);

      // Route based on role
      if (decoded?.role === 'STAFF') {
        router.push('/use-electron');
      } else {
        router.push('/dashboard');
      }
    },
    [router],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
