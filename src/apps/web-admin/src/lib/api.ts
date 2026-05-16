import {
  adminApi,
  authApi,
  createApiClient,
  notificationsApi,
  registrationsApi,
  workshopsApi,
} from '@unihub/api-client';

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

export const http = createApiClient({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const api = {
  auth: authApi(http),
  workshops: workshopsApi(http),
  registrations: registrationsApi(http),
  notifications: notificationsApi(http),
  admin: adminApi(http),
};
