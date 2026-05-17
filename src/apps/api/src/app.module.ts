import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CheckinModule } from './modules/checkin/checkin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { QueueModule } from './modules/queue/queue.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { StudentSyncModule } from './modules/student-sync/student-sync.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueueModule,
    DatabaseModule,
    AuthModule,
    WorkshopsModule,
    RegistrationsModule,
    PaymentsModule,
    AdminModule,
    CheckinModule,
    NotificationsModule,
    StudentSyncModule,
  ],
})
export class AppModule {}
