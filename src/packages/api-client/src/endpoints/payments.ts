import type { AxiosInstance } from 'axios';
import type { InitiatePaymentRequest, InitiatePaymentResponse } from '@unihub/types';
import { withIdempotencyKey } from '../idempotency';

export const paymentsApi = (http: AxiosInstance) => ({
  initiate: (body: InitiatePaymentRequest, idempotencyKey?: string) =>
    http
      .post<InitiatePaymentResponse>('/payments', body, {
        headers: withIdempotencyKey({}, idempotencyKey),
      })
      .then((r) => r.data),
});
