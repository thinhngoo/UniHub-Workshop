import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, LogIn, LogOut, Bell, Menu, Ticket, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@unihub/format/cn';

const menuItemBase =
  'flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors rounded-md';

const menuNavItem = ({ isActive }: { isActive: boolean }) =>
  cn(menuItemBase, isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-700 hover:bg-slate-50');

const menuLogoutItem = cn(menuItemBase, 'text-red-700 hover:bg-red-50');

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-8">
        <div className="container-app">
          <Outlet />
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  const { isReady, isAuthenticated, clear } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    void api.auth.logout().catch(() => {
      // Ignore server errors on logout; always clear local state.
    });
    clear();
    setMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="container-app relative flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            U
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-slate-900">UniHub Workshop</p>
            <p className="text-[11px] text-slate-500">Cổng đăng ký sinh viên</p>
          </div>
        </Link>

        {isReady ? (
          isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-slate-700 cursor-pointer"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Mở menu điều hướng"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Menu className="size-5" strokeWidth={2} />
              </Button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 px-1 shadow-lg"
                  role="menu"
                >
                  <NavLink to="/me" end className={menuNavItem} role="menuitem">
                    <UserIcon className="size-4 shrink-0" />
                    Tài khoản
                  </NavLink>
                  <NavLink to="/workshops" className={menuNavItem} role="menuitem">
                    <CalendarDays className="size-4 shrink-0" />
                    Lịch workshop
                  </NavLink>
                  <NavLink to="/me/notifications" className={menuNavItem} role="menuitem">
                    <Bell className="size-4 shrink-0" />
                    Thông báo
                  </NavLink>
                  <NavLink to="/me/registrations" className={menuNavItem} role="menuitem">
                    <Ticket className="size-4 shrink-0" />
                    Đăng ký của tôi
                  </NavLink>
                  <div className="mt-1 border-t border-slate-100 pt-1 px-1">
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(menuLogoutItem, 'cursor-pointer text-left')}
                      onClick={handleLogout}
                    >
                      <LogOut className="size-4 shrink-0" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button size="sm" onClick={() => navigate('/login')} className="cursor-pointer">
              <LogIn className="size-4" />
              Đăng nhập
            </Button>
          )
        ) : null}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6">
      <div className="container-app text-xs text-slate-500 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} UniHub Workshop · Tuần lễ kỹ năng và nghề nghiệp</span>
        <span>Developed by Byron</span>
      </div>
    </footer>
  );
}
