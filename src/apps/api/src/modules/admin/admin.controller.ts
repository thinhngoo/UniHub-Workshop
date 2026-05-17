import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminDashboardSummary } from '@unihub/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'organizer')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  async getDashboard(): Promise<AdminDashboardSummary> {
    return this.admin.getDashboard();
  }
}
