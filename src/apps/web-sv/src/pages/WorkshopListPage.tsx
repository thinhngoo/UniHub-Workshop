import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Search, Users } from 'lucide-react';
import type { Workshop } from '@unihub/types';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrencyVND, formatDateTime } from '@unihub/format';

export function WorkshopListPage() {
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['workshops', { search }],
    queryFn: () => api.workshops.list({ search: search || undefined, status: 'published' }),
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch workshop</h1>
          <p className="text-sm text-slate-500">Danh sách workshop sắp diễn ra.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Tìm theo tiêu đề, diễn giả…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {query.isPending && <ListSkeleton />}
      {query.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Không tải được danh sách workshop. Vui lòng thử lại.
        </div>
      )}

      {query.isSuccess && items.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Không tìm thấy workshop.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((w) => (
          <WorkshopCard key={w.id} workshop={w} />
        ))}
      </div>
    </div>
  );
}

function WorkshopCard({ workshop }: { workshop: Workshop }) {
  const seatsTone =
    workshop.seatsLeft === 0
      ? 'danger'
      : workshop.seatsLeft <= Math.max(5, workshop.capacity * 0.1)
        ? 'warning'
        : 'success';

  return (
    <Link to={`/workshops/${workshop.id}`} className="block focus:outline-none">
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-slate-900 line-clamp-2">{workshop.title}</h3>
            {workshop.isPaid ? (
              <Badge tone="info">{formatCurrencyVND(workshop.price ?? 0)}</Badge>
            ) : (
              <Badge tone="success" className="whitespace-nowrap">
                Miễn phí
              </Badge>
            )}
          </div>

          <p className="text-sm text-slate-600 line-clamp-2">Diễn giả: {workshop.speaker}</p>

          <div className="mt-auto space-y-1.5 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              {formatDateTime(workshop.startsAt)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              {workshop.room}
            </p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              <span>
                Còn{' '}
                <Badge tone={seatsTone}>
                  {workshop.seatsLeft}/{workshop.capacity}
                </Badge>{' '}
                chỗ
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3">
            <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
