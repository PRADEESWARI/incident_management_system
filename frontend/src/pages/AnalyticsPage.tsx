import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import { TopBar } from '../components/dashboard/TopBar';
import { formatDuration, COMPONENT_TYPE_ICONS } from '../utils/formatters';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import clsx from 'clsx';

interface Props { onMenuClick?: () => void; }

const HEALTH_STYLE: Record<string, { cls: string; dot: string; label: string }> = {
  healthy:  { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400 shadow-[0_0_4px_#34d399]', label: 'Healthy' },
  degraded: { cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400',  label: 'Degraded' },
  critical: { cls: 'bg-red-500/10 text-red-400 border-red-500/30',            dot: 'bg-red-400 shadow-[0_0_4px_#f87171]', label: 'Critical' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-[#1e2d45] rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#60a5fa' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export const AnalyticsPage: React.FC<Props> = ({ onMenuClick }) => {
  const [mttrDays, setMttrDays] = useState(7);

  const { data: mttrData, isLoading: mttrLoading } = useQuery({
    queryKey: ['mttr-trends', mttrDays],
    queryFn: () => analyticsApi.getMttrTrends(mttrDays),
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['service-health'],
    queryFn: analyticsApi.getServiceHealth,
    refetchInterval: 30000,
  });

  const mttrChartData = Array.isArray(mttrData)
    ? mttrData.map((d: any) => ({
        day: d.day ? new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
        mttr: Math.round(d.avg_mttr_minutes || 0),
        count: d.count || 0,
      }))
    : [];

  const services = healthData?.services || [];
  const healthCounts = {
    healthy:  services.filter((s: any) => s.health_status === 'healthy').length,
    degraded: services.filter((s: any) => s.health_status === 'degraded').length,
    critical: services.filter((s: any) => s.health_status === 'critical').length,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Analytics" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 space-y-5">

        {/* Service health summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Healthy Services',  value: healthCounts.healthy,  color: 'green',  desc: 'No active incidents' },
            { label: 'Degraded Services', value: healthCounts.degraded, color: 'orange', desc: 'P2/P3 active incidents' },
            { label: 'Critical Services', value: healthCounts.critical, color: 'red',    desc: 'P0/P1 active incidents' },
          ].map(c => (
            <div key={c.label} className={clsx(
              'card p-5',
              c.color === 'green'  ? 'stat-accent-green' :
              c.color === 'orange' ? 'stat-accent-orange' : 'stat-accent-red'
            )}>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-2">{c.label}</p>
              <p className={clsx(
                'text-3xl font-black tabular-nums',
                c.color === 'green'  ? 'text-emerald-400' :
                c.color === 'orange' ? 'text-orange-400' : 'text-red-400'
              )}>{healthLoading ? '—' : c.value}</p>
              <p className="text-xs text-slate-600 font-mono mt-1">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* MTTR Trends */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Mean Time To Repair</p>
              <p className="text-sm font-bold text-white mt-0.5">MTTR Trend (minutes)</p>
            </div>
            <select
              className="input w-36 text-xs py-1.5 font-mono"
              value={mttrDays}
              onChange={e => setMttrDays(parseInt(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>

          {mttrLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : mttrChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mttrChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="m" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mttr" name="MTTR (min)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-600">
              <span className="text-3xl mb-3">📊</span>
              <p className="text-sm font-mono">No resolved incidents in this period</p>
              <p className="text-xs text-slate-700 mt-1">Resolve some incidents to see MTTR trends</p>
            </div>
          )}
        </div>

        {/* Incidents per component bar chart */}
        {services.length > 0 && (
          <div className="card p-5">
            <div className="mb-5">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Incident Distribution</p>
              <p className="text-sm font-bold text-white mt-0.5">Total Incidents by Component</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={services.slice(0, 10).map((s: any) => ({ name: s.component_id, total: s.total_incidents, active: s.active_incidents }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total" fill="#3b82f6" opacity={0.7} radius={[3,3,0,0]} />
                <Bar dataKey="active" name="Active" fill="#ef4444" opacity={0.8} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Service Health Table */}
        <div className="card">
          <div className="px-5 py-4 border-b border-[#1e2d45]">
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Service Health Map</p>
            <p className="text-sm font-bold text-white mt-0.5">All Monitored Components</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d45]">
                  <th className="table-header">Component</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Health</th>
                  <th className="table-header">Active</th>
                  <th className="table-header">Total</th>
                </tr>
              </thead>
              <tbody>
                {healthLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1e2d45]/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="table-cell"><div className="h-3 bg-[#1e2d45] rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : services.length === 0 ? (
                  <tr><td colSpan={5} className="table-cell text-center py-10 text-slate-600 font-mono text-xs">NO SERVICE DATA — trigger some incidents first</td></tr>
                ) : services.map((s: any) => {
                  const h = HEALTH_STYLE[s.health_status] || HEALTH_STYLE.healthy;
                  return (
                    <tr key={s.component_id} className="border-b border-[#1e2d45]/50 hover:bg-blue-500/3 transition-colors">
                      <td className="table-cell font-mono text-xs text-slate-300">{s.component_id}</td>
                      <td className="table-cell">
                        <span className="text-sm">{COMPONENT_TYPE_ICONS[s.component_type] || '◈'}</span>
                        <span className="text-xs text-slate-500 font-mono ml-1.5">{s.component_type}</span>
                      </td>
                      <td className="table-cell">
                        <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold font-mono border', h.cls)}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full', h.dot)} />
                          {h.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={clsx('text-sm font-bold font-mono', s.active_incidents > 0 ? 'text-red-400' : 'text-slate-600')}>
                          {s.active_incidents}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500 text-sm font-mono">{s.total_incidents}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
