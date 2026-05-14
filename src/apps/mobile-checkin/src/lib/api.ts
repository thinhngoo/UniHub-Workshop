import Constants from 'expo-constants';
import {
  authApi,
  checkinApi,
  createApiClient,
  workshopsApi,
} from '@unihub/api-client';
import { tokenStorage } from './auth';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');

  const fromExtra =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:3000`;

  return 'http://localhost:3000';
}

export const baseURL = resolveBaseUrl();

export const http = createApiClient({
  baseURL,
  tokenStore: tokenStorage,
  onUnauthorized: () => {
    void tokenStorage.clear();
  },
  refreshAccessToken: async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await tokenStorage.setTokens(data);
      return data.accessToken;
    } catch {
      return null;
    }
  },
});

export const api = {
  auth: authApi(http),
  workshops: workshopsApi(http),
  checkin: checkinApi(http),
};
