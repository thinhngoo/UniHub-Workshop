import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { ApiError, generateIdempotencyKey } from '@unihub/api-client';
import { cn } from '@unihub/format/cn';
import { api } from '@/lib/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyVND, formatDateTime } from '@unihub/format';

const PAYMENT_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  succeeded: 'Đã thanh toán',
  failed: 'Thất bại',
  refunded: 'Đã hoàn tiền',
};

function retryAfterFromUnknown(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : undefined;
}

function nonEmptyText(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

type CircuitPaymentNotice =
  | {
      variant: 'graceful';
      message: string;
      retryAfterSeconds?: number;
    }
  | {
      variant: 'block';
      message: string;
      retryAfterSeconds?: number;
      code?: string;
    };

export function RegistrationPaymentPage() {
  const { id: registrationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [payError, setPayError] = useState<string | null>(null);
  const [circuitNotice, setCircuitNotice] = useState<CircuitPaymentNotice | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!registrationId) return;
    const params = new URLSearchParams(window.location.search);
    const ps = params.get('paymentStatus');
    if (!ps) return;

    void qc.invalidateQueries({ queryKey: ['registration-payment', registrationId] });
    void qc.invalidateQueries({ queryKey: ['my-registrations'] });

    if (ps === 'succeeded') {
      navigate(`/me/registrations/${registrationId}/qr`, { replace: true });
      return;
    }

    if (ps === 'failed') {
      setCircuitNotice(null);
      setPayError(
        'Thanh toán không thành công hoặc đã hủy. Bạn có thể thử lại (giữ chỗ vẫn còn hiệu lực nếu chưa hết hạn).',
      );
      navigate(
        {
          pathname: `/me/registrations/${registrationId}/payment`,
          search: '',
        },
        { replace: true },
      );
    }
  }, [registrationId, navigate, qc]);

  const paymentQuery = useQuery({
    queryKey: ['registration-payment', registrationId],
    queryFn: () => api.registrations.getPaymentForRegistration(registrationId!),
    enabled: !!registrationId,
    retry: false,
  });

  const payMutation = useMutation({
    mutationFn: () => {
      const returnUrl = `${window.location.origin}/me/registrations/${registrationId}/payment`;
      return api.payments.initiate({ registrationId: registrationId!, returnUrl }, idempotencyKey);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['registration-payment', registrationId] });
      qc.invalidateQueries({ queryKey: ['my-registrations'] });

      if (data.degraded) {
        setPayError(null);
        const retry = retryAfterFromUnknown(data.retryAfterSeconds) ?? retryAfterFromUnknown(60);
        const fallback = `Hệ thống thanh toán đang quá tải hoặc tạm ngưng. Vui lòng thử lại sau khoảng ${retry} giây (giữ chỗ vẫn có hiệu lực trong thời gian quy định).`;
        setCircuitNotice({
          variant: 'graceful',
          message: nonEmptyText(data.userMessage) ?? fallback,
          retryAfterSeconds: retry,
        });
        return;
      }

      setCircuitNotice(null);
      setPayError(null);

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      void navigate(`/me/registrations/${registrationId}/qr`, { replace: true });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 503) {
        const retry = retryAfterFromUnknown(e.details?.retryAfterSeconds);
        setPayError(null);
        const fallback503 =
          'Cổng thanh toán không chấp nhận khởi tạo lúc này. Giữ chỗ vẫn có hiệu lực nếu chưa hết hạn — vui lòng thử lại sau.';
        const msg = nonEmptyText(e.message) ?? nonEmptyText(e.details?.userMessage) ?? fallback503;
        setCircuitNotice({
          variant: 'block',
          message: msg,
          retryAfterSeconds: retry,
          code: e.code !== 'unknown_error' ? e.code : undefined,
        });
        return;
      }
      setCircuitNotice(null);
      if (e instanceof ApiError) setPayError(e.message);
      else setPayError('Không thực hiện được thanh toán. Vui lòng thử lại.');
    },
  });

  const pay = () => {
    setPayError(null);
    setCircuitNotice(null);
    payMutation.mutate();
  };

  if (!registrationId) {
    return <p className="text-sm text-red-600">Đăng ký không hợp lệ.</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link
        to="/me/registrations"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách đăng ký
      </Link>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-slate-700" /> Thanh toán workshop
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentQuery.isPending && <p className="text-sm text-slate-500">Đang tải thông tin…</p>}
          {paymentQuery.isError && (
            <p className="text-sm text-red-600">
              Không có giao dịch thanh toán cho đăng ký này, hoặc workshop không có phí.
            </p>
          )}

          {paymentQuery.data && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  tone={
                    paymentQuery.data.status === 'succeeded'
                      ? 'success'
                      : paymentQuery.data.status === 'pending' ||
                          paymentQuery.data.status === 'failed'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {PAYMENT_LABEL[paymentQuery.data.status] ?? paymentQuery.data.status}
                </Badge>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">
                {formatCurrencyVND(paymentQuery.data.amount)}
              </p>
              <p className="text-xs text-slate-500">
                Cập nhật {formatDateTime(paymentQuery.data.updatedAt)}
              </p>

              {paymentQuery.data.status === 'pending' || paymentQuery.data.status === 'failed' ? (
                <>
                  <p className="text-sm text-slate-600">
                    Nhấn nút bên dưới để xác nhận và kích hoạt mã QR check-in.
                  </p>
                  {circuitNotice?.variant === 'graceful' ? (
                    <div
                      role="alert"
                      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                    >
                      <p className="font-medium text-amber-900">Hệ thống thanh toán đang quá tải</p>
                      {circuitNotice.retryAfterSeconds ? (
                        <p className="mt-2 text-xs text-amber-800/90 tabular-nums">
                          Vui lòng thử lại sau khoảng:{' '}
                          <strong>{circuitNotice.retryAfterSeconds}s</strong>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {circuitNotice?.variant === 'block' ? (
                    <div
                      role="alert"
                      className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950"
                    >
                      <p className="font-medium text-orange-900">
                        Hệ thống thanh toán không khả dụng
                      </p>
                      {circuitNotice.retryAfterSeconds ? (
                        <p className="mt-2 text-xs text-orange-900/90 tabular-nums">
                          Retry sau khoảng: <strong>{circuitNotice.retryAfterSeconds}s</strong>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {payError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {payError}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full cursor-pointer"
                    disabled={payMutation.isPending}
                    onClick={pay}
                  >
                    {payMutation.isPending ? 'Đang xử lý…' : 'Hoàn tất thanh toán'}
                  </Button>
                </>
              ) : paymentQuery.data.status === 'succeeded' ? (
                <Link
                  to={`/me/registrations/${registrationId}/qr`}
                  className={cn(
                    buttonVariants({ variant: 'secondary', size: 'md' }),
                    'w-full justify-center text-center',
                  )}
                >
                  Đi đến mã QR check-in
                </Link>
              ) : (
                <p className="text-sm text-slate-600">
                  Trạng thái giao dịch không cho phép thanh toán từ đây.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
