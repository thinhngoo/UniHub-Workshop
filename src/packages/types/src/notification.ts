import type { ISODateString, UUID } from './common.js';

export type NotificationChannel = 'app' | 'email';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface NotificationMessage {
  id: UUID;
  userId: UUID;
  channel: NotificationChannel;
  templateCode: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  attemptCount: number;
  createdAt: ISODateString;
  sentAt: ISODateString | null;
}
