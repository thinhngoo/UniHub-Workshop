import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { RedisService } from '../database/redis.service';

const REDIS_PREFIX = 'payment_init:idemp:v1:';

/** Snapshot của response initiate (không lưu object Payment — luôn đọc lại DB khi replay). */
export type PaymentInitiateIdempotencyPayload = {
  registrationId: string;
  redirectUrl: string | null;
  degraded?: boolean;
  retryAfterSeconds?: number;
  userMessage?: string;
  circuitState?: 'open';
};

@Injectable()
export class PaymentInitiateIdempotencyService {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private redisKey(userId: string, clientKey: string): string {
    const digest = createHash('sha256').update(clientKey, 'utf8').digest('hex');
    return `${REDIS_PREFIX}${userId}:${digest}`;
  }

  private configuredTtlSeconds(): number {
    const n = Number(
      this.config.get<string>('PAYMENT_INIT_IDEMPOTENCY_TTL_SECONDS'),
    );
    return Number.isFinite(n) && n > 0 ? n : 86_400;
  }

  /**
   * TTL thực tế: không vượt quá thời gian giữ chỗ để không replay sai sau expired.
   */
  computeTtlSeconds(reservationExpiresAt: Date | null): number {
    const configured = this.configuredTtlSeconds();
    if (!reservationExpiresAt) {
      return Math.max(300, configured);
    }
    const secLeft = Math.floor(
      (reservationExpiresAt.getTime() - Date.now()) / 1000,
    );
    const withBuffer = secLeft + 120;
    const capped = Math.min(configured, Math.max(300, withBuffer));
    return Math.max(120, capped);
  }

  async getPayload(
    userId: string,
    clientKey: string,
  ): Promise<PaymentInitiateIdempotencyPayload | null> {
    try {
      const raw = await this.redis.client.get(this.redisKey(userId, clientKey));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PaymentInitiateIdempotencyPayload;
      if (
        typeof parsed.registrationId !== 'string' ||
        parsed.registrationId.length === 0
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async deletePayload(userId: string, clientKey: string): Promise<void> {
    try {
      await this.redis.client.del(this.redisKey(userId, clientKey));
    } catch {
      /* ignore */
    }
  }

  async savePayload(
    userId: string,
    clientKey: string,
    payload: PaymentInitiateIdempotencyPayload,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.client.set(
        this.redisKey(userId, clientKey),
        JSON.stringify(payload),
        'EX',
        Math.max(60, ttlSeconds),
      );
    } catch {
      /* fail-open — không chặn thanh toán */
    }
  }
}
