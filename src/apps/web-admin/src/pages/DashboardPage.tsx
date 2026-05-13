import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  CircleDot,
  Clock,
  MapPin,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AdminDashboardSummary,
  AdminDashboardWorkshopRow,
  RegistrationStatus,
  SummaryStatus,
  WorkshopStatus,
} from '@unihub/types';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, formatCurrencyVND, formatDateTime } from '@/lib/utils';

const REGISTRATION_LABEL: Record<RegistrationStatus, string> = {
  confirmed: 'Đã xác nhận',
  reserved: 'Giữ chỗ',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
};

const REGISTRATION_BAR: Record<RegistrationStatus, string> = {
  confirmed: 'bg-emerald-500',
  reserved: 'bg-amber-500',
  expired: 'bg-red-500',
  cancelled: 'bg-slate-400',
};

const REGISTRATION_TONE: Record<RegistrationStatus, 'success' | 'warning' | 'danger' | 'neutral'> =
  {
    confirmed: 'success',
    reserved: 'warning',
    expired: 'danger',
    cancelled: 'neutral',
  };

const WORKSHOP_LABEL: Record<WorkshopStatus, string> = {
  published: 'Đang mở',
  draft: 'Nháp',
  cancelled: 'Đã hủy',
};

const WORKSHOP_BAR: Record<WorkshopStatus, string> = {
  published: 'bg-emerald-500',
  draft: 'bg-amber-500',
  cancelled: 'bg-red-500',
};

const SUMMARY_LABEL: Record<SummaryStatus, string> = {
  none: 'Chưa tạo',
  pending: 'Đang xử lý',
  ready: 'Hoàn tất',
  failed: 'Thất bại',
};

const SUMMARY_BAR: Record<SummaryStatus, string> = {
  none: 'bg-slate-400',
  pending: 'bg-brand-500',
  ready: 'bg-emerald-500',
  failed: 'bg-red-500',
};

export function DashboardPage() {
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.admin.dashboard(),
  });

  if (query.isPending) {
    return <DashboardSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Không tải được dữ liệu. Vui lòng thử lại.
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
          <p className="text-sm text-slate-500">
            Cập nhật lần cuối lúc {formatDateTime(data.generatedAt)}.
          </p>
        </div>
        <Link
          to="/workshops"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          Quản lý workshop <ArrowUpRight className="size-4" />
        </Link>
      </header>

      <KpiRow data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RegistrationBreakdownCard data={data} />
        <WorkshopBreakdownCard data={data} />
      </div>

      <SummaryStatusCard data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <FillRateLeaderboardCard data={data} />
        <UpcomingWorkshopsCard data={data} />
      </div>

      <RecentRegistrationsCard data={data} />
    </div>
  );
}

// ============================================================================
// Sections
// ============================================================================

function KpiRow({ data }: { data: AdminDashboardSummary }) {
  const activeRegistrations =
    statusCount(data.registrations.byStatus, 'confirmed') +
    statusCount(data.registrations.byStatus, 'reserved');

  const cards = [
    {
      icon: CalendarDays,
      label: 'Workshop',
      value: data.workshops.total.toLocaleString('vi-VN'),
      hint: `${statusCount(data.workshops.byStatus, 'published')} đang mở · ${statusCount(data.workshops.byStatus, 'draft')} nháp`,
      tone: 'brand' as const,
    },
    {
      icon: Users,
      label: 'Đăng ký đang hiệu lực',
      value: activeRegistrations.toLocaleString('vi-VN'),
      hint: `Hiện có ${data.registrations.total.toLocaleString('vi-VN')} lượt đăng ký trong hệ thống`,
      tone: 'emerald' as const,
    },
    {
      icon: TrendingUp,
      label: 'Tỷ lệ lấp đầy (đã công bố)',
      value: `${Math.round(data.capacity.fillRate * 100)}%`,
      hint: `${data.capacity.totalSeatsTaken.toLocaleString('vi-VN')} / ${data.capacity.totalCapacity.toLocaleString('vi-VN')} chỗ`,
      progress: data.capacity.fillRate,
      tone: 'amber' as const,
    },
    {
      icon: Wallet,
      label: 'Doanh thu đã xác nhận',
      value: formatCurrencyVND(data.revenue.confirmedRevenueVnd),
      hint: `${data.revenue.paidWorkshopCount} workshop có phí`,
      tone: 'sky' as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  );
}

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  progress?: number;
  tone: 'brand' | 'emerald' | 'amber' | 'sky';
}

const KPI_TONE: Record<KpiCardProps['tone'], string> = {
  brand: 'bg-brand-100 text-brand-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  sky: 'bg-sky-100 text-sky-700',
};

function KpiCard({ icon: Icon, label, value, hint, progress, tone }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-lg',
              KPI_TONE[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        </div>
        {typeof progress === 'number' && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        )}
        <p className="text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function RegistrationBreakdownCard({ data }: { data: AdminDashboardSummary }) {
  const total = data.registrations.total;
  const rows = data.registrations.byStatus;

  return (
    <Card>
      <CardContent className="space-y-4">
        <SectionHeader
          icon={<CircleDot className="size-4 text-slate-400" />}
          title="Đăng ký theo trạng thái"
          subtitle={`${total.toLocaleString('vi-VN')} đăng ký`}
        />

        <SegmentedBar
          segments={rows.map((r) => ({
            key: r.status,
            value: r.count,
            color: REGISTRATION_BAR[r.status],
            label: REGISTRATION_LABEL[r.status],
          }))}
          total={total}
        />

        <ul className="space-y-2">
          {rows.map((row) => {
            const pct = total === 0 ? 0 : (row.count / total) * 100;
            return (
              <li key={row.status} className="flex items-center gap-3 text-sm">
                <span
                  className={cn('h-2.5 w-2.5 shrink-0 rounded-full', REGISTRATION_BAR[row.status])}
                />
                <span className="flex-1 text-slate-700">{REGISTRATION_LABEL[row.status]}</span>
                <span className="font-medium text-slate-900">
                  {row.count.toLocaleString('vi-VN')}
                </span>
                <span className="w-12 text-right text-xs text-slate-500">{pct.toFixed(1)}%</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function WorkshopBreakdownCard({ data }: { data: AdminDashboardSummary }) {
  const total = data.workshops.total;
  const rows = data.workshops.byStatus;

  return (
    <Card>
      <CardContent className="space-y-4">
        <SectionHeader
          icon={<CalendarDays className="size-4 text-slate-400" />}
          title="Workshop theo trạng thái"
          subtitle={`${total} workshop`}
        />

        <SegmentedBar
          segments={rows.map((r) => ({
            key: r.status,
            value: r.count,
            color: WORKSHOP_BAR[r.status],
            label: WORKSHOP_LABEL[r.status],
          }))}
          total={total}
        />

        <ul className="space-y-2">
          {rows.map((row) => {
            const pct = total === 0 ? 0 : (row.count / total) * 100;
            return (
              <li key={row.status} className="flex items-center gap-3 text-sm">
                <span
                  className={cn('h-2.5 w-2.5 shrink-0 rounded-full', WORKSHOP_BAR[row.status])}
                />
                <span className="flex-1 text-slate-700">{WORKSHOP_LABEL[row.status]}</span>
                <span className="font-medium text-slate-900">
                  {row.count.toLocaleString('vi-VN')}
                </span>
                <span className="w-12 text-right text-xs text-slate-500">{pct.toFixed(1)}%</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function SummaryStatusCard({ data }: { data: AdminDashboardSummary }) {
  const total = data.workshops.total;
  const rows = data.workshops.bySummaryStatus;
  const failed = rows.find((r) => r.status === 'failed')?.count ?? 0;
  const pending = rows.find((r) => r.status === 'pending')?.count ?? 0;

  return (
    <Card>
      <CardContent className="space-y-4">
        <SectionHeader
          icon={
            <AlertTriangle
              className={cn('size-4', failed > 0 ? 'text-red-500' : 'text-slate-400')}
            />
          }
          title="Trạng thái tóm tắt bằng AI"
          subtitle={
            failed > 0 ? `${failed} thất bại` : pending > 0 ? `${pending} đang tạo` : 'Đã hoàn tất'
          }
        />
        <SegmentedBar
          segments={rows.map((r) => ({
            key: r.status,
            value: r.count,
            color: SUMMARY_BAR[r.status],
            label: SUMMARY_LABEL[r.status],
          }))}
          total={total}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {rows.map((row) => (
            <div
              key={row.status}
              className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <span className={cn('h-2 w-2 rounded-full', SUMMARY_BAR[row.status])} />
                {SUMMARY_LABEL[row.status]}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{row.count}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FillRateLeaderboardCard({ data }: { data: AdminDashboardSummary }) {
  const rows = data.fillRateByWorkshop;

  return (
    <Card className="min-h-0">
      <CardContent className="flex min-h-0 flex-col space-y-4">
        <SectionHeader
          icon={<TrendingUp className="size-4 text-slate-400" />}
          title="Tỷ lệ lấp đầy theo workshop"
          subtitle={`${rows.length} workshop đang mở`}
        />
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có workshop được công bố.</p>
        ) : (
          <ScrollArea className="max-h-[min(22rem,55vh)]">
            <ul className="space-y-3 pr-3">
              {rows.map((row) => (
                <FillRateRow key={row.workshopId} row={row} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function FillRateRow({ row }: { row: AdminDashboardWorkshopRow }) {
  const taken = row.capacity - row.seatsLeft;
  const pct = Math.round(row.fillRate * 100);
  const barColor =
    row.fillRate >= 0.85 ? 'bg-red-500' : row.fillRate >= 0.6 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="line-clamp-1 font-medium text-slate-900">{row.title}</p>
        <p className="shrink-0 text-xs text-slate-500">
          {taken}/{row.capacity}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-700">{pct}%</span>
      </div>
    </li>
  );
}

function UpcomingWorkshopsCard({ data }: { data: AdminDashboardSummary }) {
  const rows = data.upcomingWorkshops;

  return (
    <Card className="min-h-0">
      <CardContent className="flex min-h-0 flex-col space-y-4">
        <SectionHeader
          icon={<Clock className="size-4 text-slate-400" />}
          title="Sắp diễn ra (14 ngày tới)"
          subtitle={`${rows.length} workshop`}
        />
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Không có workshop nào trong 14 ngày tới.</p>
        ) : (
          <ScrollArea className="max-h-[min(22rem,55vh)]">
            <ul className="divide-y divide-slate-100 pr-3">
              {rows.map((row) => (
                <li
                  key={row.workshopId}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="line-clamp-1 font-medium text-slate-900">{row.title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateTime(row.startsAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {row.room}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={row.isPaid ? 'info' : 'success'}>
                      {row.isPaid ? formatCurrencyVND(row.price) : 'Miễn phí'}
                    </Badge>
                    <p className="mt-1 text-xs text-slate-500">
                      Còn {row.seatsLeft}/{row.capacity}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRegistrationsCard({ data }: { data: AdminDashboardSummary }) {
  const rows = data.recentRegistrations;
  return (
    <Card className="min-h-0">
      <CardContent className="flex min-h-0 flex-col space-y-4">
        <SectionHeader
          icon={<CircleCheck className="size-4 text-slate-400" />}
          title="Đăng ký gần đây"
          subtitle={`${rows.length} đăng ký gần nhất`}
        />
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có đăng ký nào.</p>
        ) : (
          <ScrollArea className="max-h-[min(24rem,55vh)]">
            <table className="w-full min-w-xl border-collapse text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Sinh viên</th>
                  <th className="pb-2 pr-3 font-medium">Workshop</th>
                  <th className="pb-2 pr-3 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Đăng ký lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">{row.userFullName}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{row.workshopTitle}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={REGISTRATION_TONE[row.status]} className="text-xs text-center">
                        {REGISTRATION_LABEL[row.status]}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-slate-700">{formatDateTime(row.reservedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Building blocks
// ============================================================================

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

interface Segment {
  key: string;
  value: number;
  color: string;
  label: string;
}

function SegmentedBar({ segments, total }: { segments: Segment[]; total: number }) {
  if (total === 0) {
    return <div className="h-2 w-full rounded-full bg-slate-100" />;
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      {segments.map((s) => {
        const pct = (s.value / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={s.key}
            className={cn('h-full', s.color)}
            style={{ width: `${pct}%` }}
            title={`${s.label}: ${s.value} (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

function statusCount<T extends string>(rows: { status: T; count: number }[], status: T): number {
  return rows.find((r) => r.status === status)?.count ?? 0;
}

// ============================================================================
// Loading skeleton
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              <div className="h-7 w-3/4 animate-pulse rounded bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="h-2 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-32 w-full animate-pulse rounded bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
