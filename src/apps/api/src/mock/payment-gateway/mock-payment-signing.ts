import { createHmac, timingSafeEqual } from 'node:crypto';

export type MockWebhookSucceeded = {
  event: 'payment.succeeded';
  paymentId: string;
  providerTxnId: string;
};

export type MockWebhookFailed = {
  event: 'payment.failed';
  paymentId: string;
  failureReason: string;
};

export type MockWebhookPayload = MockWebhookSucceeded | MockWebhookFailed;

export function canonicalWebhookPayload(payload: MockWebhookPayload): string {
  const keys = Object.keys(payload).sort() as (keyof MockWebhookPayload)[];
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    ordered[k] = payload[k];
  }
  return JSON.stringify(ordered);
}

export function signMockWebhook(
  secret: string,
  payload: MockWebhookPayload,
): string {
  return createHmac('sha256', secret)
    .update(canonicalWebhookPayload(payload))
    .digest('hex');
}

export function verifyMockWebhook(
  secret: string,
  payload: MockWebhookPayload,
  signatureHex: string,
): boolean {
  const expectedHex = signMockWebhook(secret, payload);
  try {
    const a = Buffer.from(signatureHex.trim(), 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseMockWebhookPayload(
  body: unknown,
): MockWebhookPayload | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const event = o.event;
  const paymentId = o.paymentId;
  if (typeof paymentId !== 'string' || paymentId.length === 0) return null;

  if (event === 'payment.succeeded') {
    const providerTxnId = o.providerTxnId;
    if (typeof providerTxnId !== 'string' || providerTxnId.length === 0) {
      return null;
    }
    return { event: 'payment.succeeded', paymentId, providerTxnId };
  }

  if (event === 'payment.failed') {
    const failureReason = o.failureReason;
    if (typeof failureReason !== 'string') return null;
    return { event: 'payment.failed', paymentId, failureReason };
  }

  return null;
}
