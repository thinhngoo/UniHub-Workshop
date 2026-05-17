import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WORKSHOP_SUMMARY_QUEUE } from '../../constant';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { WorkshopSummaryProcessor } from './workshop-summary.processor';
import { WorkshopSummaryService } from './workshop-summary.service';
import { WorkshopsController } from './workshops.controller';
import { WorkshopsService } from './workshops.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BullModule.registerQueue({
      name: WORKSHOP_SUMMARY_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    }),
  ],
  controllers: [WorkshopsController],
  providers: [
    WorkshopsService,
    WorkshopSummaryService,
    WorkshopSummaryProcessor,
  ],
  exports: [WorkshopsService, WorkshopSummaryService],
})
export class WorkshopsModule {}
