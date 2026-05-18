import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function QrPage() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const downloadQrPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-checkin-${id ?? 'registration'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const qrQuery = useQuery({
    queryKey: ['registration-qr', id],
    queryFn: () => api.registrations.getQr(id!),
    enabled: !!id,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Link
        to="/me/registrations"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mã QR check-in</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {qrQuery.isPending && <p className="text-sm text-slate-500">Đang tạo mã…</p>}
          {qrQuery.isError && (
            <p className="text-sm text-red-600">
              Không thể tải mã QR. Có thể đăng ký chưa được xác nhận hoặc đã bị hủy.
            </p>
          )}
          {qrQuery.data && (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <QRCodeCanvas
                  ref={canvasRef}
                  value={qrQuery.data.qrToken}
                  size={256}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="text-center text-xs text-slate-500">
                Xuất trình mã này tại khu vực check-in của workshop.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={downloadQrPng}
                className="cursor-pointer"
              >
                <Download className="size-4" />
                Tải ảnh QR
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
