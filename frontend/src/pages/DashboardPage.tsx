import React, { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import { incidentsApi } from '../api/incidents';
import { apiClient } from '../api/client';
import { StatCard } from '../components/ui/StatCard';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TopBar } from '../components/dashboard/TopBar';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatRelativeTime, formatDuration, COMPONENT_TYPE_ICONS } from '../utils/formatters';
import { Incident } from '../types';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const SEV_COLORS: Record<string, string> = {
  P0_CRITICAL: '#ef4444', P1_HIGH: '#f97316',
  P2_MEDIUM: '#eab308', P3_LOW: '#10b981', P4_INFO: '#64748b',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-[#1e2d45] rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

interface Props { onMenuClick?: () => void; }

export const DashboardPage: React.FC<Props> = ({ onMenuClick }) => {
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: analyticsApi.getDashboard,
    refetchInterval: 15000,
  });

  const { data: incidentsData, isLoading: incidentsLoading } = useQuery({
    queryKey: ['incidents', { page: 1, page_size: 10, sort_by: 'created_at', sort_dir: 'desc' }],
    queryFn: () => incidentsApi.list({ page: 1, page_size: 10, sort_by: 'created_at', sort_dir: 'desc' }),
    refetchInterval: 15000,
  });

  const { data: health } = useQuery({
    queryKey: ['health-dashboard'],
    queryFn: async () => { const { data } = await apiClient.get('/health', { baseURL: '' }); return data; },
    refetchInterval: 30000,
  });

  const handleWsMessage = useCallback((msg: any) => {
    // New incident created
    if (msg.type === 'incident_created') {
      const isCritical = msg.severity === 'CRITICAL' || msg.severity === 'P0_CRITICAL';
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-fade-in' : ''} max-w-sm bg-[#0d1117] border ${isCritical ? 'border-red-500/40' : 'border-orange-500/30'} rounded-xl p-4 shadow-2xl`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">{isCritical ? '🚨' : '⚠️'}</span>
            <div>
              <p className="font-bold text-white text-sm">{isCritical ? 'CRITICAL INCIDENT' : 'New Incident'}</p>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{msg.component_id} · {msg.severity}</p>
            </div>
          </div>
        </div>
      ), { duration: isCritical ? 8000 : 5000 });
    }

    // Signal grouped into existing incident
    if (msg.type === 'incident_updated' && !msg.debounced) {
      // Silent update — just refresh data, no toast needed
    }

    // Escalation
    if (msg.type === 'escalated') {
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-fade-in' : ''} max-w-sm bg-[#0d1117] border border-yellow-500/30 rounded-xl p-4 shadow-2xl`}>
          <div className="flex items-start gap-3">
            <span className="text-xl">📈</span>
            <div>
              <p className="font-bold text-white text-sm">Incident Escalated</p>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">{msg.from_severity} → {msg.to_severity}</p>
            </div>
          </div>
        </div>
      ), { duration: 6000 });
    }

    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  }, [queryClient]);

  useWebSocket({ onMessage: handleWsMessage });

  const severityChartData = summary
    ? Object.entries(summary.severity_distribution).map(([k, v]) => ({
        name: k.replace('_', ' '), value: v as number, color: SEV_COLORS[k] || '#64748b',
      }))
    : [];

  const hourlyData = (summary?.incidents_per_hour || []).map(h => ({
    hour: h.hour ? new Date(h.hour).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    count: h.count,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Dashboard" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 space-y-5">
        {/* Stat cards row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Incidents" value={summary?.total_incidents ?? '—'} subtitle="All time — all statuses" icon={<span className="text-lg">◈</span>} color="default" loading={summaryLoading} />
          <StatCard title="Active" value={summary?.active_incidents ?? '—'} subtitle="Open + Investigating + Mitigated" icon={<span className="text-lg">◉</span>} color="orange" loading={summaryLoading} pulse={(summary?.active_incidents ?? 0) > 0} />
          <StatCard title="Critical P0" value={summary?.critical_incidents ?? '—'} subtitle="Active incidents at P0 severity" icon={<span className="text-lg">⬡</span>} color="red" loading={summaryLoading} pulse={(summary?.critical_incidents ?? 0) > 0} />
          <StatCard title="Resolved" value={summary?.resolved_incidents ?? '—'} subtitle={`MTTR avg ${formatDuration(summary?.mttr_today_seconds)}`} icon={<span className="text-lg">○</span>} color="green" loading={summaryLoading} />
        </div>

        {/* Stat cards row 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Signals / sec" value={summary?.signals_per_second ?? 0} subtitle="0 = no signals right now" icon={<span className="text-lg">⚡</span>} color="cyan" loading={summaryLoading} />
          <StatCard title="Queue Backlog" value={summary?.queue_backlog ?? 0} subtitle="0 = all processed (healthy)" icon={<span className="text-lg">◎</span>} color="purple" loading={summaryLoading} />
          <StatCard title="MTTR Today" value={formatDuration(summary?.mttr_today_seconds)} subtitle="Mean time to repair" icon={<span className="text-lg">⏱</span>} color="blue" loading={summaryLoading} />
          <StatCard title="Total Signals" value={(summary?.total_signals_processed ?? 0).toLocaleString()} subtitle="Processed" icon={<span className="text-lg">◈</span>} color="default" loading={summaryLoading} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Incidents over time */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Incident Volume</p>
                <p className="text-sm font-bold text-white mt-0.5">Last 7 Days</p>
              </div>
              <span className="text-xs font-mono text-slate-600 border border-[#1e2d45] px-2 py-1 rounded">
                {hourlyData.reduce((a, b) => a + b.count, 0)} total
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="Incidents" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Severity pie */}
          <div className="card p-5">
            <div className="mb-5">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Active by Severity</p>
              <p className="text-sm font-bold text-white mt-0.5">Distribution</p>
            </div>
            {severityChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={severityChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                      {severityChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {severityChartData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-slate-400 font-mono">{d.name}</span>
                      </div>
                      <span className="font-bold text-white font-mono">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <span className="text-3xl mb-2">✓</span>
                <p className="text-xs font-mono">No active incidents</p>
              </div>
            )}
          </div>
        </div>

        {/* Team + Noisy */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="mb-4">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Team Performance</p>
              <p className="text-sm font-bold text-white mt-0.5">Response Metrics</p>
            </div>
            <div className="space-y-3">
              {(summary?.team_performance || []).slice(0, 6).map((t, i) => (
                <div key={t.team} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-700 w-4">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300 truncate">{t.team}</span>
                      <span className="text-xs font-mono text-blue-400 flex-shrink-0 ml-2">{formatDuration(t.avg_mttr)}</span>
                    </div>
                    <div className="w-full bg-[#1e2d45] rounded-full h-1">
                      <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-1 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (t.total / Math.max(...(summary?.team_performance || []).map(x => x.total), 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 font-mono w-8 text-right">{t.total}</span>
                </div>
              ))}
              {(!summary?.team_performance?.length) && (
                <p className="text-xs text-slate-600 font-mono text-center py-4">No data yet</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Noise Analysis</p>
              <p className="text-sm font-bold text-white mt-0.5">Top Noisy Components</p>
            </div>
            <div className="space-y-3">
              {(summary?.top_noisy_components || []).slice(0, 6).map((c, i) => {
                const max = summary?.top_noisy_components[0]?.signal_count || 1;
                const pct = Math.min(100, (c.signal_count / max) * 100);
                return (
                  <div key={c.component} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-700 w-4">#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-300 truncate">{c.component}</span>
                        <span className="text-xs font-mono text-orange-400 flex-shrink-0 ml-2">{c.signal_count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-[#1e2d45] rounded-full h-1">
                        <div className="bg-gradient-to-r from-orange-600 to-orange-400 h-1 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* System Health strip */}
        {health && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">System Health</p>
              <span className={clsx(
                'text-xs font-mono px-2 py-0.5 rounded-md border',
                health.status === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              )}>
                {health.status?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(health.services || {}).map(([svc, status]) => {
                const isUp = (status as string).startsWith('up');
                const isFallback = (status as string).startsWith('unavailable');
                return (
                  <div key={svc} className="flex items-center gap-2">
                    <span className={clsx(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      isUp ? 'bg-emerald-400 shadow-[0_0_4px_#34d399] animate-pulse' :
                      isFallback ? 'bg-yellow-400' : 'bg-red-400 shadow-[0_0_4px_#f87171]'
                    )} />
                    <div>
                      <p className="text-xs font-mono text-slate-400 capitalize">{svc}</p>
                      <p className={clsx('text-xs font-mono font-bold',
                        isUp ? 'text-emerald-400' : isFallback ? 'text-yellow-400' : 'text-red-400'
                      )}>
                        {isUp ? 'UP' : isFallback ? 'FALLBACK' : 'DOWN'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent incidents table */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45]">
            <div>
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Recent Activity</p>
              <p className="text-sm font-bold text-white mt-0.5">Latest Incidents</p>
            </div>
            <Link to="/incidents" className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors border border-blue-500/20 px-3 py-1.5 rounded-lg hover:border-blue-500/40">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e2d45]">
                  <th className="table-header">Incident</th>
                  <th className="table-header hidden sm:table-cell">Component</th>
                  <th className="table-header">Severity</th>
                  <th className="table-header hidden md:table-cell">Status</th>
                  <th className="table-header hidden lg:table-cell">Team</th>
                  <th className="table-header hidden lg:table-cell">Signals</th>
                  <th className="table-header">Age</th>
                </tr>
              </thead>
              <tbody>
                {incidentsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1e2d45]/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="table-cell">
                          <div className="h-3 bg-[#1e2d45] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (incidentsData?.items || []).map((inc: Incident) => (
                  <tr key={inc.id} className="border-b border-[#1e2d45]/50 hover:bg-blue-500/3 transition-colors group">
                    <td className="table-cell">
                      <Link to={`/incidents/${inc.id}`}>
                        <p className="font-semibold text-slate-200 text-sm group-hover:text-blue-400 transition-colors line-clamp-1">{inc.title}</p>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">
                          #{inc.incident_number || inc.id.slice(0,8)}
                          {inc.rca_completed && <span className="ml-2 text-emerald-500">✓RCA</span>}
                        </p>
                      </Link>
                    </td>
                    <td className="table-cell hidden sm:table-cell">
                      <span className="text-xs font-mono text-slate-500">
                        {COMPONENT_TYPE_ICONS[inc.component_type] || '◈'} {inc.component_id}
                      </span>
                    </td>
                    <td className="table-cell"><SeverityBadge severity={inc.severity} size="sm" /></td>
                    <td className="table-cell hidden md:table-cell"><StatusBadge status={inc.status} size="sm" /></td>
                    <td className="table-cell hidden lg:table-cell">
                      <span className="text-xs text-slate-500 font-mono">{inc.team || '—'}</span>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <span className="text-xs font-mono text-slate-500">{inc.signal_count.toLocaleString()}</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-600 font-mono">{formatRelativeTime(inc.created_at)}</span>
                    </td>
                  </tr>
                ))}
                {!incidentsLoading && !incidentsData?.items?.length && (
                  <tr><td colSpan={7} className="table-cell text-center py-10 text-slate-600 font-mono text-xs">NO INCIDENTS FOUND</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
