import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi, IncidentFilters } from '../api/incidents';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { InlineReassign } from '../components/incidents/InlineReassign';
import { TopBar } from '../components/dashboard/TopBar';
import { formatRelativeTime, formatDuration, COMPONENT_TYPE_ICONS } from '../utils/formatters';
import { useAuthStore } from '../store/authStore';
import { Incident } from '../types';

interface Props { onMenuClick?: () => void; }

const SEVERITIES = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW', 'P4_INFO'];
const STATUSES   = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED', 'REOPENED'];

export const IncidentsPage: React.FC<Props> = ({ onMenuClick }) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState<IncidentFilters>({
    page: 1, page_size: 20, sort_by: 'created_at', sort_dir: 'desc',
  });
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['incidents', filters, search],
    queryFn: () => incidentsApi.list({ ...filters, search: search || undefined }),
    refetchInterval: 30000,
  });

  const updateFilter = (key: keyof IncidentFilters, value: string) => {
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Incidents" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                className="input"
                placeholder="Search by title, component, or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && refetch()}
              />
            </div>
            <select className="input sm:w-40" onChange={e => updateFilter('severity', e.target.value)}>
              <option value="">All Severities</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <select className="input sm:w-40" onChange={e => updateFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input sm:w-36" onChange={e => updateFilter('sort_dir', e.target.value)}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data ? `${data.total.toLocaleString()} incidents` : 'Loading...'}
              </p>
              {isAdmin && (
                <span className="text-xs bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded-full">
                  ✏️ Click owner to reassign
                </span>
              )}
            </div>
            <button onClick={() => refetch()} className="btn-secondary text-xs py-1.5">
              ↻ Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="table-header">Incident</th>
                  <th className="table-header hidden sm:table-cell">Component</th>
                  <th className="table-header">Severity</th>
                  <th className="table-header">Status</th>
                  {/* Owner column — shows reassign dropdown for admin, plain text for others */}
                  <th className="table-header hidden md:table-cell">
                    Owner {isAdmin && <span className="text-brand-400 ml-1">↕</span>}
                  </th>
                  <th className="table-header hidden lg:table-cell">Signals</th>
                  <th className="table-header hidden lg:table-cell">MTTR</th>
                  <th className="table-header">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="table-cell">
                          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (data?.items || []).map((inc: Incident) => (
                  <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                    {/* Title */}
                    <td className="table-cell max-w-xs">
                      <Link to={`/incidents/${inc.id}`} className="block">
                        <p className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                          {inc.title}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          #{inc.incident_number || inc.id.slice(0, 8)}
                          {inc.rca_completed && <span className="ml-2 text-green-500">✓ RCA</span>}
                        </p>
                      </Link>
                    </td>

                    {/* Component */}
                    <td className="table-cell hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{COMPONENT_TYPE_ICONS[inc.component_type] || '❓'}</span>
                        <span className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                          {inc.component_id}
                        </span>
                      </div>
                    </td>

                    {/* Severity */}
                    <td className="table-cell">
                      <SeverityBadge severity={inc.severity} size="sm" />
                    </td>

                    {/* Status */}
                    <td className="table-cell">
                      <StatusBadge status={inc.status} size="sm" />
                    </td>

                    {/* Owner — inline reassign for admin, plain text for others */}
                    <td className="table-cell hidden md:table-cell">
                      {isAdmin ? (
                        <InlineReassign incident={inc} />
                      ) : (
                        <span className={`text-xs ${!inc.assignee_name && !inc.team ? 'text-orange-500 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          {inc.assignee_name || inc.team || 'Unassigned'}
                        </span>
                      )}
                    </td>

                    {/* Signals */}
                    <td className="table-cell hidden lg:table-cell">
                      <span className="text-xs font-mono text-gray-500">{inc.signal_count.toLocaleString()}</span>
                    </td>

                    {/* MTTR */}
                    <td className="table-cell hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{formatDuration(inc.mttr_seconds)}</span>
                    </td>

                    {/* Created */}
                    <td className="table-cell whitespace-nowrap">
                      <span className="text-xs text-gray-500">{formatRelativeTime(inc.created_at)}</span>
                    </td>
                  </tr>
                ))}

                {!isLoading && (!data?.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={8} className="table-cell text-center py-12">
                      <p className="text-gray-400 text-sm">No incidents found</p>
                      <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500">
                Page {data.page} of {data.total_pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, (f.page || 1) - 1) }))}
                  disabled={(filters.page || 1) <= 1}
                  className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(data.total_pages, (f.page || 1) + 1) }))}
                  disabled={(filters.page || 1) >= data.total_pages}
                  className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
