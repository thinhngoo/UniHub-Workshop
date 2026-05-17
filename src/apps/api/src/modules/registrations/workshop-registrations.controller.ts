import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import type { Registration } from '@unihub/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RegistrationsService } from './registrations.service';
import { WorkshopsService } from '../workshops/workshops.service';

/**
 * Routes under `/workshops` that belong to the registrations bounded context.
 * Kept here so `WorkshopsModule` does not import `RegistrationsModule` (cycle).
 */
@Controller('workshops')
@UseGuards(AuthGuard, RolesGuard)
export class WorkshopRegistrationsController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly workshops: WorkshopsService,
  ) {}

  @Get(':id/registrations')
  @Roles('admin', 'organizer')
  async listByWorkshop(
    @Param('id') workshopId: string,
  ): Promise<Registration[]> {
    const workshop = await this.workshops.findById(workshopId);
    if (!workshop) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Workshop không tồn tại.',
      });
    }
    return this.registrations.listForWorkshop(workshopId);
  }
}
