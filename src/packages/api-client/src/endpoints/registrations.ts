import type { AxiosInstance } from 'axios';
import type {
  CreateRegistrationRequest,
  CreateRegistrationResponse,
  Payment,
  Registration,
  UUID,
} from '@unihub/types';
import { withIdempotencyKey } from '../idempotency';

export const registrationsApi = (http: AxiosInstance) => ({
  listMine: () => http.get<Registration[]>('/registrations/me').then((r) => r.data),
  create: (body: CreateRegistrationRequest, idempotencyKey?: string) =>
    http
      .post<CreateRegistrationResponse>('/registrations', body, {
        headers: withIdempotencyKey({}, idempotencyKey),
      })
      .then((r) => r.data),
  getPaymentForRegistration: (registrationId: UUID) =>
    http.get<Payment>(`/registrations/${registrationId}/payment`).then((r) => r.data),
  getQr: (id: UUID) =>
    http
      .get<{ qrToken: string; qrImageUrl: string }>(`/registrations/${id}/qr`)
      .then((r) => r.data),
  // Organizer/admin scope
  listByWorkshop: (workshopId: UUID) =>
    http.get<Registration[]>(`/workshops/${workshopId}/registrations`).then((r) => r.data),
});
