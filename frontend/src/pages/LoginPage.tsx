import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin1234');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { access_token, user } = await authApi.login(username, password);
      login(access_token, user);
      toast.success(`Access granted — ${user.full_name}`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { username: 'admin',  password: 'Admin1234',    role: 'Admin',    color: 'text-red-400 border-red-500/30 bg-red-500/5' },
    { username: 'alice',  password: 'Engineer1234', role: 'Engineer', color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
    { username: 'viewer', password: 'Viewer1234',   role: 'Viewer',   color: 'text-slate-400 border-slate-500/30 bg-slate-500/5' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 cyber-grid bg-cyber-grid opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/8 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-purple-600/6 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-2xl blur-xl opacity-30" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center border border-blue-400/30 shadow-neon-blue">
                <span className="text-white font-black text-lg tracking-tight">IMS</span>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Incident Management
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-mono tracking-wider">
            ENTERPRISE OPERATIONS PLATFORM
          </p>
        </div>

        {/* Login card */}
        <div className="card gradient-border p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_#60a5fa]" />
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Authenticate</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                className="input font-mono"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input font-mono"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span>→</span> Grant Access
                </span>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-[#1e2d45]">
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">
              Demo Accounts
            </p>
            <div className="space-y-2">
              {demoUsers.map(u => (
                <button
                  key={u.username}
                  onClick={() => { setUsername(u.username); setPassword(u.password); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all hover:scale-[1.01] ${u.color}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-current/10 flex items-center justify-center text-xs font-bold">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold font-mono">{u.username}</p>
                      <p className="text-xs opacity-50 font-mono">{u.password}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono opacity-70">{u.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs font-mono mt-6 tracking-wider">
          IMS v1.0.0 · ENTERPRISE EDITION
        </p>
      </div>
    </div>
  );
};
