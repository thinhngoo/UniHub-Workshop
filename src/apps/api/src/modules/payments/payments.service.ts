import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import {
  parseMockWebhookPayload,
  verifyMockWebhook,
} from '../../mock/payment-gateway/mock-payment-signing';
import { MockPaymentSessionStore } from '../../mock/payment-gateway/mock-payment-session.store';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  PaymentGatewayCircuitBreakerService,
  type PaymentInitiateGate,
} from './payment-gateway-circuit.service';
import {
  PaymentInitiateIdempotencyService,
  type PaymentInitiateIdempotencyPayload,
} from './payment-initiate-idempotency.service';
import { ReservationHoldQueueService } from '../registrations/reservation-hold.queue';
import { devPaymentChaosEnabled } from './payment-dev-env';

type PaymentWithRelations = DbPayment & {
  registration: DbRegistration & { workshop: DbWorkshop | null };
};

function useMockPaymentGatewayRedirect(): boolean {
  const v = process.env.USE_MOCK_PAYMENT_GATEWAY?.toLowerCase();
  return v === '1' || v === 'true';
}

const DEV_WEBHOOK_CHAOS_REASONS: readonly string[] = [
  '[DEV chaos] Webhook success bị chặn (timeout giả lập).',
  '[DEV chaos] Webhook success bị chặn (PSP từ chối).',
  '[DEV chaos] Webhook success bị chặn (số dư / hạn mức).',
  '[DEV chaos] Webhook success bị chặn (lỗi xác thực 3DS).',
  '[DEV chaos] Webhook success bị chặn (duplicate intent).',
];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly reservationHold: ReservationHoldQueueService,
    private readonly mockSessions: MockPaymentSessionStore,
    private readonly paymentGatewayCircuit: PaymentGatewayCircuitBreakerService,
    private readonly initiateIdempotency: PaymentInitiateIdempotencyService,
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

  /**
   * Chống open redirect: chỉ cho URL bắt đầu bằng một prefix trong PAYMENT_RETURN_URL_ALLOWLIST.
   */
  private assertAllowedPaymentReturnUrl(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.length > 2048) {
      throw new BadRequestException({
        code: 'invalid_return_url',
        message: 'returnUrl quá dài.',
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException({
        code: 'invalid_return_url',
        message: 'returnUrl không phải URL hợp lệ.',
      });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException({
        code: 'invalid_return_url',
        message: 'returnUrl chỉ được dùng http hoặc https.',
      });
    }

    const listRaw = this.config.get<string>('PAYMENT_RETURN_URL_ALLOWLIST');
    const list =
      listRaw
        ?.split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean) ?? [];

    if (list.length === 0) {
      throw new BadRequestException({
        code: 'payment_return_url_not_configured',
        message:
          'Server chưa cấu hình PAYMENT_RETURN_URL_ALLOWLIST — không thể dùng returnUrl.',
      });
    }

    const ok = list.some((allowed) => {
      const prefix = allowed.replace(/\/$/, '');
      return (
        trimmed === prefix ||
        trimmed.startsWith(`${prefix}/`) ||
        trimmed.startsWith(`${prefix}?`)
      );
    });

    if (!ok) {
      throw new BadRequestException({
        code: 'invalid_return_url',
        message: 'returnUrl không thuộc danh sách origin được phép.',
      });
    }

    return trimmed;
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

  private applyInitiateGate(
    gate: PaymentInitiateGate,
    bundle: PaymentWithRelations,
  ): InitiatePaymentResponse | undefined {
    if (gate.kind === 'allow') return undefined;
    if (gate.kind === 'graceful') {
      return {
        payment: this.toDto(bundle),
        redirectUrl: null,
        degraded: true,
        retryAfterSeconds: gate.retryAfterSeconds,
        userMessage: gate.message,
        circuitState: 'open',
      };
    }
    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'payment_gateway_unavailable',
        message: gate.message,
        retryAfterSeconds: gate.retryAfterSeconds,
        circuitState: 'open',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /**
   * Gây lỗi thanh toán ngẫu nhiên (timeout, từ chối, v.v.).
   * Mọi nhánh đều kết thúc lỗi hoặc lưu `failed`; không có nhánh đi tiếp tới cổng thật / mock trong dev chaos.
   */
  private async devPaymentChaosMaybeThrowOnInitiate(
    paymentId: string,
  ): Promise<void> {
    if (!devPaymentChaosEnabled()) return;

    // Mỗi lần vào nhánh chaos: đếm như lỗi hạ tầng (recordInfrastructureFailure) — chỉ tăng khi CB đã bật (PAYMENT_GATEWAY_CB_ENABLED).
    await this.paymentGatewayCircuit.recordInfrastructureFailure();

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    const roll = Math.floor(Math.random() * 7);

    switch (roll) {
      case 0:
        await sleep(120 + Math.random() * 400);
        throw new HttpException(
          {
            code: 'payment_gateway_timeout',
            message: '[DEV chaos] Timeout kết nối tới cổng thanh toán.',
          },
          HttpStatus.GATEWAY_TIMEOUT,
        );

      case 1:
        throw new HttpException(
          {
            code: 'payment_provider_unavailable',
            message: '[DEV chaos] Cổng thanh toán không phản hồi.',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );

      case 2:
        throw new BadRequestException({
          code: 'payment_declined',
          message:
            '[DEV chaos] Thẻ / ví bị từ chối (giả lập — kiểm tra UI lỗi).',
        });

      case 3:
        throw new ConflictException({
          code: 'payment_duplicate_attempt',
          message:
            '[DEV chaos] Trùng yêu cầu thanh toán — thử Idempotency-Key khác để tái kiểm thử.',
        });

      case 4:
        await sleep(1600 + Math.random() * 2400);
        throw new HttpException(
          {
            code: 'payment_upstream_slow',
            message: '[DEV chaos] Phía cổng xử lý quá chậm (REQUEST_TIMEOUT).',
          },
          HttpStatus.REQUEST_TIMEOUT,
        );

      case 5:
        await this.finalizePaymentFailure(
          paymentId,
          '[DEV chaos] Lỗi phía PSP — đã lưu trạng thái payment failed.',
        );
        throw new BadRequestException({
          code: 'payment_failed',
          message:
            '[DEV chaos] Thanh toán thất bại — kiểm tra payment status trong DB/UI.',
        });

      default:
        throw new InternalServerErrorException({
          code: 'payment_internal_error',
          message: '[DEV chaos] Lỗi nội bộ kết nối cổng (500 giả lập).',
        });
    }
  }

  private async optionalPaymentGatewayHealthProbe(): Promise<void> {
    const url = this.config
      .get<string>('PAYMENT_GATEWAY_HEALTHCHECK_URL')
      ?.trim();
    if (!url) return;

    const timeoutMsRaw = Number(
      this.config.get<string>('PAYMENT_GATEWAY_HEALTHCHECK_TIMEOUT_MS'),
    );
    const timeoutMs =
      Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 3000;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: ac.signal,
        redirect: 'manual',
      });

      if (!res.ok && (res.status >= 500 || res.status === 429)) {
        throw new Error(`upstream_status_${res.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
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

  /**
   * Xác nhận thanh toán thành công (dùng cho webhook mock và luồng đồng bộ dev).
   */
  private async finalizePaymentSuccess(
    paymentId: string,
    providerTxnId: string,
    opts?: { incrementAttempt?: boolean },
  ): Promise<PaymentDto> {
    const bundle = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { registration: { include: { workshop: true } } },
    });

    if (!bundle) {
      throw new NotFoundException({
        code: 'payment_not_found',
        message: 'Không tìm thấy giao dịch thanh toán.',
      });
    }

    if (bundle.status === 'succeeded') {
      return this.toDto(bundle);
    }

    const reg = bundle.registration;
    const workshop = reg.workshop;

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

    const regId = bundle.registrationId;

    const updatedPayment = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          ...(opts?.incrementAttempt ? { attemptCount: { increment: 1 } } : {}),
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

    const workshopTitle = workshop?.title ?? 'Workshop';

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

    await this.paymentGatewayCircuit.recordCheckoutSuccess();

    return this.toDto(updatedPayment);
  }

  private async finalizePaymentFailure(
    paymentId: string,
    failureReason: string,
  ): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: 'pending',
      },
      data: {
        status: 'failed',
        lastError: failureReason.slice(0, 900),
      },
    });
  }

  async handleMockGatewayWebhook(
    signatureHeader: string | undefined,
    body: unknown,
  ): Promise<{ received: boolean }> {
    const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException({
        code: 'webhook_secret_missing',
        message:
          'MOCK_PAYMENT_WEBHOOK_SECRET chưa được cấu hình — không thể xác thực webhook.',
      });
    }

    const payload = parseMockWebhookPayload(body);
    if (!payload) {
      throw new BadRequestException({
        code: 'invalid_webhook_payload',
        message: 'Payload webhook không hợp lệ.',
      });
    }

    const sig = signatureHeader?.trim();
    if (!sig || !verifyMockWebhook(secret, payload, sig)) {
      throw new UnauthorizedException({
        code: 'invalid_webhook_signature',
        message: 'Chữ ký webhook không hợp lệ.',
      });
    }

    if (payload.event === 'payment.failed') {
      await this.finalizePaymentFailure(
        payload.paymentId,
        payload.failureReason,
      );
      return { received: true };
    }

    if (devPaymentChaosEnabled()) {
      const reason =
        DEV_WEBHOOK_CHAOS_REASONS[
          Math.floor(Math.random() * DEV_WEBHOOK_CHAOS_REASONS.length)
        ] ?? DEV_WEBHOOK_CHAOS_REASONS[0];
      await this.finalizePaymentFailure(payload.paymentId, reason);
      return { received: true };
    }

    await this.finalizePaymentSuccess(payload.paymentId, payload.providerTxnId);
    return { received: true };
  }

  async initiateStudentPayment(
    userId: string,
    registrationId: string,
    opts?: { returnUrl?: string; idempotencyKey?: string },
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

    const idemKey = opts?.idempotencyKey?.trim();
    if (!idemKey) {
      throw new BadRequestException({
        code: 'payment_init_idempotency_required',
        message:
          'Thiếu header Idempotency-Key — gửi lại cùng một key khi retry để tránh xử lý thanh toán trùng.',
      });
    }
    if (idemKey.length > 191) {
      throw new BadRequestException({
        code: 'payment_init_idempotency_invalid',
        message: 'Idempotency-Key không hợp lệ hoặc quá dài.',
      });
    }

    const gate = await this.paymentGatewayCircuit.evaluateInitiateGate();
    const gateResponse = this.applyInitiateGate(gate, bundle);
    if (gateResponse) return gateResponse;

    try {
      await this.optionalPaymentGatewayHealthProbe();
    } catch {
      await this.paymentGatewayCircuit.recordInfrastructureFailure();
      const retryAfterRaw = Number(
        this.config.get<string>('PAYMENT_GATEWAY_PROBE_RETRY_AFTER_SEC'),
      );
      const retryAfter =
        Number.isFinite(retryAfterRaw) && retryAfterRaw > 0
          ? retryAfterRaw
          : 30;

      const infraGate =
        this.paymentGatewayCircuit.infrastructureUnavailableGate(
          retryAfter,
          'Không kiểm tra được cổng thanh toán (health check). Vui lòng thử lại sau.',
        );
      const infraResponse = this.applyInitiateGate(infraGate, bundle);
      if (infraResponse) return infraResponse;
    }

    const replayed = await this.tryReplayInitiatePayment(
      userId,
      paymentId,
      registrationId,
      idemKey,
    );
    if (replayed) return replayed;

    await this.devPaymentChaosMaybeThrowOnInitiate(paymentId);

    if (useMockPaymentGatewayRedirect()) {
      const publicBase = process.env.PUBLIC_APP_URL?.trim();
      const webhookSecret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET?.trim();

      if (!publicBase) {
        throw new InternalServerErrorException({
          code: 'public_app_url_missing',
          message:
            'PUBLIC_APP_URL phải được cấu hình khi USE_MOCK_PAYMENT_GATEWAY bật (URL gốc của API để redirect/checkout).',
        });
      }

      if (!webhookSecret) {
        throw new InternalServerErrorException({
          code: 'webhook_secret_missing',
          message:
            'MOCK_PAYMENT_WEBHOOK_SECRET phải được cấu hình khi USE_MOCK_PAYMENT_GATEWAY bật.',
        });
      }

      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { attemptCount: { increment: 1 } },
      });

      let validatedReturn: string | undefined;
      if (opts?.returnUrl?.trim()) {
        validatedReturn = this.assertAllowedPaymentReturnUrl(opts.returnUrl);
      }

      const sessionId = this.mockSessions.createSession(
        paymentId,
        this.decimalToMoney(bundle.amount),
        validatedReturn,
      );

      const checkoutUrl = `${publicBase.replace(/\/$/, '')}/mock/payment-gateway/checkout/${sessionId}`;
      const refreshed = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      const response: InitiatePaymentResponse = {
        payment: this.toDto(refreshed ?? bundle),
        redirectUrl: checkoutUrl,
      };

      await this.persistInitiateIdempotencySnapshot(
        userId,
        idemKey,
        reg.expiresAt,
        {
          registrationId,
          redirectUrl: checkoutUrl,
        },
      );

      return response;
    }

    const providerTxnId = `mock_pg_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const paymentDto = await this.finalizePaymentSuccess(
      paymentId,
      providerTxnId,
      { incrementAttempt: true },
    );

    await this.persistInitiateIdempotencySnapshot(
      userId,
      idemKey,
      reg.expiresAt,
      {
        registrationId,
        redirectUrl: null,
      },
    );

    return {
      payment: paymentDto,
      redirectUrl: null,
    };
  }

  private async tryReplayInitiatePayment(
    userId: string,
    paymentId: string,
    registrationId: string,
    idempotencyKey: string,
  ): Promise<InitiatePaymentResponse | null> {
    const cached = await this.initiateIdempotency.getPayload(
      userId,
      idempotencyKey,
    );
    if (!cached) return null;

    if (cached.registrationId !== registrationId) {
      throw new ConflictException({
        code: 'payment_init_idempotency_scope_mismatch',
        message:
          'Idempotency-Key đã được dùng cho một đăng ký khác — không thể áp dụng cho đăng ký hiện tại.',
      });
    }

    const row = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        registrationId,
        registration: { userId },
      },
    });

    if (!row) {
      await this.initiateIdempotency.deletePayload(userId, idempotencyKey);
      return null;
    }

    if (row.status === 'succeeded') {
      return {
        payment: this.toDto(row),
        redirectUrl: null,
      };
    }

    if (row.status === 'pending' && cached.redirectUrl) {
      const merged: InitiatePaymentResponse = {
        payment: this.toDto(row),
        redirectUrl: cached.redirectUrl,
      };
      if (cached.degraded) merged.degraded = true;
      if (cached.retryAfterSeconds !== undefined) {
        merged.retryAfterSeconds = cached.retryAfterSeconds;
      }
      if (cached.userMessage !== undefined) {
        merged.userMessage = cached.userMessage;
      }
      if (cached.circuitState !== undefined) {
        merged.circuitState = cached.circuitState;
      }
      return merged;
    }

    await this.initiateIdempotency.deletePayload(userId, idempotencyKey);
    return null;
  }

  private async persistInitiateIdempotencySnapshot(
    userId: string,
    idempotencyKey: string,
    reservationExpiresAt: Date | null,
    payload: PaymentInitiateIdempotencyPayload,
  ): Promise<void> {
    const ttl =
      this.initiateIdempotency.computeTtlSeconds(reservationExpiresAt);
    await this.initiateIdempotency.savePayload(
      userId,
      idempotencyKey,
      payload,
      ttl,
    );
  }
}
