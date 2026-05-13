import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  PaginatedResponse,
  Workshop,
  WorkshopStatus,
} from '@unihub/types';
import { parsePositiveInt } from '../utils/parse-positive-int';
import { WorkshopsService } from './workshops.service';

const WORKSHOP_STATUSES: readonly WorkshopStatus[] = [
  'draft',
  'published',
  'cancelled',
];

@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('isPaid') isPaid?: string,
  ): PaginatedResponse<Workshop> {
    const statusFilter: WorkshopStatus | undefined =
      typeof status === 'string' &&
      (WORKSHOP_STATUSES as readonly string[]).includes(status)
        ? (status as WorkshopStatus)
        : undefined;

    let isPaidFilter: boolean | undefined;
    if (isPaid === 'true') isPaidFilter = true;
    else if (isPaid === 'false') isPaidFilter = false;

    return this.workshops.findAll({
      page: parsePositiveInt(page, 1),
      pageSize: parsePositiveInt(pageSize, 20),
      search,
      status: statusFilter,
      isPaid: isPaidFilter,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string): Workshop {
    return this.workshops.findOne(id);
  }
}
