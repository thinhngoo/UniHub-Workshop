import type { ISODateString, UUID } from './common.js';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface NotificationMessage {
  id: UUID;
  userId: UUID;
  templateCode: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  createdAt: ISODateString;
  sentAt: ISODateString | null;
}
