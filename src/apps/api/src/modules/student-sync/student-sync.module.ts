import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { STUDENT_SYNC_QUEUE } from '../../constant';
import { StudentSyncController } from './student-sync.controller';
import { StudentSyncProcessor } from './student-sync.processor';
import { StudentSyncService } from './student-sync.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    BullModule.registerQueue({
      name: STUDENT_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    }),
  ],
  controllers: [StudentSyncController],
  providers: [StudentSyncService, StudentSyncProcessor],
})
export class StudentSyncModule {}
