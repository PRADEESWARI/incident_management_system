import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const navItems = [
  { path: '/',             label: 'Dashboard',       icon: '⬡',  exact: true },
  { path: '/incidents',    label: 'Incidents',        icon: '◈' },
  { path: '/analytics',   label: 'Analytics',        icon: '◎' },
  { path: '/simulator',   label: 'Chaos Simulator',  icon: '⚡', roles: ['admin','engineer'] },
  { path: '/integrations', label: 'Integrations',    icon: '⬡',  roles: ['admin','engineer'] },
  { path: '/settings',    label: 'Settings',         icon: '◉' },
];

const ROLE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  admin:    { label: 'Admin',    color: 'text-red-400',    dot: 'bg-red-400' },
  engineer: { label: 'Engineer', color: 'text-blue-400',   dot: 'bg-blue-400' },
  viewer:   { label: 'Viewer',   color: 'text-slate-400',  dot: 'bg-slate-400' },
};

interface Props {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<Props> = ({ mobileOpen, onMobileClose }) => {
  const { user, logout } = useAuthStore();
  const { isDark, toggle } = useThemeStore();
  const navigate = useNavigate();

  const userRole = user?.role ?? 'viewer';
  const roleConf = ROLE_CONFIG[userRole] ?? ROLE_CONFIG.viewer;
  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(userRole));

  const handleLogout = () => { logout(); navigate('/login'); };

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#1e2d45]">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="absolute inset-0 bg-blue-500 rounded-lg opacity-20 blur-sm" />
            <div className="relative w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center border border-blue-400/30">
              <span className="text-white font-black text-xs tracking-tight">IMS</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">Incident Manager</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="status-dot online" />
              <span className="text-xs text-slate-500 font-mono">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Navigation</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            onClick={onMobileClose}
            className={({ isActive }) =>
              clsx('sidebar-link group', isActive ? 'sidebar-link-active' : 'sidebar-link-inactive')
            }
          >
            {({ isActive }) => (
              <>
                <span className={clsx(
                  'text-base w-5 text-center transition-all',
                  isActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-300'
                )}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[#1e2d45] space-y-1">
        {/* Theme toggle */}
        <button onClick={toggle} className="sidebar-link sidebar-link-inactive w-full">
          <span className="text-base w-5 text-center text-slate-600">{isDark ? '○' : '●'}</span>
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* User card */}
        {user && (
          <div className="mt-2 p-3 rounded-lg border border-[#1e2d45] bg-[#0d1117]/60">
            <div className="flex items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm border border-blue-500/30">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1117]', roleConf.dot)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
                <p className={clsx('text-xs font-mono', roleConf.color)}>{roleConf.label}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-600 hover:text-red-400 transition-colors text-sm p-1 rounded hover:bg-red-400/10"
                title="Logout"
              >
                ⏻
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 border-r border-[#1e2d45] bg-[#0a0e1a]/95 backdrop-blur-xl">
        {content}
      </aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="relative flex flex-col w-64 bg-[#0a0e1a] border-r border-[#1e2d45] animate-slide-in">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
