import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@unihub/api-client';
import { Sparkles } from 'lucide-react';
import type {
  CreateWorkshopRequest,
  SummaryStatus,
  UpdateWorkshopRequest,
  WorkshopStatus,
} from '@unihub/types';
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
import { Input, Textarea } from '@/components/ui/input';
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

const SUMMARY_STATUS_LABEL: Record<SummaryStatus, string> = {
  none: 'Chưa có',
  pending: 'Đang xử lý',
  ready: 'Đã có bản giới thiệu',
  failed: 'Thất bại',
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
    summary: z.string(),
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
  const [summaryBanner, setSummaryBanner] = useState<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);
  const [pendingSummaryJobId, setPendingSummaryJobId] = useState<string | null>(null);
  const [summaryPdfFile, setSummaryPdfFile] = useState<File | null>(null);
  const summaryPdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSummaryPdfFile(null);
    const el = summaryPdfInputRef.current;
    if (el) el.value = '';
  }, [id]);

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
      summary: '',
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
        summary: w.summary ?? '',
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

  const summaryMutation = useMutation({
    mutationFn: (file: File) => api.workshops.triggerSummary(id!, file),
    onMutate: () => setSummaryBanner(null),
    onSuccess: async (data) => {
      setPendingSummaryJobId(data.jobId);
      setSummaryBanner({
        tone: 'success',
        message: 'Đang xử lý giới thiệu từ PDF…',
      });
      await qc.invalidateQueries({ queryKey: ['workshop', id] });
    },
    onError: async (e: unknown) => {
      await qc.invalidateQueries({ queryKey: ['workshop', id] });
      setSummaryBanner({
        tone: 'danger',
        message: e instanceof ApiError ? e.message : 'Không thể xếp hàng xử lý giới thiệu.',
      });
    },
  });

  const summaryJobQuery = useQuery({
    queryKey: ['workshop-summary-job', pendingSummaryJobId],
    queryFn: () => api.workshops.getSummaryJobStatus(pendingSummaryJobId!),
    enabled: mode === 'edit' && !!id && typeof pendingSummaryJobId === 'string',
    refetchInterval: (query) => {
      const st = query.state.data?.state;
      if (st === 'completed' || st === 'failed') return false;
      return 1500;
    },
  });

  useEffect(() => {
    const d = summaryJobQuery.data;
    if (!pendingSummaryJobId || !d) return;
    if (d.state !== 'completed' && d.state !== 'failed') return;

    void (async () => {
      await qc.invalidateQueries({ queryKey: ['workshop', id] });
      if (d.state === 'completed' && d.outcome === 'ready') {
        setSummaryBanner({
          tone: 'success',
          message: 'Đã cập nhật giới thiệu từ PDF.',
        });
      } else {
        setSummaryBanner({
          tone: 'danger',
          message: d.failedReason ?? 'Không tạo được giới thiệu từ PDF.',
        });
      }
      setPendingSummaryJobId(null);
      setSummaryPdfFile(null);
      const inputEl = summaryPdfInputRef.current;
      if (inputEl) inputEl.value = '';
    })();
  }, [pendingSummaryJobId, summaryJobQuery.data, id, qc]);

  const isLoadingEditWorkshop = mode === 'edit' && existingQuery.isPending;
  const isSummaryPipelineBusy =
    !!pendingSummaryJobId &&
    (summaryJobQuery.isPending ||
      (summaryJobQuery.data?.state !== 'completed' && summaryJobQuery.data?.state !== 'failed'));
  const isSavingForm = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const isSaving = isSavingForm || summaryMutation.isPending || isSummaryPipelineBusy;

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
        summary: values.summary.trim() === '' ? null : values.summary.trim(),
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
            {mode === 'create' && <input type="hidden" {...register('summary')} />}

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

            {mode === 'edit' && (
              <Field label="Giới thiệu" error={errors.summary?.message} className="sm:col-span-2">
                <p className="text-xs text-slate-500">
                  Nội dung hiển thị cho sinh viên trên trang chi tiết workshop
                  {existingQuery.data && (
                    <>
                      {' '}
                      · Trạng thái:{' '}
                      <span className="font-medium text-slate-600">
                        {SUMMARY_STATUS_LABEL[existingQuery.data.summaryStatus]}
                      </span>
                    </>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={summaryPdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => setSummaryPdfFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer"
                    disabled={
                      summaryMutation.isPending ||
                      isSummaryPipelineBusy ||
                      isLoadingEditWorkshop ||
                      updateMutation.isPending ||
                      !id
                    }
                    onClick={() => summaryPdfInputRef.current?.click()}
                  >
                    Chọn PDF
                  </Button>
                  {summaryPdfFile ? (
                    <span
                      className="max-w-[220px] truncate text-xs text-slate-600"
                      title={summaryPdfFile.name}
                    >
                      {summaryPdfFile.name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Chưa chọn file</span>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="cursor-pointer gap-1.5"
                    disabled={
                      summaryMutation.isPending ||
                      isSummaryPipelineBusy ||
                      isLoadingEditWorkshop ||
                      updateMutation.isPending ||
                      !id ||
                      !summaryPdfFile
                    }
                    onClick={() =>
                      summaryPdfFile ? summaryMutation.mutate(summaryPdfFile) : undefined
                    }
                  >
                    <Sparkles className="size-4 shrink-0" />
                    {summaryMutation.isPending
                      ? 'Đang gửi…'
                      : isSummaryPipelineBusy
                        ? 'Đang xử lý…'
                        : 'Tạo giới thiệu từ PDF'}
                  </Button>
                </div>
                {summaryBanner && (
                  <p
                    className={cn(
                      'mt-2 text-xs',
                      summaryBanner.tone === 'success' ? 'text-emerald-700' : 'text-red-600',
                    )}
                  >
                    {summaryBanner.message}
                  </p>
                )}
                <Textarea
                  {...register('summary')}
                  rows={8}
                  placeholder="Nhập hoặc dán nội dung giới thiệu…"
                  className="mt-1.5 min-h-[180px]"
                />
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
              <Button
                type="submit"
                disabled={isSaving || isLoadingEditWorkshop}
                className="cursor-pointer"
              >
                {isLoadingEditWorkshop
                  ? 'Đang tải…'
                  : summaryMutation.isPending
                    ? 'Đang gửi…'
                    : isSummaryPipelineBusy
                      ? 'Đang tạo giới thiệu…'
                      : isSavingForm
                        ? 'Đang lưu…'
                        : mode === 'create'
                          ? 'Tạo workshop'
                          : 'Lưu thay đổi'}
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
                  Workshop{' '}
                  <span className="font-semibold">«{existingQuery.data?.title ?? '…'}»</span> sẽ bị
                  xóa vĩnh viễn. Thao tác này không thể hoàn tác.
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
