import type { AxiosInstance } from 'axios';
import type { AdminDashboardSummary } from '@unihub/types';

export const adminApi = (http: AxiosInstance) => ({
  dashboard: () =>
    http.get<AdminDashboardSummary>('/admin/dashboard').then((r) => r.data),
});
