import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { WorkshopsModule } from '../workshops/workshops.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkshopsModule, RegistrationsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
