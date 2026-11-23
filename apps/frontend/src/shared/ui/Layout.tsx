import {
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCircle2,
  X,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { APP_CONFIG } from '../config/app';
import { ACCOUNT_TYPE_LABELS } from '../types/domain';
import { Badge } from './Badge';
import { Button } from './Button';

export function Layout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-slate-900 text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              to={isAuthenticated ? '/dashboard' : '/'}
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Layers className="h-4 w-4" />
              </span>
              <span>{APP_CONFIG.appName}</span>
            </Link>

            {isAuthenticated && (
              <nav className="hidden items-center gap-1 md:flex">
                <NavLink to="/dashboard" className={navLinkClass}>
                  <LayoutDashboard className="h-4 w-4" />
                  Личный кабинет
                </NavLink>
                <NavLink to="/projects" className={navLinkClass}>
                  <FolderKanban className="h-4 w-4" />
                  Проекты
                </NavLink>
                <NavLink to="/profile" className={navLinkClass}>
                  <UserCircle2 className="h-4 w-4" />
                  Профиль
                </NavLink>
              </nav>
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <p className="text-sm font-medium leading-none text-slate-900">
                      {user.fullName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      @{user.username}
                    </p>
                  </div>
                  <Badge
                    tone={user.accountType === 'TEACHER' ? 'success' : 'neutral'}
                  >
                    {ACCOUNT_TYPE_LABELS[user.accountType]}
                  </Badge>
                </div>
                <Button variant="ghost" onClick={handleLogout} title="Выйти">
                  <LogOut className="h-4 w-4" />
                  Выйти
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Войти</Button>
                </Link>
                <Link to="/register">
                  <Button>Регистрация</Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Меню"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            {isAuthenticated && user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.email} · @{user.username}
                    </p>
                  </div>
                  <Badge
                    tone={user.accountType === 'TEACHER' ? 'success' : 'neutral'}
                  >
                    {ACCOUNT_TYPE_LABELS[user.accountType]}
                  </Badge>
                </div>
                <nav className="flex flex-col gap-1">
                  <NavLink
                    to="/dashboard"
                    className={navLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Личный кабинет
                  </NavLink>
                  <NavLink
                    to="/projects"
                    className={navLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <FolderKanban className="h-4 w-4" />
                    Проекты
                  </NavLink>
                  <NavLink
                    to="/profile"
                    className={navLinkClass}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <UserCircle2 className="h-4 w-4" />
                    Профиль
                  </NavLink>
                </nav>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Выйти из аккаунта
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="secondary" className="w-full">
                    Войти
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Регистрация</Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span className="flex items-center gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" />
            {APP_CONFIG.appName} — система совместного планирования учебных проектов
          </span>
        </div>
      </footer>
    </div>
  );
}
