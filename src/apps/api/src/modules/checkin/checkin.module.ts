import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

@Module({
  imports: [AuthModule, DatabaseModule, RegistrationsModule],
  controllers: [CheckinController],
  providers: [CheckinService],
})
export class CheckinModule {}
