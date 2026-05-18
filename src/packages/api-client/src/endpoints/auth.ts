import type { AxiosInstance } from 'axios';
import type { JwtLoginResponse, LoginRequest, SessionLoginResponse } from '@unihub/types';

export const authApi = (http: AxiosInstance) => ({
  loginJwt: (body: LoginRequest) =>
    http.post<JwtLoginResponse>('/auth/login/jwt', body).then((r) => r.data),
  loginSession: (body: LoginRequest) =>
    http.post<SessionLoginResponse>('/auth/login/session', body).then((r) => r.data),
  logout: () => http.post<void>('/auth/logout').then((r) => r.data),
  meJwt: () => http.get<JwtLoginResponse>('/auth/me/jwt').then((r) => r.data),
  meSession: () => http.get<SessionLoginResponse>('/auth/me/session').then((r) => r.data),
});
