import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, Image as ImageIcon, MapPin, Users } from 'lucide-react';
import { ApiError, generateIdempotencyKey } from '@unihub/api-client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { formatCurrencyVND, formatDateTime } from '@unihub/format';

export function WorkshopDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAuthenticated, isReady } = useAuth();

  const [idempotencyKey] = useState(() => generateIdempotencyKey());
  const [error, setError] = useState<string | null>(null);

  const workshopQuery = useQuery({
    queryKey: ['workshop', id],
    queryFn: () => api.workshops.getById(id!),
    enabled: !!id,
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      api.registrations.create({ workshopId: id! }, idempotencyKey),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['workshop', id] });
      qc.invalidateQueries({ queryKey: ['my-registrations'] });
      if (res.paymentRequired) {
        navigate(`/me/registrations/${res.registration.id}/payment`);
      } else {
        navigate(`/me/registrations/${res.registration.id}/qr`);
      }
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) setError(e.message);
      else setError('Không thể đăng ký. Vui lòng thử lại.');
    },
  });

  const workshop = workshopQuery.data;
  const seatsTone = useMemo(() => {
    if (!workshop) return 'neutral' as const;
    if (workshop.seatsLeft === 0) return 'danger' as const;
    if (workshop.seatsLeft <= Math.max(5, workshop.capacity * 0.1)) return 'warning' as const;
    return 'success' as const;
  }, [workshop]);

  if (workshopQuery.isPending) {
    return <div className="text-sm text-slate-500">Đang tải…</div>;
  }
  if (workshopQuery.isError || !workshop) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Không tìm thấy workshop.
      </div>
    );
  }

  const handleRegister = () => {
    setError(null);
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/workshops/${id}` } } });
      return;
    }
    registerMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Link
        to="/workshops"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="order-1 lg:order-0 lg:col-span-2">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {workshop.isPaid ? (
                <Badge tone="info">{formatCurrencyVND(workshop.price ?? 0)}</Badge>
              ) : (
                <Badge tone="success">Miễn phí</Badge>
              )}
              <Badge tone={seatsTone}>
                Còn {workshop.seatsLeft}/{workshop.capacity} chỗ
              </Badge>
            </div>
            <CardTitle className="text-2xl">{workshop.title}</CardTitle>
            <p className="text-sm text-slate-600">Diễn giả: {workshop.speaker}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              {formatDateTime(workshop.startsAt)} – {formatDateTime(workshop.endsAt)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              {workshop.room}
              {workshop.roomMapUrl && (
                <a
                  href={workshop.roomMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  (Xem sơ đồ phòng)
                </a>
              )}
            </p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              Sức chứa {workshop.capacity} sinh viên
            </p>
          </CardContent>
        </Card>

        <Card className="order-2 h-fit self-start lg:order-0 lg:row-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Đăng ký tham gia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              {workshop.isPaid
                ? 'Sau khi đăng ký, bạn cần hoàn tất thanh toán trong thời gian giữ chỗ để được tham gia.'
                : 'Đăng ký xong để được tham gia.'}
            </p>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              size="lg"
              className="w-full cursor-pointer"
              disabled={workshop.seatsLeft === 0 || registerMutation.isPending}
              onClick={handleRegister}
            >
              {registerMutation.isPending
                ? 'Đang đăng ký…'
                : workshop.seatsLeft === 0
                  ? 'Đã hết chỗ'
                  : 'Đăng ký ngay'}
            </Button>
          </CardContent>
        </Card>

        <Card className="order-3 lg:order-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-brand-600" />
              Giới thiệu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workshop.summaryStatus === 'ready' && workshop.summary ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {workshop.summary}
              </p>
            ) : workshop.summaryStatus === 'pending' ? (
              <p className="text-sm text-slate-500">
                Đang xử lý giới thiệu — vui lòng quay lại sau ít phút.
              </p>
            ) : workshop.summaryStatus === 'failed' ? (
              <p className="text-sm text-amber-700">
                Tạm thời chưa có bản giới thiệu. Bạn vẫn có thể xem thông tin chi tiết bên trên.
              </p>
            ) : (
              <p className="text-sm text-slate-500">Chưa có giới thiệu cho workshop này.</p>
            )}
          </CardContent>
        </Card>

        {workshop.roomMapUrl ? (
          <Card className="order-4 lg:order-0 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-brand-600" aria-hidden />
                Ảnh & sơ đồ phòng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <img
                src={workshop.roomMapUrl}
                alt={`Ảnh hoặc sơ đồ phòng — ${workshop.room}`}
                className="max-h-[min(480px,70vh)] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                loading="lazy"
              />
              <p className="text-xs text-slate-500">
                Bạn cũng có thể{' '}
                <a
                  href={workshop.roomMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  mở liên kết trong tab mới
                </a>
                .
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
