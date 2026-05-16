import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type {
  PaginatedResponse,
  Workshop,
  WorkshopStatus,
} from '@unihub/types';
import { WORKSHOP_STATUSES } from '../../constant';
import { parsePositiveInt } from '../../utils/parse-positive-int';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { WorkshopsService } from './workshops.service';

const workshopMutationValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: unknown) => {
    const messages = (
      errors as { constraints?: Record<string, string> }[]
    ).flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
    return new BadRequestException({
      code: 'invalid_request',
      message: messages[0] ?? 'Yêu cầu không hợp lệ.',
    });
  },
});

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @UsePipes(workshopMutationValidationPipe)
  async create(@Body() body: CreateWorkshopDto): Promise<Workshop> {
    return this.workshops.createWorkshop(body);
  }

  @Post(':id/reserve-seat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('student')
  async reserveSeat(@Param('id') id: string): Promise<{ reserved: true }> {
    await this.workshops.reserveSeat(id);
    return { reserved: true };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  @UsePipes(workshopMutationValidationPipe)
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWorkshopDto,
  ): Promise<Workshop> {
    return this.workshops.updateWorkshop(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  async remove(@Param('id') id: string): Promise<void> {
    await this.workshops.deleteWorkshop(id);
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
