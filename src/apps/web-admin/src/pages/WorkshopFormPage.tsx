import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@unihub/api-client';
import type { CreateWorkshopRequest, UpdateWorkshopRequest, WorkshopStatus } from '@unihub/types';
import { cn } from '@unihub/format/cn';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const WORKSHOP_STATUSES = [
  'draft',
  'published',
  'cancelled',
] as const satisfies readonly WorkshopStatus[];

const WORKSHOP_STATUS_LABEL: Record<WorkshopStatus, string> = {
  draft: 'Nháp',
  published: 'Đang mở',
  cancelled: 'Đã hủy',
};

const schema = z
  .object({
    title: z.string().min(3, 'Tiêu đề tối thiểu 3 ký tự'),
    speaker: z.string().min(2, 'Nhập tên diễn giả'),
    room: z.string().min(1, 'Nhập phòng'),
    roomMapUrl: z.string().url('URL không hợp lệ').optional().or(z.literal('')),
    startsAt: z.string().min(1, 'Chọn giờ bắt đầu'),
    endsAt: z.string().min(1, 'Chọn giờ kết thúc'),
    capacity: z.coerce.number().int().min(1, 'Sức chứa tối thiểu 1'),
    isPaid: z.boolean(),
    price: z.coerce.number().int().min(0).optional(),
    status: z.enum(WORKSHOP_STATUSES),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: 'Kết thúc phải sau bắt đầu',
    path: ['endsAt'],
  })
  .refine((d) => !d.isPaid || (d.price ?? 0) > 0, {
    message: 'Workshop có phí phải nhập giá > 0',
    path: ['price'],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  mode: 'create' | 'edit';
}

export function WorkshopFormPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const existingQuery = useQuery({
    queryKey: ['workshop', id],
    queryFn: () => api.workshops.getById(id!),
    enabled: mode === 'edit' && !!id,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      speaker: '',
      room: '',
      roomMapUrl: '',
      startsAt: '',
      endsAt: '',
      capacity: 30,
      isPaid: false,
      price: 0,
      status: 'draft',
    },
  });

  const isPaid = watch('isPaid');

  useEffect(() => {
    if (mode === 'edit' && existingQuery.data) {
      const w = existingQuery.data;
      reset({
        title: w.title,
        speaker: w.speaker,
        room: w.room,
        roomMapUrl: w.roomMapUrl ?? '',
        startsAt: w.startsAt.slice(0, 16),
        endsAt: w.endsAt.slice(0, 16),
        capacity: w.capacity,
        isPaid: w.isPaid,
        price: w.price ?? 0,
        status: w.status,
      });
    }
  }, [mode, existingQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (body: CreateWorkshopRequest) => api.workshops.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workshops'] });
      navigate('/workshops');
    },
    onError: (e: unknown) =>
      setServerError(e instanceof ApiError ? e.message : 'Không thể tạo workshop.'),
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateWorkshopRequest) => api.workshops.update(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workshops'] });
      qc.invalidateQueries({ queryKey: ['workshop', id] });
      navigate('/workshops');
    },
    onError: (e: unknown) =>
      setServerError(e instanceof ApiError ? e.message : 'Không thể cập nhật workshop.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.workshops.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-workshops'] });
      qc.removeQueries({ queryKey: ['workshop', id] });
      navigate('/workshops');
    },
    onError: (e: unknown) =>
      setDeleteError(e instanceof ApiError ? e.message : 'Không thể xóa workshop.'),
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    const payload = {
      title: values.title,
      speaker: values.speaker,
      room: values.room,
      roomMapUrl: values.roomMapUrl || undefined,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      capacity: values.capacity,
      isPaid: values.isPaid,
      price: values.isPaid ? values.price : undefined,
    };
    if (mode === 'create') {
      createMutation.mutate(payload);
    } else if (existingQuery.data) {
      updateMutation.mutate({
        ...payload,
        version: existingQuery.data.version,
        status: values.status,
      });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {mode === 'create' ? 'Tạo workshop mới' : 'Chỉnh sửa workshop'}
        </h1>
        <p className="text-sm text-slate-500">
          Cập nhật thông tin được áp dụng ngay sau khi lưu. Số chỗ chỉ có thể tăng, không nên giảm
          xuống dưới số đã đăng ký.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin workshop</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field label="Tiêu đề" error={errors.title?.message} className="sm:col-span-2">
              <Input {...register('title')} />
            </Field>

            <Field label="Diễn giả" error={errors.speaker?.message}>
              <Input {...register('speaker')} />
            </Field>

            <Field label="Phòng" error={errors.room?.message}>
              <Input {...register('room')} />
            </Field>

            <Field
              label="URL sơ đồ phòng"
              error={errors.roomMapUrl?.message}
              className="sm:col-span-2"
            >
              <Input {...register('roomMapUrl')} placeholder="https://…" />
            </Field>

            <Field label="Bắt đầu" error={errors.startsAt?.message}>
              <Input type="datetime-local" {...register('startsAt')} />
            </Field>

            <Field label="Kết thúc" error={errors.endsAt?.message}>
              <Input type="datetime-local" {...register('endsAt')} />
            </Field>

            <Field label="Sức chứa" error={errors.capacity?.message}>
              <Input type="number" min={1} {...register('capacity')} />
            </Field>

            {mode === 'edit' && (
              <Field label="Trạng thái" error={errors.status?.message}>
                <select
                  {...register('status')}
                  className={cn(
                    'flex h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  )}
                >
                  {WORKSHOP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {WORKSHOP_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Loại workshop</label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" {...register('isPaid')} className="h-4 w-4 my-3" />
                Có thu phí
              </label>
            </div>

            {isPaid && (
              <Field label="Giá (VND)" error={errors.price?.message} className="sm:col-span-2">
                <Input type="number" min={0} step={1000} {...register('price')} />
              </Field>
            )}

            {serverError && (
              <div className="sm:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/workshops')}
                className="cursor-pointer"
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                {isSubmitting ? 'Đang lưu…' : mode === 'create' ? 'Tạo workshop' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mode === 'edit' && id && (
        <>
          <Card className="overflow-hidden border-red-200 bg-red-50/90 shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1 sm:pr-6">
                  <h3 className="text-base font-semibold text-red-900">Xóa workshop này</h3>
                  <p className="text-sm text-red-800/85">
                    Sau khi xóa workshop, không thể khôi phục. Hãy chắc chắn trước khi thực hiện.
                  </p>
                </div>
                <div className="flex shrink-0 sm:justify-end">
                  <button
                    type="button"
                    disabled={deleteMutation.isPending || existingQuery.isPending}
                    className="cursor-pointer rounded-md border border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-500 hover:bg-red-100 hover:text-red-900 disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    Xóa workshop này
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setDeleteError(null);
            }}
          >
            <DialogContent className="max-w-md border-red-100">
              <DialogHeader>
                <DialogTitle>Xóa workshop này?</DialogTitle>
                <DialogDescription>
                  Workshop <span className="font-semibold">«{existingQuery.data?.title ?? '…'}»</span>{' '}
                  sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.
                </DialogDescription>
              </DialogHeader>
              {deleteError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {deleteError}
                </div>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary" className="cursor-pointer">
                    Hủy
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="danger"
                  className="cursor-pointer"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending ? 'Đang xóa…' : 'Xóa workshop'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
