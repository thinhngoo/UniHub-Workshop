import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, ListChecks, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@unihub/format/cn';

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 !py-3 lg:!py-2 text-sm font-medium transition-colors rounded-none lg:rounded-md',
    isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-700 hover:bg-slate-100',
  );

const mobileNavItem = ({ isActive }: { isActive: boolean }) =>
  cn(navItem({ isActive }), 'min-w-0 flex-1 justify-center gap-1.5 px-2 py-2');

export function AdminLayout() {
  const { user, hasAdminAccess, clear } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-5 w-5" />
            Truy cập bị từ chối
          </div>
          <p className="mt-2 text-sm">
            Tài khoản của bạn không có quyền truy cập trang quản trị. Vui lòng liên hệ quản trị viên
            hoặc đăng nhập bằng tài khoản khác.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={handleLogout} variant="danger" className="cursor-pointer">
              Đăng xuất
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            U
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">UniHub Admin</p>
            <p className="text-[11px] text-slate-500">Ban tổ chức</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/" end className={navItem}>
            <LayoutDashboard className="h-4 w-4" />
            Tổng quan
          </NavLink>
          <NavLink to="/workshops" className={navItem}>
            <CalendarDays className="h-4 w-4" />
            Workshop
          </NavLink>
          <NavLink to="/registrations" className={navItem}>
            <ListChecks className="h-4 w-4" />
            Đăng ký
          </NavLink>
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="px-2 pb-2 text-xs text-slate-500">
            <p className="font-medium text-slate-700">{user?.fullName}</p>
            <p className="truncate">{user?.email}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="lg:hidden sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center justify-between px-4">
            <Link to="/" className="font-semibold">
              UniHub Admin
            </Link>
            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={handleLogout}>
              <LogOut className="size-4" />
            </Button>
          </div>
          <nav className="flex w-full border-t border-slate-200">
            <NavLink to="/" end className={mobileNavItem}>
              <LayoutDashboard className="size-4 shrink-0" />
              Tổng quan
            </NavLink>
            <NavLink to="/workshops" className={mobileNavItem}>
              <CalendarDays className="size-4 shrink-0" />
              Workshop
            </NavLink>
            <NavLink to="/registrations" className={mobileNavItem}>
              <ListChecks className="size-4 shrink-0" />
              Đăng ký
            </NavLink>
          </nav>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
