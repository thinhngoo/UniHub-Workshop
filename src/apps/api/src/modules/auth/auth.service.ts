import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import type { LoginClient, RoleCode, User } from '@unihub/types';
import {
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  SESSION_ID_RANDOM_BYTES,
} from '../../constant';
import { UsersRepository } from '../database/repository/users.repository';
import { SessionStore } from './session.store';

type IssuedJwt = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

type IssuedSession = {
  user: User;
  sessionId: string;
};

interface AccessPayload {
  sub: string;
  role: RoleCode;
}

interface RefreshPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly sessionStore: SessionStore,
  ) {}

  async jwtLogin(
    email: string,
    password: string,
    client: LoginClient,
  ): Promise<IssuedJwt> {
    const user = await this.verifyLogin(email, password);
    this.assertClientAllowed(client, user.role);
    return this.issueTokens(user);
  }

  async sessionLogin(
    email: string,
    password: string,
    client: LoginClient,
  ): Promise<IssuedSession> {
    const user = await this.verifyLogin(email, password);
    this.assertClientAllowed(client, user.role);
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<IssuedJwt | null> {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken);
    } catch {
      return null;
    }
    const user = await this.users.findUserById(payload.sub);
    if (!user) return null;
    return this.issueTokens(user);
  }

  async session(sessionId: string): Promise<User | null> {
    const userId = await this.sessionStore.getUserId(sessionId);
    if (!userId) return null;
    return this.users.findUserById(userId);
  }

  async me(data: string | undefined, type: 'jwt' | 'session'): Promise<User> {
    const trimmed = data?.trim();
    if (!trimmed) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }

    if (type === 'jwt') {
      let payload: AccessPayload;
      try {
        payload = this.jwt.verify<AccessPayload>(trimmed);
      } catch {
        throw new UnauthorizedException({
          code: 'unauthenticated',
          message: 'Phiên đăng nhập không hợp lệ.',
        });
      }

      const user = await this.users.findUserById(payload.sub);
      if (!user) {
        throw new UnauthorizedException({
          code: 'unauthenticated',
          message: 'Phiên đăng nhập không hợp lệ.',
        });
      }
      return user;
    }

    const userId = await this.sessionStore.getUserId(trimmed);
    if (!userId) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
    const user = await this.users.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
    return user;
  }

  async logout(sessionId: string | null): Promise<void> {
    if (!sessionId) return;
    await this.sessionStore.delete(sessionId);
  }

  private async verifyLogin(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await this.users.findWithPasswordByEmail(normalizedEmail);

    if (!account || account.password !== password) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Email hoặc mật khẩu không đúng.',
      });
    }

    if (account.user.status !== 'active') {
      throw new UnauthorizedException({
        code: 'account_disabled',
        message: 'Tài khoản đã bị khoá.',
      });
    }

    return account.user;
  }

  private assertClientAllowed(client: LoginClient, role: RoleCode) {
    if (role === 'admin') return;
    if (client === 'student') return;

    const allowed =
      (client === 'organizer' && role === 'organizer') ||
      (client === 'staff' && role === 'staff');

    if (!allowed) {
      throw new ForbiddenException({
        code: 'client_forbidden',
        message: 'Bạn không có quyền đăng nhập.',
      });
    }
  }

  private issueTokens(user: User): IssuedJwt {
    const refreshToken = this.jwt.sign(
      {
        sub: user.id,
      },
      { expiresIn: JWT_REFRESH_EXPIRES_IN },
    );

    const jwtPayload: AccessPayload = { sub: user.id, role: user.role };
    const accessToken = this.jwt.sign(jwtPayload, {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
    });
    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  private async issueSession(user: User): Promise<IssuedSession> {
    const sessionId = randomBytes(SESSION_ID_RANDOM_BYTES).toString('hex');
    await this.sessionStore.set(sessionId, user.id);

    return {
      user,
      sessionId,
    };
  }
}
