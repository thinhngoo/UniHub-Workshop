import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@unihub/api-client';
import type { CreateWorkshopRequest, UpdateWorkshopRequest } from '@unihub/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

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
      updateMutation.mutate({ ...payload, version: existingQuery.data.version });
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

            <Field label="URL sơ đồ phòng" error={errors.roomMapUrl?.message} className="sm:col-span-2">
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
              <Button type="button" variant="secondary" onClick={() => navigate('/workshops')} className="cursor-pointer">
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                {isSubmitting ? 'Đang lưu…' : mode === 'create' ? 'Tạo workshop' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
