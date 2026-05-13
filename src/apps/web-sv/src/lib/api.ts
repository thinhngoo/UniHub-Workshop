import {
  authApi,
  checkinApi,
  createApiClient,
  notificationsApi,
  paymentsApi,
  registrationsApi,
  workshopsApi,
} from '@unihub/api-client';
import { tokenStorage } from './auth';

const baseURL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export const http = createApiClient({
  baseURL,
  tokenStore: tokenStorage,
  onUnauthorized: () => {
    tokenStorage.clear();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  },
  refreshAccessToken: async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      tokenStorage.setTokens(data);
      return data.accessToken;
    } catch {
      return null;
    }
  },
});

export const api = {
  auth: authApi(http),
  workshops: workshopsApi(http),
  registrations: registrationsApi(http),
  payments: paymentsApi(http),
  checkin: checkinApi(http),
  notifications: notificationsApi(http),
};
