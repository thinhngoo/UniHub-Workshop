import type { AxiosInstance } from 'axios';
import type { InitiatePaymentRequest, InitiatePaymentResponse, Payment, UUID } from '@unihub/types';
import { withIdempotencyKey } from '../idempotency';

export const paymentsApi = (http: AxiosInstance) => ({
  initiate: (body: InitiatePaymentRequest, idempotencyKey?: string) =>
    http
      .post<InitiatePaymentResponse>('/payments', body, {
        headers: withIdempotencyKey({}, idempotencyKey),
      })
      .then((r) => r.data),
  getById: (id: UUID) => http.get<Payment>(`/payments/${id}`).then((r) => r.data),
});
