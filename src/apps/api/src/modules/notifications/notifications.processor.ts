import { MailerService } from '@nestjs-modules/mailer';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE } from '../../constant';
import { PrismaService } from '../database/prisma.service';
import type { NotificationDispatchJobData } from './notification-dispatch';
import { buildNotificationEmailContent } from './notification-mail.content';

@Processor(NOTIFICATION_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    super();
  }

  async process(
    job: Job<NotificationDispatchJobData>,
  ): Promise<{ ok: boolean; notificationId: string }> {
    const { notificationId } = job.data ?? {};
    if (!notificationId) {
      this.logger.warn(`Job ${job.id} skipped: missing notificationId`);
      return { ok: false, notificationId: '' };
    }

    const row = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    if (!row) {
      this.logger.warn(
        `Job ${job.id}: notification ${notificationId} không tồn tại`,
      );
      return { ok: false, notificationId };
    }

    if (row.status !== 'pending') {
      return { ok: true, notificationId };
    }

    try {
      let payload: Record<string, unknown> = {};
      if (
        typeof row.payloadJson === 'object' &&
        row.payloadJson !== null &&
        !Array.isArray(row.payloadJson)
      ) {
        payload = row.payloadJson;
      }

      const content = buildNotificationEmailContent({
        templateCode: row.templateCode,
        payload,
        recipientName: row.user.fullName,
      });

      await this.mailer.sendMail({
        to: row.user.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });
      return { ok: true, notificationId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Gửi thông báo thất bại id=${notificationId}: ${message}`,
      );
      await this.prisma.notification
        .updateMany({
          where: { id: notificationId, status: 'pending' },
          data: { status: 'failed' },
        })
        .catch(() => undefined);
      throw err;
    }
  }
}
