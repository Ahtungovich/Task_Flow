import { Layers } from 'lucide-react';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../config/app';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Layers className="h-4 w-4" />
            </span>
            <span>{APP_CONFIG.appName}</span>
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Этап 1 · Базовая инфраструктура
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
