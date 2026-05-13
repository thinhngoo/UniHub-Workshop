import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, QrCode } from 'lucide-react';
import type { Registration } from '@unihub/types';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

const STATUS_TONE: Record<Registration['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  confirmed: 'success',
  reserved: 'warning',
  expired: 'danger',
  cancelled: 'neutral',
};

const STATUS_LABEL: Record<Registration['status'], string> = {
  confirmed: 'Đã xác nhận',
  reserved: 'Đang giữ chỗ',
  expired: 'Hết hạn giữ chỗ',
  cancelled: 'Đã hủy',
};

export function MyRegistrationsPage() {
  const query = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => api.registrations.listMine(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Workshop đã đăng ký</h1>
        <p className="text-sm text-slate-500">
          Tất cả workshop bạn đã đặt chỗ. Mã QR check-in chỉ dùng được khi đăng ký được xác nhận.
        </p>
      </div>

      {query.isPending && <p className="text-sm text-slate-500">Đang tải…</p>}
      {query.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Không tải được danh sách đăng ký.
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Bạn chưa đăng ký workshop nào.{' '}
          <Link to="/workshops" className="text-brand-600 hover:underline">
            Xem lịch workshop
          </Link>
        </div>
      )}

      <div className="grid gap-3">
        {query.data?.map((reg) => (
          <Card key={reg.id}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[reg.status]}>{STATUS_LABEL[reg.status]}</Badge>
                </div>
                <h3 className="font-semibold text-slate-900">
                  {reg.workshop?.title ?? 'Workshop'}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {reg.workshop && (
                    <>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-4 text-slate-400" />
                        {formatDateTime(reg.workshop.startsAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-4 text-slate-400" />
                        {reg.workshop.room}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {reg.status === 'confirmed' ? (
                <Link
                  to={`/me/registrations/${reg.id}/qr`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <QrCode className="size-4" /> Xem mã QR
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
