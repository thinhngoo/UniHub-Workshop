import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import type {
  StudentSyncJobStatusResponse,
  StudentSyncQueuedResponse,
  StudentSyncReport,
} from '@unihub/types';
import { Queue } from 'bullmq';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  STUDENT_SYNC_JOB_NAME,
  STUDENT_SYNC_MAX_FILE_BYTES,
  STUDENT_SYNC_QUEUE,
} from '../../constant';
import { THROTTLE_STUDENT_SYNC_UPLOAD } from '../../throttle-presets';
import type { StudentSyncJobPayload } from './student-sync';

/** Fields used from Multer's uploaded file (memory storage). */
interface UploadedCsvFile {
  buffer: Buffer;
  originalname?: string;
}

function mapJobStateForResponse(
  raw: string,
): StudentSyncJobStatusResponse['state'] {
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

@Controller('student-sync')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class StudentSyncController {
  constructor(
    @InjectQueue(STUDENT_SYNC_QUEUE)
    private readonly studentSyncQueue: Queue,
  ) {}

  @Post()
  @Throttle(THROTTLE_STUDENT_SYNC_UPLOAD)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: STUDENT_SYNC_MAX_FILE_BYTES },
    }),
  )
  async enqueueSync(
    @UploadedFile() file: UploadedCsvFile | undefined,
  ): Promise<StudentSyncQueuedResponse> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'csv_required',
        message: 'Vui lòng gửi tệp CSV (field file).',
      });
    }
    const name = file.originalname?.toLowerCase() ?? '';
    if (!name.endsWith('.csv')) {
      throw new BadRequestException({
        code: 'invalid_file_type',
        message: 'Chỉ chấp nhận tệp có đuôi .csv.',
      });
    }
    const csvText = file.buffer.toString('utf8');
    if (!csvText.trim()) {
      throw new BadRequestException({
        code: 'csv_empty',
        message: 'Tệp CSV trống hoặc không đọc được.',
      });
    }
    const payload: StudentSyncJobPayload = { csvText };
    const job = await this.studentSyncQueue.add(
      STUDENT_SYNC_JOB_NAME,
      payload,
      {},
    );
    return { jobId: String(job.id) };
  }

  @Get('jobs/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<StudentSyncJobStatusResponse> {
    const job = await this.studentSyncQueue.getJob(decodeURIComponent(jobId));
    if (!job) {
      throw new NotFoundException({
        code: 'job_not_found',
        message:
          'Không tìm thấy job đồng bộ hoặc bản ghi đã bị xóa khỏi Redis.',
      });
    }
    const rawState = await job.getState();
    const state = mapJobStateForResponse(rawState);

    if (rawState === 'completed') {
      const report = job.returnvalue as StudentSyncReport | undefined;
      return { jobId: String(job.id), state, report };
    }
    if (rawState === 'failed') {
      return {
        jobId: String(job.id),
        state,
        failedReason: job.failedReason ?? undefined,
      };
    }
    return { jobId: String(job.id), state };
  }
}
