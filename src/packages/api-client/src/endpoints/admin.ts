import type { AxiosInstance } from 'axios';
import type {
  AdminDashboardSummary,
  StudentSyncJobStatusResponse,
  StudentSyncQueuedResponse,
} from '@unihub/types';

export const adminApi = (http: AxiosInstance) => ({
  dashboard: () => http.get<AdminDashboardSummary>('/admin/dashboard').then((r) => r.data),

  syncStudents: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<StudentSyncQueuedResponse>('/student-sync', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000,
      })
      .then((r) => r.data);
  },

  syncStudentsJobStatus: (jobId: string) =>
    http
      .get<StudentSyncJobStatusResponse>(`/student-sync/jobs/${encodeURIComponent(jobId)}`)
      .then((r) => r.data),
});
