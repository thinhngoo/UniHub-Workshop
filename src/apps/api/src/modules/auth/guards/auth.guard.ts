import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@unihub/types';
import { extractAccessToken, extractSessionId } from '../extract-auth-data';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const bearer = extractAccessToken(req);
    try {
      let user: User;
      if (bearer) user = await this.auth.me(bearer, 'jwt');
      else user = await this.auth.me(extractSessionId(req), 'session');
      req.user = user;
      return true;
    } catch (err: unknown) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
  }
}
