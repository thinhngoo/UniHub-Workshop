import type { AxiosInstance } from 'axios';
import type {
  JwtResponse,
  LoginRequest,
  SessionLoginResponse,
  User,
} from '@unihub/types';

export const authApi = (http: AxiosInstance) => ({
  loginJwt: (body: LoginRequest) =>
    http.post<JwtResponse>('/auth/login/jwt', body).then((r) => r.data),
  loginSession: (body: LoginRequest) =>
    http.post<SessionLoginResponse>('/auth/login/session', body).then((r) => r.data),
  logout: () => http.post<void>('/auth/logout').then((r) => r.data),
  meJwt: () => http.get<JwtResponse>('/auth/me/jwt').then((r) => r.data),
  meSession: () =>
    http.get<SessionLoginResponse>('/auth/me/session').then((r) => r.data),
  me: () => http.get<User>('/auth/me').then((r) => r.data),
  refresh: (refreshToken?: string) =>
    http
      .post<JwtResponse | SessionLoginResponse>(
        '/auth/refresh',
        refreshToken ? { refreshToken } : {},
      )
      .then((r) => r.data),
});
