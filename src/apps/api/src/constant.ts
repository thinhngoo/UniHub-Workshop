import type { SummaryStatus, WorkshopStatus } from '@unihub/types';

export const WORKSHOP_STATUSES: readonly WorkshopStatus[] = [
  'draft',
  'published',
  'cancelled',
];

export const SUMMARY_STATUSES: readonly SummaryStatus[] = [
  'none',
  'pending',
  'ready',
  'failed',
];

export const SESSION_COOKIE = 'unihub_session';
export const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
export const SESSION_ID_RANDOM_BYTES = 16;
export const REFRESH_COOKIE = 'unihub_refresh';
export const REFRESH_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;
export const JWT_ACCESS_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '30d';

export const SESSION_REDIS_KEY_PREFIX = 'session:';
export const REDIS_DEFAULT_URL = 'redis://127.0.0.1:6379';

export const STUDENT_SYNC_QUEUE = 'student-sync';
export const STUDENT_SYNC_JOB_NAME = 'run';
export const STUDENT_SYNC_MAX_FILE_BYTES = 12 * 1024 * 1024; // 12MB

export const WORKSHOP_SUMMARY_QUEUE = 'workshop-summary';
export const WORKSHOP_SUMMARY_JOB_NAME = 'extract-from-pdf';
export const WORKSHOP_SUMMARY_MAX_PDF_BYTES = 12 * 1024 * 1024; // 12MB

export const NOTIFICATION_QUEUE = 'notifications';
export const NOTIFICATION_DISPATCH_JOB_NAME = 'dispatch';

export const RESERVATION_HOLD_MINUTES = 15;

export const RESERVATION_EXPIRY_QUEUE = 'reservation-expiry';
export const RESERVATION_EXPIRY_JOB_NAME = 'release-hold';
