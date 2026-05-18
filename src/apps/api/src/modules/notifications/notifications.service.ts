import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Notification as DbNotification } from '@prisma/client';
import type { NotificationMessage } from '@unihub/types';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import {
  NOTIFICATION_DISPATCH_JOB_NAME,
  NOTIFICATION_QUEUE,
} from '../../constant';
import { PrismaService } from '../database/prisma.service';
import type { NotificationDispatchJobData } from './notification-dispatch';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<NotificationDispatchJobData>,
  ) {}

  private toMessage(row: DbNotification): NotificationMessage {
    let payload: Record<string, unknown> = {};
    if (
      typeof row.payloadJson === 'object' &&
      row.payloadJson !== null &&
      !Array.isArray(row.payloadJson)
    ) {
      payload = row.payloadJson;
    }

    return {
      id: row.id,
      userId: row.userId,
      templateCode: row.templateCode,
      payload,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
    };
  }

  async enqueueSafe(
    userId: string,
    templateCode: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const row = await this.prisma.notification.create({
        data: {
          userId,
          templateCode,
          payloadJson: payload as Prisma.InputJsonValue,
          status: 'pending',
        },
      });
      await this.notificationQueue.add(
        NOTIFICATION_DISPATCH_JOB_NAME,
        { notificationId: row.id },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1500 },
        },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `enqueueSafe failed template=${templateCode} user=${userId}: ${msg}`,
      );
    }
  }

  async listForUser(userId: string): Promise<NotificationMessage[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toMessage(r));
  }
}
