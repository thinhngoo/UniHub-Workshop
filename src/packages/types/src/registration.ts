import type { ISODateString, UUID } from './common.js';
import type { Workshop } from './workshop.js';

export type RegistrationStatus = 'reserved' | 'confirmed' | 'cancelled' | 'expired';

export interface Registration {
  id: UUID;
  userId: UUID;
  workshopId: UUID;
  status: RegistrationStatus;
  reservedAt: ISODateString;
  expiresAt: ISODateString | null;
  confirmedAt: ISODateString | null;
  qrToken: string | null;
  workshop?: Workshop;
}

export interface CreateRegistrationRequest {
  workshopId: UUID;
}

export interface CreateRegistrationResponse {
  registration: Registration;
  paymentRequired: boolean;
  paymentIntentId: UUID | null;
}
