/**
 * Generate a UUIDv4 for each user "intent" (e.g. one click of "Pay") and reuse
 * it across all retries of that intent so the server can dedupe.
 */
interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
}

function getCrypto(): CryptoLike | undefined {
  return typeof globalThis !== 'undefined' && 'crypto' in globalThis
    ? (globalThis.crypto as CryptoLike)
    : undefined;
}

export function generateIdempotencyKey(): string {
  const c = getCrypto();
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

export function withIdempotencyKey(
  headers: Record<string, string> = {},
  key?: string,
): Record<string, string> {
  return { ...headers, 'Idempotency-Key': key ?? generateIdempotencyKey() };
}
