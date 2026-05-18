import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { RoleCode, SessionLoginResponse, User } from '@unihub/types';
import { api } from './api';

const ALLOWED_ROLES: RoleCode[] = ['organizer', 'admin'];

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isReady: boolean;
  hasAdminAccess: boolean;
  signIn: (res: SessionLoginResponse) => void;
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
        const data = await api.auth.meSession();
        if (cancelled) return;
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

  const signIn = useCallback((res: SessionLoginResponse) => {
    setUserState(res.user);
    setIsAuthenticated(true);
  }, []);

  const clear = useCallback(() => {
    setUserState(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated,
      isReady,
      hasAdminAccess: !!user && ALLOWED_ROLES.includes(user.role),
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
