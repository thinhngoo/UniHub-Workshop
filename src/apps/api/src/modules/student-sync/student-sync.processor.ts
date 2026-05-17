import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { StudentSyncReport } from '@unihub/types';
import { Job } from 'bullmq';
import { STUDENT_SYNC_QUEUE } from '../../constant';
import { StudentSyncService } from './student-sync.service';
import type { StudentSyncJobPayload } from './student-sync';

@Processor(STUDENT_SYNC_QUEUE)
export class StudentSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(StudentSyncProcessor.name);

  constructor(private readonly studentSync: StudentSyncService) {
    super();
  }

  async process(job: Job<StudentSyncJobPayload>): Promise<StudentSyncReport> {
    this.logger.log(`Student sync job ${job.id} started`);
    const csvText = job.data?.csvText;
    if (typeof csvText !== 'string' || csvText.trim().length === 0) {
      throw new Error('Thiếu nội dung CSV trong job đồng bộ.');
    }
    const report = await this.studentSync.syncFromCsvText(csvText);
    this.logger.log(
      `Student sync job ${job.id} done (${report.imported} imported)`,
    );
    return report;
  }
}
