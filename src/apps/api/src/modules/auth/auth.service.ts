import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import type { LoginClient, RoleCode, User } from '@unihub/types';
import { UsersRepository } from '../database/users.repository';

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
  ) {}

  private readonly sessions = new Map<string, string>();

  async loginJwt(
    email: string,
    password: string,
    client: LoginClient,
  ): Promise<IssuedJwt> {
    const user = await this.verifyLogin(email, password);
    this.assertLoginClientAllowed(client, user.role);
    return this.issueTokens(user);
  }

  async loginSession(
    email: string,
    password: string,
    client: LoginClient,
  ): Promise<IssuedSession> {
    const user = await this.verifyLogin(email, password);
    this.assertLoginClientAllowed(client, user.role);
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
    const userId = this.sessions.get(sessionId);
    if (!userId) return null;
    return this.users.findUserById(userId);
  }

  async me(authorizationHeader: string | undefined): Promise<User> {
    const token = this.parseBearer(authorizationHeader);
    if (!token) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
    const user = await this.users.findUserById(token);
    if (!user) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
    return user;
  }

  logout(authorizationHeader: string | undefined) {
    const token = this.parseBearer(authorizationHeader);

    if (token?.startsWith('session.')) {
      this.sessions.delete(token);
    }
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

  private assertLoginClientAllowed(client: LoginClient, role: RoleCode) {
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
      { expiresIn: '30d' },
    );

    const jwtPayload: AccessPayload = { sub: user.id, role: user.role };
    const accessToken = this.jwt.sign(jwtPayload);
    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  private issueSession(user: User): IssuedSession {
    const sessionId = `session.${randomBytes(16).toString('hex')}`;
    this.sessions.set(sessionId, user.id);

    return {
      user,
      sessionId,
    };
  }

  private parseBearer(header: string | undefined): string | null {
    if (!header) return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match?.[1] ?? null;
  }
}
