import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
// import { ApiError } from '@unihub/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const schema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(7, 'Mật khẩu tối thiểu 7 ký tự'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await api.auth.login(values);
      setSession(
        {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          expiresIn: res.expiresIn,
        },
        res.user,
      );
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(from ?? '/workshops', { replace: true });
    } catch (e) {
      // if (e instanceof ApiError) setServerError(e.message);
      setServerError('Không thể đăng nhập. Vui lòng thử lại.');
    }
  };

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Vui lòng đăng nhập để tiếp tục.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@clc.fitus.edu.vn"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="password">
                Mật khẩu
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full cursor-pointer" disabled={isSubmitting}>
              {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>

            <p className="text-center text-xs text-slate-500">
              Chưa có tài khoản? Liên hệ phòng công tác sinh viên hoặc{' '}
              <Link to="/" className="text-brand-600 hover:underline">
                quay lại trang chủ
              </Link>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
