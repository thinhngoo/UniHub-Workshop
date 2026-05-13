import type { ISODateString, UUID } from './common.js';

export type RoleCode = 'student' | 'organizer' | 'checkin_staff' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: UUID;
  studentCode: string | null;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: RoleCode[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}
