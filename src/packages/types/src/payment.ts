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
}

export interface InitiatePaymentResponse {
  payment: Payment;
  redirectUrl: string | null;
}
