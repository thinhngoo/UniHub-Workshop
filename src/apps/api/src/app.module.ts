import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CheckinModule } from './modules/checkin/checkin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReservationHoldModule } from './modules/registrations/reservation-hold.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { StudentSyncModule } from './modules/student-sync/student-sync.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';

function throttleMs(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: throttleMs(config, 'THROTTLE_TTL_MS', 60_000),
          limit: throttleMs(config, 'THROTTLE_LIMIT', 120),
        },
      ],
    }),
    QueueModule,
    DatabaseModule,
    ReservationHoldModule,
    AuthModule,
    WorkshopsModule,
    RegistrationsModule,
    PaymentsModule,
    AdminModule,
    CheckinModule,
    NotificationsModule,
    StudentSyncModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
