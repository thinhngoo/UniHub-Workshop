import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CheckInBatchItem,
  CheckInBatchItemResult,
  CheckInBatchResponse,
} from '@unihub/types';
import { PrismaService } from '../database/prisma.service';
import { RegistrationsService } from '../registrations/registrations.service';

@Injectable()
export class CheckinService {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Minimal UUID grammar check before Prisma (avoids 500 on bad client payloads). */
  private looksLikeUuid(value: string): boolean {
    return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
  }

  async processBatch(
    staffUserId: string,
    items: CheckInBatchItem[],
  ): Promise<CheckInBatchResponse> {
    const results: CheckInBatchItemResult[] = [];
    for (const item of items) {
      results.push(await this.processOne(staffUserId, item));
    }
    return { results };
  }

  private async processOne(
    staffUserId: string,
    item: CheckInBatchItem,
  ): Promise<CheckInBatchItemResult> {
    if (!this.looksLikeUuid(item.clientEventId)) {
      return {
        clientEventId: item.clientEventId,
        status: 'not_registered',
        registrationId: null,
        message: 'client_event_id không hợp lệ.',
      };
    }

    const reg = await this.registrations.findByQrToken(item.qrToken);
    if (!reg) {
      return {
        clientEventId: item.clientEventId,
        status: 'invalid_qr',
        registrationId: null,
        message: 'Mã QR không hợp lệ hoặc đã bị thu hồi.',
      };
    }

    const scannedAt = new Date(item.scannedAt);
    if (Number.isNaN(scannedAt.getTime())) {
      return {
        clientEventId: item.clientEventId,
        status: 'not_registered',
        registrationId: reg.id,
        message: 'Thời điểm quét không hợp lệ.',
      };
    }

    if (reg.status === 'cancelled' || reg.status === 'expired') {
      return {
        clientEventId: item.clientEventId,
        status: reg.status === 'cancelled' ? 'cancelled' : 'not_registered',
        registrationId: reg.id,
        message:
          reg.status === 'cancelled'
            ? 'Đăng ký đã bị hủy.'
            : 'Đăng ký đã hết hiệu lực.',
      };
    }

    if (reg.status !== 'confirmed') {
      return {
        clientEventId: item.clientEventId,
        status: 'not_registered',
        registrationId: reg.id,
        message: 'Đăng ký chưa được xác nhận.',
      };
    }

    const existingEvent = await this.prisma.checkin.findUnique({
      where: {
        staffUserId_clientEventId: {
          staffUserId,
          clientEventId: item.clientEventId,
        },
      },
    });
    if (existingEvent) {
      return {
        clientEventId: item.clientEventId,
        status: 'duplicate',
        registrationId: existingEvent.registrationId,
        message: 'Sự kiện đã được gửi trước đó.',
      };
    }

    const existingRegistration = await this.prisma.checkin.findUnique({
      where: { registrationId: reg.id },
    });
    if (existingRegistration) {
      return {
        clientEventId: item.clientEventId,
        status: 'duplicate',
        registrationId: reg.id,
        message: 'Sinh viên đã được check-in.',
      };
    }

    try {
      await this.prisma.checkin.create({
        data: {
          registrationId: reg.id,
          clientEventId: item.clientEventId,
          scannedAt,
          staffUserId,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const replay = await this.prisma.checkin.findFirst({
          where: {
            OR: [
              {
                staffUserId,
                clientEventId: item.clientEventId,
              },
              { registrationId: reg.id },
            ],
          },
        });
        return {
          clientEventId: item.clientEventId,
          status: 'duplicate',
          registrationId: replay?.registrationId ?? reg.id,
          message: replay
            ? replay.staffUserId === staffUserId &&
              replay.clientEventId === item.clientEventId
              ? 'Sự kiện đã được gửi trước đó.'
              : 'Sinh viên đã được check-in.'
            : 'Trùng bản ghi check-in.',
        };
      }
      throw e;
    }

    return {
      clientEventId: item.clientEventId,
      status: 'accepted',
      registrationId: reg.id,
      message: null,
    };
  }
}
