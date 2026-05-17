import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { NotificationMessage } from '@unihub/types';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrencyVND, formatDateTime } from '@unihub/format';

const STATUS_TONE: Record<
  NotificationMessage['status'],
  'warning' | 'success' | 'danger'
> = {
  pending: 'warning',
  sent: 'success',
  failed: 'danger',
};

const STATUS_LABEL: Record<NotificationMessage['status'], string> = {
  pending: 'Đang chờ gửi',
  sent: 'Đã gửi',
  failed: 'Gửi thất bại',
};

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function describeNotification(n: NotificationMessage): {
  title: string;
  detail?: string | null;
} {
  const { templateCode, payload } = n;
  const workshopTitle =
    payloadString(payload, 'workshopTitle') ?? 'Workshop của bạn';

  if (templateCode === 'registration_success') {
    return {
      title: 'Đăng ký workshop thành công',
      detail: `"${workshopTitle}" đã được ghi nhận.`,
    };
  }

  if (templateCode === 'payment_success') {
    const amt = payload.amount;
    const amountStr =
      typeof amt === 'number'
        ? formatCurrencyVND(amt)
        : typeof amt === 'string'
          ? formatCurrencyVND(Number(amt))
          : '';
    return {
      title: 'Thanh toán thành công',
      detail: amountStr
        ? `Đã thanh toán ${amountStr} cho "${workshopTitle}". Đăng ký của bạn đã được xác nhận.`
        : `Đăng ký cho "${workshopTitle}" đã được xác nhận.`,
    };
  }

  return {
    title: templateCode.replace(/_/g, ' '),
    detail: null,
  };
}

export function NotificationsPage() {
  const query = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => api.notifications.listMine(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thông báo</h1>
        <p className="text-sm text-slate-500">
          Tin mới nhất liên quan đến đăng ký và thanh toán workshop của bạn.
        </p>
      </div>

      {query.isPending && <p className="text-sm text-slate-500">Đang tải…</p>}
      {query.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Không tải được thông báo. Thử làm mới trang hoặc đăng nhập lại.
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Chưa có thông báo nào.{' '}
          <Link to="/workshops" className="text-brand-600 hover:underline">
            Xem lịch workshop
          </Link>
        </div>
      )}

      <div className="grid gap-3">
        {query.data?.map((n) => {
          const { title, detail } = describeNotification(n);
          const workshopId = payloadString(n.payload, 'workshopId');
          const registrationId = payloadString(n.payload, 'registrationId');

          return (
            <Card key={n.id}>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[n.status]}>{STATUS_LABEL[n.status]}</Badge>
                  </div>
                  <h2 className="font-semibold text-slate-900">{title}</h2>
                  {detail ? (
                    <p className="text-sm leading-relaxed text-slate-600">{detail}</p>
                  ) : (
                    <p className="text-xs text-slate-400">{n.templateCode}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{formatDateTime(n.createdAt)}</span>
                    {n.sentAt ? <span>Đã phát • {formatDateTime(n.sentAt)}</span> : null}
                  </div>

                  {(workshopId || registrationId) && (
                    <div className="flex flex-wrap gap-3 pt-1 text-sm">
                      {workshopId ? (
                        <Link
                          to={`/workshops/${workshopId}`}
                          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                        >
                          Xem workshop <ArrowRight className="size-3.5" />
                        </Link>
                      ) : null}
                      {registrationId ? (
                        <Link
                          to={`/me/registrations/${registrationId}/qr`}
                          className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                        >
                          Xem mã QR <ArrowRight className="size-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
