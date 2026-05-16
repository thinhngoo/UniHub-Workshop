import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RoleCode } from '@unihub/types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'unauthenticated',
        message: 'Phiên đăng nhập không hợp lệ.',
      });
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'Bạn không có quyền thực hiện thao tác này.',
      });
    }
    return true;
  }
}
