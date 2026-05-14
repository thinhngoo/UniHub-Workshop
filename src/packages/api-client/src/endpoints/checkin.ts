import type { AxiosInstance } from 'axios';
import type { CheckInBatchRequest, CheckInBatchResponse } from '@unihub/types';
import { withIdempotencyKey } from '../idempotency';

export const checkinApi = (http: AxiosInstance) => ({
  batch: (body: CheckInBatchRequest, idempotencyKey?: string) =>
    http
      .post<CheckInBatchResponse>('/checkin/batch', body, {
        headers: withIdempotencyKey({}, idempotencyKey),
      })
      .then((r) => r.data),
});
