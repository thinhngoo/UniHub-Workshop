import { Controller, ForbiddenException, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminDashboardSummary, RoleCode } from '@unihub/types';
import { authorizationFromRequest } from '../auth/authorization-from-request';
import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';

const ALLOWED_ROLES: ReadonlySet<RoleCode> = new Set(['admin', 'organizer']);

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly admin: AdminService,
  ) {}

  @Get('dashboard')
  async getDashboard(@Req() req: Request): Promise<AdminDashboardSummary> {
    const user = await this.auth.me(authorizationFromRequest(req));
    if (!ALLOWED_ROLES.has(user.role)) {
      throw new ForbiddenException({
        code: 'forbidden',
        message: 'Bạn không có quyền truy cập trang quản trị.',
      });
    }
    return this.admin.getDashboard();
  }
}
