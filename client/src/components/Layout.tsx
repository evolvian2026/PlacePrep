import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/hooks';
import { Avatar, Button, cx } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const STUDENT_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/companies', label: 'Companies', icon: '▦' },
  { to: '/roadmap', label: 'My roadmap', icon: '➔' },
  { to: '/practice', label: 'Practice', icon: '✎' },
  { to: '/mock-tests', label: 'Mock tests', icon: '⏱' },
  { to: '/coding', label: 'Coding', icon: '⌘' },
  { to: '/performance', label: 'Performance', icon: '▲' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '★' },
  { to: '/profile', label: 'Profile', icon: '☺' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: '◉' },
  { to: '/admin/companies', label: 'Companies', icon: '▦' },
  { to: '/admin/rounds', label: 'Rounds & roadmaps', icon: '➔' },
  { to: '/admin/questions', label: 'Question bank', icon: '✎' },
  { to: '/admin/mock-tests', label: 'Mock tests', icon: '⏱' },
  { to: '/admin/students', label: 'Students', icon: '☺' },
  { to: '/admin/cohort', label: 'Cohort', icon: '⚭' },
  { to: '/admin/reports', label: 'Student reports', icon: '✉' },
  { to: '/admin/analytics', label: 'Analytics', icon: '▲' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙' },
];

/**
 * The primary action path is always visible in the nav order:
 * Prepare → Practice → Mock test → Analyze → Improve.
 */
export function Layout({ mode }: { mode: 'student' | 'admin' }) {
  const { user, logout, isStaff } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const items = mode === 'admin' ? ADMIN_NAV : STUDENT_NAV;

  return (
    <div className="flex min-h-full">
      {/* ── Sidebar ── */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--surface)', borderColor: 'var(--hairline)' }}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <span
            className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: 'var(--brand)' }}
            aria-hidden="true"
          >
            PP
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold ink">PlacePrep</div>
            <div className="text-[11px] ink-muted">{mode === 'admin' ? 'Admin console' : 'Placement coach'}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-2 pb-4">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/' || item.to === '/admin'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'font-medium' : 'ink-2 hover:opacity-70',
                    )
                  }
                  style={({ isActive }) =>
                    isActive
                      ? { background: 'var(--brand-wash)', color: 'var(--brand-strong)' }
                      : undefined
                  }
                >
                  <span aria-hidden="true" className="w-4 text-center text-xs opacity-70">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {isStaff ? (
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
              <NavLink
                to={mode === 'admin' ? '/' : '/admin'}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ink-2 hover:opacity-70"
              >
                <span aria-hidden="true" className="w-4 text-center text-xs opacity-70">
                  ⇄
                </span>
                {mode === 'admin' ? 'Student view' : 'Admin console'}
              </NavLink>
            </div>
          ) : null}
        </nav>

        <div className="border-t p-3" style={{ borderColor: 'var(--hairline)' }}>
          <div className="mb-2 flex items-center gap-2">
            <Avatar name={user?.name ?? '?'} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium ink">{user?.name}</div>
              <div className="truncate text-[11px] ink-muted">{user?.role.replace('_', ' ')}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
              title={`Theme: ${theme}`}
              className="flex-1 rounded-md border px-2 py-1.5 text-[11px] ink-2 hover:opacity-70"
              style={{ borderColor: 'var(--hairline)' }}
            >
              {theme === 'dark' ? '☾ Dark' : theme === 'light' ? '☀ Light' : '◐ Auto'}
            </button>
            <button
              onClick={logout}
              className="flex-1 rounded-md border px-2 py-1.5 text-[11px] ink-2 hover:opacity-70"
              style={{ borderColor: 'var(--hairline)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 lg:hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--hairline)' }}
        >
          <Button variant="secondary" size="sm" onClick={() => setMobileOpen(true)}>
            ☰ Menu
          </Button>
          <span className="truncate text-sm font-medium ink">
            {items.find((item) => item.to === location.pathname)?.label ?? 'PlacePrep'}
          </span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
