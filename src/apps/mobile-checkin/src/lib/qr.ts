import Constants from 'expo-constants';

/**
 * Local QR verification.
 *
 * In the real system the QR encodes a JWS / HMAC token signed by the server,
 * which staff verify offline with a per-shift secret. For this mock backend
 * the token is a plain string with a known prefix — verification is a sanity
 * check on shape so the scanner doesn't enqueue obvious garbage into the
 * outbox.
 */
function resolveQrTokenPrefix(): string {
  const fromExtra = (
    Constants.expoConfig?.extra as { qrTokenPrefix?: string } | undefined
  )?.qrTokenPrefix?.trim();
  if (fromExtra) return fromExtra;
  return 'qrtok_';
}

const TOKEN_PREFIX = resolveQrTokenPrefix();
const MAX_LENGTH = 256;

export interface QrVerifyResult {
  ok: boolean;
  token: string;
  reason?: string;
}

export function verifyQr(raw: string): QrVerifyResult {
  const token = raw.trim();

  if (!token) {
    return { ok: false, token, reason: 'QR rỗng.' };
  }
  if (token.length > MAX_LENGTH) {
    return { ok: false, token, reason: 'Mã QR quá dài.' };
  }
  if (!token.startsWith(TOKEN_PREFIX)) {
    return {
      ok: false,
      token,
      reason: `Không phải mã QR hợp lệ.`,
    };
  }
  return { ok: true, token };
}
