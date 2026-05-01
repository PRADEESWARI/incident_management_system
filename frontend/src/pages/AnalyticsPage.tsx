import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import { TopBar } from '../components/dashboard/TopBar';
import { formatDuration, COMPONENT_TYPE_ICONS } from '../utils/formatters';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import clsx from 'clsx';

interface Props { onMenuClick?: () => void; }

const HEALTH_COLORS = { healthy: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', degraded: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', critical: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' };

export const AnalyticsPage: React.FC<Props> = ({ onMenuClick }) => {
  const [mttrDays, setMttrDays] = useState(7);

  const { data: mttrData } = useQuery({
    queryKey: ['mttr-trends', mttrDays],
    queryFn: () => analyticsApi.getMttrTrends(mttrDays),
  });

  const { data: healthData } = useQuery({
    queryKey: ['service-health'],
    queryFn: analyticsApi.getServiceHealth,
    refetchInterval: 30000,
  });

  const mttrChartData = Array.isArray(mttrData) ? mttrData.map((d: any) => ({
    day: d.day ? new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    mttr_minutes: d.avg_mttr_minutes,
    count: d.count,
  })) : [];

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Analytics" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {/* MTTR Trends */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">MTTR Trends</h3>
            <select
              className="input w-32 text-xs py-1.5"
              value={mttrDays}
              onChange={e => setMttrDays(parseInt(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          {mttrChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mttrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="m" />
                <Tooltip formatter={(v: any) => [`${v}m`, 'Avg MTTR']} />
                <Legend />
                <Line type="monotone" dataKey="mttr_minutes" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="MTTR (min)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No resolved incidents in this period
            </div>
          )}
        </div>

        {/* Service Health */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Service Health Map</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="table-header">Service</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Health</th>
                  <th className="table-header">Active</th>
                  <th className="table-header">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(healthData?.services || []).map((s: any) => (
                  <tr key={s.component_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-mono text-xs">{s.component_id}</td>
                    <td className="table-cell">
                      <span className="text-sm">{COMPONENT_TYPE_ICONS[s.component_type] || '❓'}</span>
                      <span className="text-xs text-gray-500 ml-1">{s.component_type}</span>
                    </td>
                    <td className="table-cell">
                      <span className={clsx('badge text-xs', HEALTH_COLORS[s.health_status as keyof typeof HEALTH_COLORS])}>
                        {s.health_status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={clsx('text-sm font-semibold', s.active_incidents > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>
                        {s.active_incidents}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 text-sm">{s.total_incidents}</td>
                  </tr>
                ))}
                {(!healthData?.services || healthData.services.length === 0) && (
                  <tr><td colSpan={5} className="table-cell text-center py-8 text-gray-400">No service data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
