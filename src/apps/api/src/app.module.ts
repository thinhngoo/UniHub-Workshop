import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { DatabaseModule } from './modules/database/database.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    WorkshopsModule,
    RegistrationsModule,
    AdminModule,
    CheckinModule,
  ],
})
export class AppModule {}
