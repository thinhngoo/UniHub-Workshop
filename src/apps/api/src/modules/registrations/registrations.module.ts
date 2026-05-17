import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { WorkshopRegistrationsController } from './workshop-registrations.controller';

@Module({
  imports: [DatabaseModule, AuthModule, WorkshopsModule],
  controllers: [RegistrationsController, WorkshopRegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
