import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { RESERVATION_EXPIRY_QUEUE } from '../../constant';
import { DatabaseModule } from '../database/database.module';
import { ReservationExpiryProcessor } from './reservation-expiry.processor';
import { ReservationHoldQueueService } from './reservation-hold.queue';

@Global()
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: RESERVATION_EXPIRY_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  providers: [ReservationHoldQueueService, ReservationExpiryProcessor],
  exports: [ReservationHoldQueueService],
})
export class ReservationHoldModule {}
