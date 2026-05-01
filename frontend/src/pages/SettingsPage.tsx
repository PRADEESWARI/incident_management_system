import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { TopBar } from '../components/dashboard/TopBar';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

interface Props { onMenuClick?: () => void; }

export const SettingsPage: React.FC<Props> = ({ onMenuClick }) => {
  const { user } = useAuthStore();
  const { isDark, toggle } = useThemeStore();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await apiClient.get('/health', { baseURL: '' });
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/metrics', { baseURL: '' });
      return data;
    },
    refetchInterval: 10000,
  });

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" onMenuClick={onMenuClick || (() => {})} />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {/* System Health panel */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">System Health</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {health && Object.entries(health.services || {}).map(([service, status]) => {
              const isUp = (status as string).startsWith('up');
              const isUnavailable = (status as string).startsWith('unavailable');
              return (
                <div key={service} className="flex items-start gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                    isUp ? 'bg-green-500' : isUnavailable ? 'bg-yellow-400' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{service}</p>
                    <p className={`text-xs ${
                      isUp ? 'text-green-600 dark:text-green-400' :
                      isUnavailable ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {isUp ? 'up' : isUnavailable ? 'fallback active' : 'down'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {health?.kafka_note && (
            <p className="mt-3 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-lg">
              ℹ️ {health.kafka_note}
            </p>
          )}
          {health && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-6 text-xs text-gray-500">
              <span>Status: <strong className={health.status === 'healthy' ? 'text-green-600' : 'text-yellow-600'}>{health.status}</strong></span>
              <span>Uptime: <strong>{Math.round((health.uptime_seconds || 0) / 60)}m</strong></span>
              <span>Version: <strong>{health.version}</strong></span>
            </div>
          )}
        </div>

        {/* Live Metrics */}
        {metrics && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Live Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Signals/sec</p>
                <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{metrics.signals_per_second}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Queue Size</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{metrics.queue_size}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Uptime</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{Math.round(metrics.uptime_seconds / 60)}m</p>
              </div>
            </div>
          </div>
        )}

        {/* User Profile */}
        {user && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Your Profile</h3>
            <dl className="space-y-3">
              {[
                ['Name', user.full_name],
                ['Username', user.username],
                ['Email', user.email],
                ['Role', user.role],
                ['Team', user.team || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900 dark:text-white capitalize">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Theme */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
              <p className="text-xs text-gray-500">Toggle between light and dark theme</p>
            </div>
            <button
              onClick={toggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? 'bg-brand-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
