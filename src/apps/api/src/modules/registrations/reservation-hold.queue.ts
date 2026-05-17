import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  RESERVATION_EXPIRY_JOB_NAME,
  RESERVATION_EXPIRY_QUEUE,
} from '../../constant';

export type ReservationExpiryJobData = {
  registrationId: string;
};

@Injectable()
export class ReservationHoldQueueService {
  private readonly logger = new Logger(ReservationHoldQueueService.name);

  constructor(
    @InjectQueue(RESERVATION_EXPIRY_QUEUE)
    private readonly queue: Queue<ReservationExpiryJobData>,
  ) {}

  /** BullMQ forbids ':' in custom jobId — prefix + UUID only. */
  private jobId(registrationId: string): string {
    return `release-hold-${registrationId}`;
  }

  async scheduleRelease(
    registrationId: string,
    expiresAt: Date,
  ): Promise<void> {
    const delayMs = Math.max(0, expiresAt.getTime() - Date.now());
    const id = this.jobId(registrationId);
    try {
      const existing = await this.queue.getJob(id);
      if (existing) await existing.remove();
    } catch {
      /* noop */
    }

    await this.queue.add(
      RESERVATION_EXPIRY_JOB_NAME,
      { registrationId },
      {
        delay: delayMs,
        jobId: id,
      },
    );

    this.logger.debug(
      `Scheduled reservation release registration=${registrationId} delayMs=${delayMs}`,
    );
  }

  async cancelScheduledRelease(registrationId: string): Promise<void> {
    const job = await this.queue.getJob(this.jobId(registrationId));
    if (job) await job.remove().catch(() => undefined);
  }
}
