import type { ISODateString, UUID } from './common.js';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Payment {
  id: UUID;
  registrationId: UUID;
  amount: number;
  status: PaymentStatus;
  attemptCount: number;
  providerTxnId: string | null;
  lastError: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface InitiatePaymentRequest {
  registrationId: UUID;
  /** URL trở về sau checkout redirect (SPA); server chỉ chấp nhận khi khớp PAYMENT_RETURN_URL_ALLOWLIST. */
  returnUrl?: string;
}

export interface InitiatePaymentResponse {
  payment: Payment;
  redirectUrl: string | null;
  /** HTTP 200 — graceful degradation khi circuit breaker chặn initiate */
  degraded?: boolean;
  retryAfterSeconds?: number;
  userMessage?: string;
  /** open = đang trong cooldown circuit */
  circuitState?: 'open';
}
