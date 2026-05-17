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
import { InjectQueue } from '@nestjs/bullmq';
import type {
  PaginatedResponse,
  Workshop,
  WorkshopStatus,
  WorkshopSummaryJobState,
  WorkshopSummaryJobStatusResponse,
  WorkshopSummaryQueuedResponse,
} from '@unihub/types';
import type { Queue } from 'bullmq';
import { WORKSHOP_SUMMARY_QUEUE, WORKSHOP_STATUSES } from '../../constant';
import type { WorkshopSummaryJobPayload } from './workshop-summary';
import type { WorkshopSummaryJobDone } from './workshop-summary.service';
import { parsePositiveInt } from '../../utils/parse-positive-int';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { WorkshopSummaryService } from './workshop-summary.service';
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

function mapSummaryJobStateForResponse(raw: string): WorkshopSummaryJobState {
  switch (raw) {
    case 'waiting':
    case 'active':
    case 'completed':
    case 'failed':
    case 'delayed':
    case 'paused':
      return raw;
    default:
      return 'unknown';
  }
}

/** BullMQ job fields used by the status endpoint (`InjectQueue` loses generics). */
interface WorkshopSummaryJobLike {
  id?: string;
  data: WorkshopSummaryJobPayload;
  returnvalue: WorkshopSummaryJobDone | undefined;
  failedReason: string;
  getState(): Promise<string>;
}

@Controller('workshops')
export class WorkshopsController {
  constructor(
    private readonly workshops: WorkshopsService,
    private readonly workshopSummary: WorkshopSummaryService,
    @InjectQueue(WORKSHOP_SUMMARY_QUEUE)
    private readonly summaryJobQueue: Queue<
      WorkshopSummaryJobPayload,
      WorkshopSummaryJobDone
    >,
  ) {}

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

  @Post(':id/summary')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  async triggerSummary(
    @Param('id') id: string,
  ): Promise<WorkshopSummaryQueuedResponse> {
    return await this.workshopSummary.enqueuePdfSummary(id);
  }

  @Get('summary-jobs/:jobId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'organizer')
  async getSummaryJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<WorkshopSummaryJobStatusResponse> {
    const fetched = await this.summaryJobQueue.getJob(
      decodeURIComponent(jobId),
    );
    if (!fetched) {
      throw new NotFoundException({
        code: 'job_not_found',
        message:
          'Không tìm thấy job giới thiệu hoặc bản ghi đã bị xóa khỏi Redis.',
      });
    }
    const job = fetched as unknown as WorkshopSummaryJobLike;
    const rawState = await job.getState();
    const state = mapSummaryJobStateForResponse(rawState);

    const workshopId = job.data.workshopId;

    if (rawState === 'completed') {
      const ret = job.returnvalue;
      return {
        jobId: String(job.id),
        state,
        workshopId: ret?.workshopId ?? workshopId,
        outcome: ret?.outcome,
      };
    }
    if (rawState === 'failed') {
      return {
        jobId: String(job.id),
        state,
        workshopId,
        outcome: 'failed',
        failedReason:
          job.failedReason.trim() === '' ? undefined : job.failedReason,
      };
    }
    return { jobId: String(job.id), state, workshopId };
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
