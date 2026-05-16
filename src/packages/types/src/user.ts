import type { ISODateString, UUID } from './common.js';

export type RoleCode = 'student' | 'organizer' | 'staff' | 'admin';
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

export interface JwtResponse {
  user: User;
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
