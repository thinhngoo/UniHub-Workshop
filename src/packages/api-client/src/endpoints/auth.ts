import type { AxiosInstance } from 'axios';
import type { LoginRequest, LoginResponse, User } from '@unihub/types';

export const authApi = (http: AxiosInstance) => ({
  login: (body: LoginRequest) =>
    http.post<LoginResponse>('/auth/login', body).then((r) => r.data),
  logout: () => http.post<void>('/auth/logout').then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
  refresh: (refreshToken: string) =>
    http
      .post<{ accessToken: string; refreshToken: string; expiresIn: number }>('/auth/refresh', {
        refreshToken,
      })
      .then((r) => r.data),
});
