import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WORKSHOP_SUMMARY_QUEUE } from '../../constant';
import type { WorkshopSummaryJobPayload } from './workshop-summary';
import {
  WorkshopSummaryService,
  type WorkshopSummaryJobDone,
} from './workshop-summary.service';

@Processor(WORKSHOP_SUMMARY_QUEUE)
export class WorkshopSummaryProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkshopSummaryProcessor.name);

  constructor(private readonly workshopSummary: WorkshopSummaryService) {
    super();
  }

  async process(
    job: Job<WorkshopSummaryJobPayload>,
  ): Promise<WorkshopSummaryJobDone> {
    const workshopId = job.data?.workshopId;
    if (typeof workshopId !== 'string' || workshopId.trim().length === 0) {
      throw new Error('Job thiếu workshopId hợp lệ.');
    }
    this.logger.log(`Summary PDF job ${job.id} workshop=${workshopId}`);
    const result = await this.workshopSummary.runQueuedPdfSummary(workshopId);
    this.logger.log(`Summary PDF job ${job.id} done (ready)`);
    return result;
  }
}
