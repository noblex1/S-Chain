import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const baseNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/shipments', label: 'Shipments' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const nav = isAdmin
    ? [
        ...baseNav,
        { to: '/admin/monitor', label: 'Monitoring' },
        { to: '/admin/users', label: 'Team & users' },
        { to: '/admin/audit', label: 'Audit log' },
      ]
    : baseNav;
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('s-chain-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem('s-chain-theme');
    if (saved === 'dark') setDark(true);
  }, []);

  return (
    <div className="min-h-screen flex bg-transparent">
      <aside className="hidden md:flex w-72 flex-col border-r border-slate-200/70 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <p className="font-display font-bold text-xl text-brand-600 dark:text-brand-400 tracking-tight">
            S-Chain
          </p>
          <p className="text-xs text-slate-500 mt-1">Supply chain visibility</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-100/70 text-brand-900 dark:bg-brand-950 dark:text-brand-200'
                    : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-sm">
          <p className="font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
          <button type="button" onClick={() => setDark((d) => !d)} className="mt-3 w-full btn-secondary">
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-lg bg-slate-900 dark:bg-brand-600 text-white py-2 text-xs font-medium transition hover:opacity-90"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg">
          <span className="font-display font-bold text-brand-600">S-Chain</span>
          <div className="flex items-center gap-3 text-xs font-medium">
            {isAdmin && (
              <>
                <Link to="/admin/monitor" className="text-brand-600 dark:text-brand-400">
                  Monitor
                </Link>
                <Link to="/admin/users" className="text-brand-600 dark:text-brand-400">
                  Team
                </Link>
                <Link to="/admin/audit" className="text-brand-600 dark:text-brand-400">
                  Audit
                </Link>
              </>
            )}
            <NavLink to="/shipments" className="text-slate-600 dark:text-slate-300">
              Shipments
            </NavLink>
            <NavLink to="/" end className="text-slate-600 dark:text-slate-300">
              Home
            </NavLink>
            <button type="button" onClick={() => setDark((d) => !d)} className="text-slate-600 dark:text-slate-300">
              Theme
            </button>
          </div>
        </header>
        <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-slate-200/80 dark:border-slate-800 bg-white/75 dark:bg-slate-900/70 backdrop-blur-xl">
          <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Operations center
          </h1>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
