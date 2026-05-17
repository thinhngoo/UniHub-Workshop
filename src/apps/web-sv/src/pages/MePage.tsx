import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Ticket } from 'lucide-react';
import type { RoleCode, User } from '@unihub/types';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@unihub/format';
import { cn } from '@unihub/format/cn';

const ROLE_LABEL: Record<RoleCode, string> = {
  student: 'Sinh viên',
  organizer: 'Ban tổ chức',
  staff: 'Nhân sự / check-in',
  admin: 'Quản trị',
};

const STATUS_LABEL: Record<User['status'], string> = {
  active: 'Hoạt động',
  disabled: 'Tạm khóa',
};

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4', className)}>
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 sm:w-40">
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function MePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Không có dữ liệu tài khoản. Hãy đăng xuất và đăng nhập lại.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tài khoản</h1>
        <p className="text-sm text-slate-500">Thông tin hiển thị công khai trên cổng đăng ký.</p>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <p className="text-lg font-semibold text-slate-900">{user.fullName}</p>
            <p className="text-sm text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>

          <dl className="space-y-4">
            <InfoRow
              label="Mã sinh viên"
              value={user.studentCode?.trim() ? user.studentCode : '—'}
            />
            <InfoRow label="Vai trò" value={ROLE_LABEL[user.role]} />
            <InfoRow label="Trạng thái" value={STATUS_LABEL[user.status]} />
            <InfoRow label="Tài khoản tạo lúc" value={formatDateTime(user.createdAt)} />
          </dl>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Lối tắt</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            to="/workshops"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50/50"
          >
            <CalendarDays className="size-4 text-brand-600" />
            Lịch workshop
          </Link>
          <Link
            to="/me/registrations"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50/50"
          >
            <Ticket className="size-4 text-brand-600" />
            Đăng ký của tôi
          </Link>
          <Link
            to="/me/notifications"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50/50"
          >
            <Bell className="size-4 text-brand-600" />
            Thông báo
          </Link>
        </div>
      </div>
    </div>
  );
}
