import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../database/redis.service';

const REDIS_KEY = 'payment_gateway:circuit:v1';

export type PaymentInitiateGate =
  | { kind: 'allow' }
  | {
      kind: 'graceful';
      retryAfterSeconds: number;
      message: string;
    }
  | {
      kind: 'block';
      retryAfterSeconds: number;
      message: string;
    };

type PersistedCircuitState = {
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  openedAtMs: number | null;
  halfOpenEnteredAtMs: number | null;
};

const DEFAULT_STATE: PersistedCircuitState = {
  state: 'closed',
  failures: 0,
  openedAtMs: null,
  halfOpenEnteredAtMs: null,
};

/**
 * Redis-backed circuit breaker for outbound payment-gateway traffic (Closed → Open → Half-Open).
 * Fail-open if Redis errors so payments can proceed without the breaker key.
 */
@Injectable()
export class PaymentGatewayCircuitBreakerService {
  private readonly logger = new Logger(
    PaymentGatewayCircuitBreakerService.name,
  );

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  enabled(): boolean {
    const v = this.config
      .get<string>('PAYMENT_GATEWAY_CB_ENABLED')
      ?.trim()
      .toLowerCase();
    return v === '1' || v === 'true';
  }

  /** When circuit blocks and this is true → HTTP 200 + degraded payload instead of 503. */
  gracefulHttpResponse(): boolean {
    const v = this.config
      .get<string>('PAYMENT_GATEWAY_CB_GRACEFUL_RESPONSE')
      ?.trim()
      .toLowerCase();
    if (v === '0' || v === 'false') return false;
    return true;
  }

  private threshold(): number {
    const n = Number(
      this.config.get<string>('PAYMENT_GATEWAY_CB_FAILURE_THRESHOLD'),
    );
    return Number.isFinite(n) && n > 0 ? n : 5;
  }

  private resetMs(): number {
    const n = Number(this.config.get<string>('PAYMENT_GATEWAY_CB_RESET_MS'));
    return Number.isFinite(n) && n > 0 ? n : 60_000;
  }

  private blockMessage(): string {
    return (
      this.config.get<string>('PAYMENT_GATEWAY_CB_USER_MESSAGE')?.trim() ??
      'Cổng thanh toán tạm không khả dụng do lỗi liên tiếp hoặc quá tải. Giữ chỗ vẫn hiệu lực trong thời gian còn lại — vui lòng thử lại sau.'
    );
  }

  private async readState(): Promise<PersistedCircuitState> {
    try {
      const raw = await this.redis.client.get(REDIS_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw) as PersistedCircuitState;
      if (
        parsed.state !== 'closed' &&
        parsed.state !== 'open' &&
        parsed.state !== 'half_open'
      ) {
        return { ...DEFAULT_STATE };
      }
      return {
        state: parsed.state,
        failures: Math.max(0, Number(parsed.failures) || 0),
        openedAtMs:
          parsed.openedAtMs == null ? null : Number(parsed.openedAtMs),
        halfOpenEnteredAtMs:
          parsed.halfOpenEnteredAtMs == null
            ? null
            : Number(parsed.halfOpenEnteredAtMs),
      };
    } catch (err) {
      this.logger.warn(
        `Circuit read fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ...DEFAULT_STATE };
    }
  }

  private async writeState(state: PersistedCircuitState): Promise<void> {
    try {
      await this.redis.client.set(REDIS_KEY, JSON.stringify(state));
    } catch (err) {
      this.logger.warn(
        `Circuit write skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Cho phép thử initiate checkout (half-open probe hoặc closed).
   * Khi đang Open và chưa hết cooldown → graceful hoặc block.
   */
  async evaluateInitiateGate(): Promise<PaymentInitiateGate> {
    if (!this.enabled()) {
      return { kind: 'allow' };
    }

    let state = await this.readState();
    const now = Date.now();
    const resetMs = this.resetMs();

    if (state.state === 'open') {
      const openedAt = state.openedAtMs ?? now;
      const elapsed = now - openedAt;
      if (elapsed < resetMs) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((resetMs - elapsed) / 1000),
        );
        return this.gracefulOrBlock(retryAfterSeconds);
      }

      state = {
        state: 'half_open',
        failures: state.failures,
        openedAtMs: null,
        halfOpenEnteredAtMs: now,
      };
      await this.writeState(state);
      return { kind: 'allow' };
    }

    return { kind: 'allow' };
  }

  private gracefulOrBlock(retryAfterSeconds: number): PaymentInitiateGate {
    const message = this.blockMessage();
    if (this.gracefulHttpResponse()) {
      return { kind: 'graceful', retryAfterSeconds, message };
    }
    return { kind: 'block', retryAfterSeconds, message };
  }

  /** Sau initiate hoặc webhook thành công — đóng breaker / reset lỗi. */
  async recordCheckoutSuccess(): Promise<void> {
    if (!this.enabled()) return;
    await this.writeState({ ...DEFAULT_STATE });
  }

  /** Lỗi hạ tầng khi gọi cổng (timeout, 5xx health check, …). */
  async recordInfrastructureFailure(): Promise<void> {
    if (!this.enabled()) return;

    const state = await this.readState();
    const now = Date.now();
    const threshold = this.threshold();

    if (state.state === 'half_open') {
      await this.writeState({
        state: 'open',
        failures: threshold,
        openedAtMs: now,
        halfOpenEnteredAtMs: null,
      });
      return;
    }

    const failures = state.failures + 1;
    if (failures >= threshold) {
      await this.writeState({
        state: 'open',
        failures,
        openedAtMs: now,
        halfOpenEnteredAtMs: null,
      });
    } else {
      await this.writeState({
        ...state,
        state: 'closed',
        failures,
        openedAtMs: null,
        halfOpenEnteredAtMs: null,
      });
    }
  }

  /** Sau health-check outbound thất bại — phản hồi graceful hoặc block với message riêng. */
  infrastructureUnavailableGate(
    retryAfterSeconds: number,
    message: string,
  ): PaymentInitiateGate {
    if (this.gracefulHttpResponse()) {
      return { kind: 'graceful', retryAfterSeconds, message };
    }
    return { kind: 'block', retryAfterSeconds, message };
  }
}
