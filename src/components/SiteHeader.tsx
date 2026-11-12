import { GraduationCap, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { navigate, type Route } from '@/lib/useHashRoute';
import { SCHOOL_NAME } from '@/lib/school';
import { secondaryButtonClass } from '@/lib/styles';

type NavItem = { route: Route; label: string };

export function SiteHeader({ current }: { current: Route }) {
  const { isStaff, isAdmin, isSuperAdmin, profile, signOut } = useAuth();

  const items: NavItem[] = [
    { route: 'reports', label: 'Student reports' },
    { route: 'results', label: 'Result sheet' },
    ...(isStaff ? [{ route: 'marks' as Route, label: 'Marks entry' }] : []),
    ...(isAdmin ? [{ route: 'admin' as Route, label: 'Admin' }] : []),
    ...(isSuperAdmin ? [{ route: 'super-admin' as Route, label: 'Super admin' }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => navigate('reports')}
          className="flex items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-sky-500 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight text-slate-900">{SCHOOL_NAME}</span>
            <span className="block text-xs leading-tight text-slate-500">Internal marks sheet</span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1" aria-label="Main">
            {items.map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                aria-current={current === item.route ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  current === item.route
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {isStaff ? (
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="hidden text-sm text-slate-600 sm:inline">
                {profile?.full_name} <span className="text-slate-400">({profile?.role})</span>
              </span>
              <button type="button" onClick={() => void signOut()} className={secondaryButtonClass}>
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('signin')}
              className="ml-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Staff sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
