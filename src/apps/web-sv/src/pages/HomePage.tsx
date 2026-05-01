import { Link } from 'react-router-dom';
import { CalendarDays, ScanLine, ShieldCheck } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: CalendarDays,
    title: 'Lịch workshop',
    desc: 'Xem số chỗ, diễn giả, phòng và sơ đồ phòng.',
  },
  {
    icon: ScanLine,
    title: 'Mã QR check-in',
    desc: 'Sau khi đăng ký, nhận mã QR cá nhân để check-in.',
  },
  {
    icon: ShieldCheck,
    title: 'Thanh toán',
    desc: 'Thanh toán trực tiếp qua hệ thống thanh toán của trường.',
  },
];

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-3xl bg-linear-to-br from-brand-600 via-brand-500 to-brand-700 px-6 py-16 sm:px-12 text-white shadow-lg cursor-default">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            Tuần lễ kỹ năng và nghề nghiệp
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Đăng ký workshop, chọn chỗ, nhận mã QR — chỉ trong vài giây.
          </h1>
          <p className="text-base sm:text-lg text-brand-50/90">
            Chào mừng bạn đến với hệ thống đăng ký “Tuần lễ Kỹ năng và Nghề nghiệp” của Trường Đại
            học Khoa học tự nhiên — nơi quy tụ các workshop đa dạng, giúp sinh viên phát triển kỹ
            năng và định hướng nghề nghiệp trong môi trường học tập năng động.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/workshops"
              className={cn(buttonVariants({ size: 'lg', variant: 'secondary' }), 'text-brand-700')}
            >
              Xem lịch workshop
            </Link>
            <Link
              to="/login"
              className={cn(
                buttonVariants({ size: 'lg', variant: 'ghost' }),
                'text-white hover:bg-white/10',
              )}
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="cursor-pointer">
            <CardContent className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
