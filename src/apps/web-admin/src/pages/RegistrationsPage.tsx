import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Registration, RegistrationStatus } from '@unihub/types';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@unihub/format';

const STATUS_TONE: Record<RegistrationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  confirmed: 'success',
  reserved: 'warning',
  expired: 'danger',
  cancelled: 'neutral',
};

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  confirmed: 'Đã xác nhận',
  reserved: 'Giữ chỗ',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
};

export function RegistrationsPage() {
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');

  const workshopsQuery = useQuery({
    queryKey: ['admin-workshops'],
    queryFn: () => api.workshops.list({ pageSize: 100 }),
  });

  const regsQuery = useQuery({
    queryKey: ['admin-registrations', selectedWorkshopId],
    queryFn: () => api.registrations.listByWorkshop(selectedWorkshopId),
    enabled: !!selectedWorkshopId,
  });

  const items: Registration[] = useMemo(() => regsQuery.data ?? [], [regsQuery.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Đăng ký</h1>
        <p className="text-sm text-slate-500">
          Xem danh sách sinh viên đã đăng ký theo từng workshop.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Workshop:</label>
        <select
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          value={selectedWorkshopId}
          onChange={(e) => setSelectedWorkshopId(e.target.value)}
        >
          <option value="">— Chọn workshop —</option>
          {workshopsQuery.data?.items.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Sinh viên</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Đăng ký lúc</th>
                <th className="px-4 py-3 font-medium">Xác nhận lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!selectedWorkshopId && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Chọn một workshop để xem danh sách đăng ký.
                  </td>
                </tr>
              )}
              {selectedWorkshopId && regsQuery.isPending && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Đang tải…
                  </td>
                </tr>
              )}
              {selectedWorkshopId && regsQuery.isSuccess && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Chưa có đăng ký.
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.userId}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(r.reservedAt)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.confirmedAt ? formatDateTime(r.confirmedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
