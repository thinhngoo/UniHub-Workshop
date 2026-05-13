import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import type { WorkshopStatus } from '@unihub/types';
import { api } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn, formatCurrencyVND, formatDateTime } from '@/lib/utils';

const STATUS_TONE: Record<WorkshopStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  published: 'success',
  draft: 'warning',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<WorkshopStatus, string> = {
  published: 'Đang mở',
  draft: 'Nháp',
  cancelled: 'Đã hủy',
};

export function WorkshopsPage() {
  const query = useQuery({
    queryKey: ['admin-workshops'],
    queryFn: () => api.workshops.list({ pageSize: 100 }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workshop</h1>
          <p className="text-sm text-slate-500">Quản lý lịch, sức chứa và trạng thái workshop.</p>
        </div>

        <Link to="/workshops/new" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          Tạo workshop
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Phòng</th>
                <th className="px-4 py-3 font-medium">Chỗ</th>
                <th className="px-4 py-3 font-medium">Phí</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.isPending && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Đang tải…
                  </td>
                </tr>
              )}
              {query.isSuccess && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Chưa có workshop nào.
                  </td>
                </tr>
              )}
              {items.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{w.title}</p>
                    <p className="text-xs text-slate-500">{w.speaker}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(w.startsAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{w.room}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {w.seatsLeft}/{w.capacity}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {w.isPaid ? formatCurrencyVND(w.price) : 'Miễn phí'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[w.status]}>{STATUS_LABEL[w.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/workshops/${w.id}/edit`}>
                      <Button variant="ghost" size="sm" className="cursor-pointer">
                        <Pencil className="h-4 w-4" />
                        Sửa
                      </Button>
                    </Link>
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
