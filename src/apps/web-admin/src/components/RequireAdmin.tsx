import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isReady, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Đang tải phiên đăng nhập…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
