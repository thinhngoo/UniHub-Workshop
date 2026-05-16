export const SESSION_COOKIE = 'unihub_session';
export const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
export const SESSION_ID_RANDOM_BYTES = 16;
export const REFRESH_COOKIE = 'unihub_refresh';
export const REFRESH_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
export const JWT_ACCESS_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '30d';

export const SESSION_REDIS_KEY_PREFIX = 'session:';
export const REDIS_DEFAULT_URL = 'redis://127.0.0.1:6379';
