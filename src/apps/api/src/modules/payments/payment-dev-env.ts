/**
 * Chỉ non-production — bật bằng DEV_PAYMENT_CHAOS_MODE=true.
 * Dùng chung để breaker + PaymentsService có cùng điều kiện.
 */
export function devPaymentChaosEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const v = process.env.DEV_PAYMENT_CHAOS_MODE?.trim().toLowerCase();
  return v === 'true' || v === '1';
}
