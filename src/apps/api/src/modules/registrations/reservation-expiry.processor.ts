import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RESERVATION_EXPIRY_QUEUE } from '../../constant';
import { RegistrationsRepository } from '../database/repository/registrations.repository';
import type { ReservationExpiryJobData } from './reservation-hold.queue';

@Processor(RESERVATION_EXPIRY_QUEUE)
export class ReservationExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpiryProcessor.name);

  constructor(private readonly registrations: RegistrationsRepository) {
    super();
  }

  async process(
    job: Job<ReservationExpiryJobData>,
  ): Promise<{ freed: boolean }> {
    const registrationId = job.data?.registrationId;
    if (!registrationId) {
      this.logger.warn(`Job ${job.id}: missing registrationId`);
      return { freed: false };
    }

    const freed =
      await this.registrations.releaseSeatHoldIfStillReserved(registrationId);

    if (freed) {
      this.logger.log(`Đã giải phóng giữ chỗ registration=${registrationId}`);
    }

    return { freed };
  }
}
