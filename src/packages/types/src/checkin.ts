import type { ISODateString, UUID } from './common.js';

export interface CheckIn {
  id: UUID;
  registrationId: UUID;
  clientEventId: UUID;
  scannedAt: ISODateString;
  receivedAt: ISODateString;
  staffUserId: UUID;
}

export interface CheckInBatchItem {
  clientEventId: UUID;
  qrToken: string;
  scannedAt: ISODateString;
}

export interface CheckInBatchRequest {
  items: CheckInBatchItem[];
}

export type CheckInBatchItemStatus =
  | 'accepted'
  | 'duplicate'
  | 'invalid_qr'
  | 'not_registered'
  | 'cancelled';

export interface CheckInBatchItemResult {
  clientEventId: UUID;
  status: CheckInBatchItemStatus;
  registrationId: UUID | null;
  message: string | null;
}

export interface CheckInBatchResponse {
  results: CheckInBatchItemResult[];
}
