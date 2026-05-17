import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PaymentsModule } from '../payments/payments.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { WorkshopRegistrationsController } from './workshop-registrations.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    WorkshopsModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [RegistrationsController, WorkshopRegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
