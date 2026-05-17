/** Presets for `@Throttle(...)` — keys match default throttler name `'default'`. TTL in ms. */
export const THROTTLE_AUTH_LOGIN = {
  default: { limit: 10, ttl: 60_000 },
} as const;

export const THROTTLE_AUTH_REFRESH = {
  default: { limit: 30, ttl: 60_000 },
} as const;

export const THROTTLE_REGISTRATION_CREATE = {
  default: { limit: 20, ttl: 60_000 },
} as const;

export const THROTTLE_PAYMENT_INITIATE = {
  default: { limit: 15, ttl: 60_000 },
} as const;

export const THROTTLE_STUDENT_SYNC_UPLOAD = {
  default: { limit: 5, ttl: 60_000 },
} as const;
