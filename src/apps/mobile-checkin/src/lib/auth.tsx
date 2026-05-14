import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthTokens, User } from '@unihub/types';

const ACCESS_KEY = 'unihub.checkin.accessToken';
const REFRESH_KEY = 'unihub.checkin.refreshToken';
const USER_KEY = 'unihub.checkin.user';

export interface AuthState {
  user: User | null;
  isReady: boolean;
  isAuthenticated: boolean;
  setSession: (tokens: AuthTokens, user: User) => Promise<void>;
  clear: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(USER_KEY);
        if (raw) setUser(JSON.parse(raw) as User);
      } catch {
        // ignore corrupt session, user will log in again
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setSession = useCallback(
    async (tokens: AuthTokens, nextUser: User) => {
      await AsyncStorage.multiSet([
        [ACCESS_KEY, tokens.accessToken],
        [REFRESH_KEY, tokens.refreshToken],
        [USER_KEY, JSON.stringify(nextUser)],
      ]);
      setUser(nextUser);
    },
    [],
  );

  const clear = useCallback(async () => {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isReady,
      isAuthenticated: !!user,
      setSession,
      clear,
    }),
    [user, isReady, setSession, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const tokenStorage = {
  getAccessToken: () => AsyncStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => AsyncStorage.getItem(REFRESH_KEY),
  setTokens: async (tokens: { accessToken: string; refreshToken?: string }) => {
    await AsyncStorage.setItem(ACCESS_KEY, tokens.accessToken);
    if (tokens.refreshToken) {
      await AsyncStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    }
  },
  clear: async () => {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]);
  },
};
