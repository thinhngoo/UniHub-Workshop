import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export interface MockCheckoutSession {
  sessionId: string;
  paymentId: string;
  amount: number;
  /** HTTP(S) của SPA để redirect sau webhook (đã validate allowlist). */
  returnUrl?: string;
}

/**
 * In-memory checkout sessions for the mock gateway (dev / integration tests).
 * Restarting the API clears pending sessions.
 */
@Injectable()
export class MockPaymentSessionStore {
  private readonly sessions = new Map<string, MockCheckoutSession>();

  createSession(paymentId: string, amount: number, returnUrl?: string): string {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      paymentId,
      amount,
      ...(returnUrl ? { returnUrl } : {}),
    });
    return sessionId;
  }

  get(sessionId: string): MockCheckoutSession | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
