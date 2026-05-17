import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATION_QUEUE } from '../../constant';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const from =
          config.get<string>('MAIL_FROM') ??
          '"UniHub Workshop" <noreply@localhost>';
        const host = config.get<string>('SMTP_HOST')?.trim();
        if (!host) {
          return {
            transport: { jsonTransport: true },
            defaults: { from },
          };
        }
        const port = Number(config.get<string>('SMTP_PORT') ?? 587);
        const secure =
          config.get<string>('SMTP_SECURE') === 'true' ||
          config.get<string>('SMTP_SECURE') === '1';
        const user = config.get<string>('SMTP_USER')?.trim();
        const pass = config.get<string>('SMTP_PASSWORD') ?? '';
        return {
          transport: {
            host,
            port,
            secure,
            ...(user ? { auth: { user, pass } } : {}),
          },
          defaults: { from },
        };
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1500 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 300 },
      },
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
