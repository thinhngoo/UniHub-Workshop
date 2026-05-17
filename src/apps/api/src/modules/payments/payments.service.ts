import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  InitiatePaymentResponse,
  Payment as PaymentDto,
} from '@unihub/types';
import { randomUUID } from 'node:crypto';
import type {
  Payment as DbPayment,
  Registration as DbRegistration,
  Workshop as DbWorkshop,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationHoldQueueService } from '../registrations/reservation-hold.queue';

type PaymentWithRelations = DbPayment & {
  registration: DbRegistration & { workshop: DbWorkshop | null };
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly reservationHold: ReservationHoldQueueService,
  ) {}

  private decimalToMoney(n: DbPayment['amount']): number {
    return Number(n.toString());
  }

  private toDto(row: DbPayment): PaymentDto {
    return {
      id: row.id,
      registrationId: row.registrationId,
      amount: this.decimalToMoney(row.amount),
      status: row.status,
      attemptCount: row.attemptCount,
      providerTxnId: row.providerTxnId,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async loadPaymentForRegistrationOwned(
    userId: string,
    registrationId: string,
  ): Promise<PaymentWithRelations> {
    const row = await this.prisma.payment.findFirst({
      where: {
        registrationId,
        registration: { userId },
      },
      include: { registration: { include: { workshop: true } } },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'payment_not_found',
        message: 'Không tìm thấy giao dịch thanh toán cho đăng ký này.',
      });
    }
    return row;
  }

  async getPaymentForRegistrationOwned(
    userId: string,
    registrationId: string,
  ): Promise<PaymentDto> {
    const row = await this.loadPaymentForRegistrationOwned(
      userId,
      registrationId,
    );
    return this.toDto(row);
  }

  async getPaymentByIdOwned(
    userId: string,
    paymentId: string,
  ): Promise<PaymentDto> {
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { registration: { include: { workshop: true } } },
    });
    if (!row || row.registration.userId !== userId) {
      throw new NotFoundException({
        code: 'payment_not_found',
        message: 'Không tìm thấy giao dịch thanh toán.',
      });
    }
    return this.toDto(row);
  }

  async initiateStudentPayment(
    userId: string,
    registrationId: string,
  ): Promise<InitiatePaymentResponse> {
    const bundle = await this.loadPaymentForRegistrationOwned(
      userId,
      registrationId,
    );

    const { registration: reg } = bundle;

    const workshop = reg.workshop;
    if (!workshop?.isPaid) {
      throw new BadRequestException({
        code: 'workshop_not_paid',
        message: 'Workshop này không thu phí — không cần thanh toán.',
      });
    }

    if (bundle.status === 'succeeded') {
      return {
        payment: this.toDto(bundle),
        redirectUrl: null,
      };
    }

    if (bundle.status === 'refunded') {
      throw new BadRequestException({
        code: 'payment_refunded',
        message: 'Giao dịch đã được hoàn tiền; không thanh toán lại được.',
      });
    }

    const now = new Date();
    if (reg.expiresAt && reg.expiresAt < now && reg.status === 'reserved') {
      throw new BadRequestException({
        code: 'reservation_expired',
        message: 'Thời gian giữ chỗ đã hết.',
      });
    }

    if (reg.status !== 'reserved') {
      throw new BadRequestException({
        code: 'registration_not_pending_payment',
        message: 'Đăng ký không đang chờ thanh toán.',
      });
    }

    const paymentId = bundle.id;
    const regId = bundle.registrationId;
    const providerTxnId = `mock_pg_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          attemptCount: { increment: 1 },
          providerTxnId,
          status: 'succeeded',
          lastError: null,
        },
      });

      const qrTok = `qrtok_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await tx.registration.update({
        where: { id: regId },
        data: {
          status: 'confirmed',
          confirmedAt: now,
          expiresAt: null,
          qrToken: qrTok,
        },
      });

      return tx.payment.findUnique({
        where: { id: paymentId },
      }) as Promise<DbPayment>;
    });

    await this.reservationHold.cancelScheduledRelease(regId);

    const workshopTitle = bundle.registration.workshop?.title ?? 'Workshop';

    await this.notifications.enqueueSafe(
      bundle.registration.userId,
      'payment_success',
      {
        registrationId: regId,
        paymentId: paymentId,
        workshopTitle,
        amount: this.decimalToMoney(updatedPayment.amount),
      },
    );

    return {
      payment: this.toDto(updatedPayment),
      redirectUrl: null,
    };
  }
}
