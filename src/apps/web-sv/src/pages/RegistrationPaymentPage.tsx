import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

export function RegistrationPaymentPage() {
  const { id: registrationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [payError, setPayError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  const paymentQuery = useQuery({
    queryKey: ['registration-payment', registrationId],
    queryFn: () => api.registrations.getPaymentForRegistration(registrationId!),
    enabled: !!registrationId,
    retry: false,
  });

  const payMutation = useMutation({
    mutationFn: () => api.payments.initiate({ registrationId: registrationId! }, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registration-payment', registrationId] });
      qc.invalidateQueries({ queryKey: ['my-registrations'] });
      void navigate(`/me/registrations/${registrationId}/qr`, { replace: true });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) setPayError(e.message);
      else setPayError('Không thực hiện được thanh toán. Vui lòng thử lại.');
    },
  });

  const pay = () => {
    setPayError(null);
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
