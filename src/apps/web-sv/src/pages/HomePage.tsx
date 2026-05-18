import { Link } from 'react-router-dom';
import { Bell, CalendarDays, ScanLine, User } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@unihub/format/cn';

const features = [
  {
    icon: CalendarDays,
    title: 'Lịch workshop',
    desc: 'Xem số chỗ, diễn giả, phòng và sơ đồ phòng.',
    to: '/workshops',
  },
  {
    icon: User,
    title: 'Tài khoản',
    desc: 'Thông tin tài khoản công khai.',
    to: '/me',
  },
  {
    icon: ScanLine,
    title: 'Đăng ký và check-in',
    desc: 'Đăng ký và check-in workshop một cách dễ dàng và nhanh chóng.',
    to: '/me/registrations',
  },
  {
    icon: Bell,
    title: 'Thông báo',
    desc: 'Đăng ký, thanh toán và các cập nhật của bạn.',
    to: '/me/notifications',
  },
] as const;

export function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-3xl bg-linear-to-br from-brand-600 via-brand-500 to-brand-700 px-6 py-16 sm:px-12 text-white shadow-lg">
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
        {features.map(({ icon: Icon, title, desc, to }) => (
          <Link
            key={title}
            to={to}
            className={cn(
              'group rounded-xl outline-none ring-offset-2 ring-offset-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500',
            )}
          >
            <Card className="h-full cursor-pointer transition-colors hover:border-brand-200 hover:shadow-sm">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 transition-colors group-hover:bg-brand-200">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
