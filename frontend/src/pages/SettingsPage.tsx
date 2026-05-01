import React, { useState } from 'react';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Props { onMenuClick?: () => void; }

const Section: React.FC<{ title: string; subtitle?: string; icon: string; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
  <div className="card overflow-hidden">
    <div className="px-6 py-4 border-b border-[#1e2d45] flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

export const SettingsPage: React.FC<Props> = ({ onMenuClick }) => {
  const { user } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { toast.error('New passwords do not match'); return; }
    if (pwForm.newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setPwLoading(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success('Password updated successfully');
    setPwForm({ current: '', newPw: '', confirm: '' });
    setPwLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">

        {/* ── User Profile ── */}
        {user && (
          <Section icon="◈" title="User Profile" subtitle="Your account information">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-black text-xl border border-blue-500/30 flex-shrink-0">
                {user.full_name.charAt(0)}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{user.full_name}</p>
                <p className="text-sm text-slate-500 font-mono">@{user.username}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Full Name', value: user.full_name },
                { label: 'Username',  value: `@${user.username}` },
                { label: 'Email',     value: user.email },
                { label: 'Role',      value: user.role.toUpperCase() },
                { label: 'Team',      value: user.team || '—' },
                { label: 'Status',    value: user.is_active ? 'Active' : 'Disabled' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0d1117] rounded-lg px-4 py-3 border border-[#1e2d45]">
                  <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-sm font-semibold text-slate-200 font-mono">{value}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Change Password ── */}
        <Section icon="🔒" title="Change Password" subtitle="Update your account password">
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input font-mono" placeholder="••••••••"
                value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input font-mono" placeholder="Min 8 characters"
                value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} required minLength={8} />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input font-mono" placeholder="Repeat new password"
                value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
            </div>
            {pwForm.newPw && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
              <p className="text-xs text-red-400 font-mono">Passwords do not match</p>
            )}
            <button type="submit" disabled={pwLoading} className="btn-primary">
              {pwLoading ? 'Updating...' : '→ Update Password'}
            </button>
          </form>
        </Section>

        {/* ── Appearance ── */}
        <Section icon="○" title="Appearance" subtitle="Display and theme preferences">
          <div className="flex items-center justify-between py-3 border-b border-[#1e2d45]">
            <div>
              <p className="text-sm font-semibold text-white">Dark Mode</p>
              <p className="text-xs text-slate-500 mt-0.5">Cyber dark theme — recommended for operations dashboards</p>
            </div>
            <button
              onClick={toggle}
              className={clsx(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                isDark ? 'bg-blue-600' : 'bg-slate-700'
              )}
            >
              <span className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
                isDark ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>
          <div className="flex items-center justify-between py-3 mt-2">
            <div>
              <p className="text-sm font-semibold text-white">Current Theme</p>
              <p className="text-xs text-slate-500 mt-0.5">{isDark ? 'Dark — Cyber ops style' : 'Light — Clean minimal'}</p>
            </div>
            <span className={clsx(
              'text-xs font-mono px-3 py-1 rounded-lg border',
              isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-100 text-slate-600 border-slate-200'
            )}>
              {isDark ? 'DARK' : 'LIGHT'}
            </span>
          </div>
        </Section>

      </main>
    </div>
  );
};
