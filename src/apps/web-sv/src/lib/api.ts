import {
  authApi,
  checkinApi,
  createApiClient,
  notificationsApi,
  paymentsApi,
  registrationsApi,
  workshopsApi,
} from '@unihub/api-client';
import { clearAccessToken, getAccessToken, setAccessToken } from './sessionMemory';

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

function logoutAndClearClientState(): void {
  void fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
    .catch(() => {
      /* network error */
    })
    .finally(() => {
      clearAccessToken();
    });
}

export const http = createApiClient({
  baseURL: API_BASE_URL,
  withCredentials: true,
  onUnauthorized: logoutAndClearClientState,
  refreshAccessToken: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('session_expired');
    const data = (await res.json()) as { accessToken?: string };
    if (!data.accessToken) throw new Error('session_expired');
    setAccessToken(data.accessToken);
  },
});

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

export const api = {
  auth: authApi(http),
  workshops: workshopsApi(http),
  registrations: registrationsApi(http),
  payments: paymentsApi(http),
  checkin: checkinApi(http),
  notifications: notificationsApi(http),
};
