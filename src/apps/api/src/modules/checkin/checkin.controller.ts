import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  CheckInBatchItem,
  CheckInBatchRequest,
  CheckInBatchResponse,
  User,
} from '@unihub/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CheckinService } from './checkin.service';

@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('staff', 'admin')
  async batch(
    @Body() body: CheckInBatchRequest,
    @CurrentUser() user: User,
  ): Promise<CheckInBatchResponse> {
    const items = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'Danh sách sự kiện rỗng.',
      });
    }

    const normalized: CheckInBatchItem[] = items.map((raw) => ({
      clientEventId: String(raw?.clientEventId ?? ''),
      qrToken: String(raw?.qrToken ?? ''),
      scannedAt: String(raw?.scannedAt ?? new Date().toISOString()),
    }));

    if (normalized.some((i) => !i.clientEventId || !i.qrToken)) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'Mỗi sự kiện phải có clientEventId và qrToken.',
      });
    }

    return await this.checkin.processBatch(user.id, normalized);
  }
}
