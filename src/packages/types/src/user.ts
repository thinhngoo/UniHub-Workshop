import type { ISODateString, UUID } from './common.js';

export type RoleCode = 'student' | 'organizer' | 'staff' | 'admin';
export type LoginClient = 'student' | 'organizer' | 'staff';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: UUID;
  studentCode: string | null;
  email: string;
  fullName: string;
  status: UserStatus;
  role: RoleCode;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SessionLoginResponse {
  user: User;
  sessionId?: string;
}

export interface JwtLoginResponse {
  user: User;
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  client: LoginClient;
}
