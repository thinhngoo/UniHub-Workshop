import { Controller, Get, UseGuards } from '@nestjs/common';
import type { NotificationMessage, User } from '@unihub/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles('student')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  async listMine(@CurrentUser() user: User): Promise<NotificationMessage[]> {
    return this.notifications.listForUser(user.id);
  }
}
