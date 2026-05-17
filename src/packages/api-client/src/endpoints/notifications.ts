import type { AxiosInstance } from 'axios';
import type { NotificationMessage } from '@unihub/types';

export const notificationsApi = (http: AxiosInstance) => ({
  listMine: () => http.get<NotificationMessage[]>('/notifications/me').then((r) => r.data),
});
