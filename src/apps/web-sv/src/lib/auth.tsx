import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { JwtLoginResponse, User } from '@unihub/types';
import { api } from './api';
import { clearAccessToken, setAccessToken } from './sessionMemory';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isReady: boolean;
  signIn: (res: JwtLoginResponse) => void;
  clear: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await api.auth.meJwt();
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setUserState(data.user);
        setIsAuthenticated(true);
      } catch {
        if (!cancelled) {
          setUserState(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((res: JwtLoginResponse) => {
    setAccessToken(res.accessToken);
    setUserState(res.user);
    setIsAuthenticated(true);
  }, []);

  const clear = useCallback(() => {
    clearAccessToken();
    setUserState(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated,
      isReady,
      signIn,
      clear,
    }),
    [user, isAuthenticated, isReady, signIn, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
