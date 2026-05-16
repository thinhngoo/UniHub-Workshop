import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { SessionLoginResponse, User } from '@unihub/types';
import { api } from './api';
import { clearSessionId, loadSessionId, persistSessionId } from './sessionStore';

export interface AuthState {
  user: User | null;
  isReady: boolean;
  isAuthenticated: boolean;
  signIn: (res: SessionLoginResponse) => Promise<void>;
  clear: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sessionId = await loadSessionId();
        if (!sessionId) return;
        const data = await api.auth.meSession();
        if (cancelled) return;
        setUser(data.user);
      } catch {
        await clearSessionId();
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (res: SessionLoginResponse) => {
    if (!res.sessionId) {
      throw new Error('Phản hồi không hợp lệ.');
    }
    await persistSessionId(res.sessionId);
    setUser(res.user);
  }, []);

  const clear = useCallback(async () => {
    void api.auth.logout().catch(() => {
      // Ignore server errors on logout; always clear local state.
    });
    await clearSessionId();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isReady,
      isAuthenticated: !!user,
      signIn,
      clear,
    }),
    [user, isReady, signIn, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
