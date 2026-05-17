import type { AxiosInstance } from 'axios';
import type {
  CreateWorkshopRequest,
  PaginatedResponse,
  UpdateWorkshopRequest,
  UUID,
  Workshop,
  WorkshopListQuery,
  WorkshopSummaryJobStatusResponse,
  WorkshopSummaryQueuedResponse,
} from '@unihub/types';

export const workshopsApi = (http: AxiosInstance) => ({
  list: (query: WorkshopListQuery = {}) =>
    http
      .get<PaginatedResponse<Workshop>>('/workshops', { params: query })
      .then((r) => r.data),
  getById: (id: UUID) => http.get<Workshop>(`/workshops/${id}`).then((r) => r.data),
  create: (body: CreateWorkshopRequest) =>
    http.post<Workshop>('/workshops', body).then((r) => r.data),
  update: (id: UUID, body: UpdateWorkshopRequest) =>
    http.patch<Workshop>(`/workshops/${id}`, body).then((r) => r.data),
  remove: (id: UUID) =>
    http.delete(`/workshops/${id}`).then(() => undefined),
  cancel: (id: UUID, version: number) =>
    http
      .post<Workshop>(`/workshops/${id}/cancel`, { version })
      .then((r) => r.data),
  uploadPdf: (id: UUID, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<{ fileKey: string }>(`/workshops/${id}/pdf`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  triggerSummary: (id: UUID, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<WorkshopSummaryQueuedResponse>(`/workshops/${id}/summary`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  getSummaryJobStatus: (jobId: string) =>
    http
      .get<WorkshopSummaryJobStatusResponse>(
        `/workshops/summary-jobs/${encodeURIComponent(jobId)}`,
      )
      .then((r) => r.data),
});
