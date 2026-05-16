import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import type {
  PaginatedResponse,
  Workshop,
  WorkshopStatus,
} from '@unihub/types';
import { WORKSHOP_STATUSES } from '../../constant';
import { parsePositiveInt } from '../../utils/parse-positive-int';
import { WorkshopsService } from './workshops.service';

@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('isPaid') isPaid?: string,
  ): Promise<PaginatedResponse<Workshop>> {
    const statusFilter: WorkshopStatus | undefined =
      typeof status === 'string' &&
      (WORKSHOP_STATUSES as readonly string[]).includes(status)
        ? (status as WorkshopStatus)
        : undefined;

    let isPaidFilter: boolean | undefined;
    if (isPaid === 'true') isPaidFilter = true;
    else if (isPaid === 'false') isPaidFilter = false;

    return await this.workshops.findAll({
      page: parsePositiveInt(page, 1),
      pageSize: parsePositiveInt(pageSize, 20),
      search,
      status: statusFilter,
      isPaid: isPaidFilter,
    });
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<Workshop> {
    const workshop = await this.workshops.findById(id);
    if (!workshop) {
      throw new NotFoundException('Workshop không tồn tại.');
    }
    return workshop;
  }
}
