import Constants from 'expo-constants';
import { authApi, checkinApi, createApiClient, workshopsApi } from '@unihub/api-client';
import { clearSessionId, loadSessionId } from './sessionStore';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');

  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? '';
  const host = hostUri.split(':')[0];
  if (host) return `http://${host}:3000`;

  return 'http://localhost:3000';
}

export const baseURL = resolveBaseUrl();

export const http = createApiClient({
  baseURL,
  onUnauthorized: clearSessionId,
  refreshAccessToken: async () => {
    await clearSessionId();
    throw new Error('session_expired');
  },
});

http.interceptors.request.use(async (config) => {
  const sessionId = await loadSessionId();
  if (sessionId) {
    config.headers.set('Authorization', sessionId);
  }
  return config;
});

export const api = {
  auth: authApi(http),
  workshops: workshopsApi(http),
  checkin: checkinApi(http),
};
