import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthTokens, RoleCode, User } from '@unihub/types';

const ACCESS_KEY = 'unihub-admin.accessToken';
const REFRESH_KEY = 'unihub-admin.refreshToken';
const USER_KEY = 'unihub-admin.user';

const ALLOWED_ROLES: RoleCode[] = ['organizer', 'admin'];

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hasAdminAccess: boolean;
  setSession: (tokens: AuthTokens, user: User) => void;
  clear: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  const setSession = useCallback((tokens: AuthTokens, nextUser: User) => {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    setUserState(nextUser);
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setUserState(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: !!user,
      hasAdminAccess: !!user && user.roles.some((r) => ALLOWED_ROLES.includes(r)),
      setSession,
      clear,
    }),
    [user, setSession, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (tokens: { accessToken: string; refreshToken?: string }) => {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
