import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentsApi } from '../api/incidents';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { TopBar } from '../components/dashboard/TopBar';
import { RCAForm } from '../components/rca/RCAForm';
import { AISummaryTab } from '../components/incidents/AISummaryTab';
import { formatDateTime, formatRelativeTime, formatDuration, COMPONENT_TYPE_ICONS } from '../utils/formatters';
import { useAuthStore } from '../store/authStore';
import { IncidentStatus } from '../types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Props { onMenuClick?: () => void; }

const TRANSITIONS: Record<string, { label: string; color: string; next: IncidentStatus }[]> = {
  OPEN:          [{ label: 'Acknowledge', color: 'btn-secondary', next: 'ACKNOWLEDGED' }, { label: 'Start Investigation', color: 'btn-primary', next: 'INVESTIGATING' }],
  ACKNOWLEDGED:  [{ label: 'Start Investigation', color: 'btn-primary', next: 'INVESTIGATING' }],
  INVESTIGATING: [{ label: 'Mark Mitigated', color: 'btn-secondary', next: 'MITIGATED' }, { label: 'Mark Resolved', color: 'btn-primary', next: 'RESOLVED' }],
  MITIGATED:     [{ label: 'Mark Resolved', color: 'btn-primary', next: 'RESOLVED' }, { label: 'Reopen', color: 'btn-danger', next: 'REOPENED' }],
  RESOLVED:      [{ label: 'Close Incident', color: 'btn-primary', next: 'CLOSED' }, { label: 'Reopen', color: 'btn-danger', next: 'REOPENED' }],
  CLOSED:        [{ label: 'Reopen', color: 'btn-danger', next: 'REOPENED' }],
  REOPENED:      [{ label: 'Acknowledge', color: 'btn-secondary', next: 'ACKNOWLEDGED' }, { label: 'Start Investigation', color: 'btn-primary', next: 'INVESTIGATING' }],
};

export const IncidentDetailPage: React.FC<Props> = ({ onMenuClick }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'timeline' | 'rca' | 'comments' | 'ai'>('overview');
  const [comment, setComment] = useState('');
  const [showRCAForm, setShowRCAForm] = useState(false);

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentsApi.get(id!),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const { data: signalsData } = useQuery({
    queryKey: ['incident-signals', id],
    queryFn: () => incidentsApi.getSignals(id!),
    enabled: !!id && activeTab === 'signals',
  });

  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['incident-comments', id],
    queryFn: () => incidentsApi.getComments(id!),
    enabled: !!id && activeTab === 'comments',
  });

  const { data: historyData } = useQuery({
    queryKey: ['incident-history', id],
    queryFn: () => incidentsApi.getHistory(id!),
    enabled: !!id && activeTab === 'timeline',
  });

  const { data: rcaData } = useQuery({
    queryKey: ['incident-rca', id],
    queryFn: () => incidentsApi.getRCA(id!),
    enabled: !!id && activeTab === 'rca',
    retry: false,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ to_status, note }: { to_status: string; note?: string }) =>
      incidentsApi.transition(id!, to_status, note),
    onSuccess: () => {
      toast.success('Incident status updated');
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Transition failed'),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => incidentsApi.addComment(id!, content),
    onSuccess: () => { toast.success('Comment added'); setComment(''); refetchComments(); },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Incident Detail" onMenuClick={onMenuClick || (() => {})} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Incident Not Found" onMenuClick={onMenuClick || (() => {})} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">Incident not found</p>
            <button onClick={() => navigate('/incidents')} className="btn-primary mt-4">Back to Incidents</button>
          </div>
        </div>
      </div>
    );
  }

  const transitions = TRANSITIONS[incident.status] || [];
  const canEdit = user?.role !== 'viewer';
  const isAdmin = user?.role === 'admin';

  // Resolve display values
  const ownerDisplay = incident.assignee_name || incident.team || 'Unassigned';
  const ownerIsUnassigned = !incident.assignee_name && !incident.team;

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'signals',   label: `Signals (${incident.signal_count})` },
    { id: 'timeline',  label: 'Timeline' },
    { id: 'rca',       label: `RCA ${incident.rca_completed ? '✓' : ''}` },
    { id: 'comments',  label: 'Comments' },
    { id: 'ai',        label: '🤖 AI Summary' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={`INC-${incident.incident_number || incident.id.slice(0, 8)}`}
        onMenuClick={onMenuClick || (() => {})}
        actions={
          <button onClick={() => navigate('/incidents')} className="btn-secondary text-xs py-1.5">
            ← Back
          </button>
        }
      />

      <main className="flex-1 p-4 sm:p-6 space-y-4">
        {/* Header card */}
        <div className="card p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <SeverityBadge severity={incident.severity} />
                <StatusBadge status={incident.status} />
                {incident.rca_completed && (
                  <span className="badge bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">✓ RCA</span>
                )}
              </div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{incident.title}</h1>
              {incident.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{incident.description}</p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{COMPONENT_TYPE_ICONS[incident.component_type] || '❓'} {incident.component_id}</span>
                <span>📡 {incident.source || 'manual'}</span>

                {/* Owner display — clean read-only in detail page */}
                <span className="flex items-center gap-1">
                  👤
                  <span className={ownerIsUnassigned ? 'text-orange-500 dark:text-orange-400 font-medium' : ''}>
                    {ownerDisplay}
                  </span>
                  {ownerIsUnassigned && (
                    <span className="text-orange-400 text-xs">(unassigned — reassign from Incidents list)</span>
                  )}
                </span>

                <span>⏱ {formatRelativeTime(incident.created_at)}</span>
                {incident.mttr_seconds && <span>🔧 MTTR: {formatDuration(incident.mttr_seconds)}</span>}
              </div>

              {incident.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {incident.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {canEdit && transitions.length > 0 && (
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                {transitions.map(t => (
                  <button
                    key={t.next}
                    onClick={() => {
                      if (t.next === 'CLOSED' && !incident.rca_completed) {
                        toast.error('Complete RCA before closing the incident');
                        setActiveTab('rca');
                        setShowRCAForm(true);
                        return;
                      }
                      transitionMutation.mutate({ to_status: t.next });
                    }}
                    disabled={transitionMutation.isPending}
                    className={clsx(t.color, 'text-xs py-1.5')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Incident Details</h3>
              <dl className="space-y-3">
                {[
                  ['ID', incident.id],
                  ['Number', `#${incident.incident_number || '—'}`],
                  ['Component', `${COMPONENT_TYPE_ICONS[incident.component_type] || '❓'} ${incident.component_id}`],
                  ['Type', incident.component_type],
                  ['Source', incident.source || '—'],
                  ['Team', incident.team || '—'],
                  ['Assignee', incident.assignee_name || 'Unassigned'],
                  ['Signal Count', incident.signal_count.toLocaleString()],
                  ['First Signal', formatDateTime(incident.first_signal_at)],
                  ['Acknowledged', formatDateTime(incident.acknowledged_at)],
                  ['Resolved', formatDateTime(incident.resolved_at)],
                  ['MTTR', formatDuration(incident.mttr_seconds)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className={clsx(
                      'font-medium text-right max-w-[60%] truncate',
                      label === 'Assignee' && value === 'Unassigned'
                        ? 'text-orange-500 dark:text-orange-400'
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {/* Admin reassign moved to Incidents list page */}
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Extra Data</h3>
              <pre className="json-viewer text-xs overflow-auto max-h-64">
                {JSON.stringify(incident.extra_data, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="card">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Raw Signals ({signalsData?.count || 0})
              </p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto">
              {(signalsData?.signals || []).map((sig: any) => (
                <div key={sig._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded',
                          sig.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          sig.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        )}>
                          {sig.severity}
                        </span>
                        <span className="text-xs font-mono text-gray-500">{sig.signal_type}</span>
                      </div>
                      <p className="text-sm text-gray-900 dark:text-white">{sig.message}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">{sig._id}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatRelativeTime(sig.timestamp)}
                    </span>
                  </div>
                  {sig.metadata && Object.keys(sig.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">View metadata</summary>
                      <pre className="json-viewer mt-2 text-xs">{JSON.stringify(sig.metadata, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
              {(!signalsData?.signals || signalsData.signals.length === 0) && (
                <div className="p-8 text-center text-gray-400 text-sm">No signals found</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Status Timeline</h3>
            <div className="space-y-4">
              {(historyData?.history || []).map((h: any, i: number) => (
                <div key={h.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-500 flex-shrink-0 mt-1" />
                    {i < (historyData?.history?.length || 0) - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.from_status && <><StatusBadge status={h.from_status} size="sm" /><span className="text-gray-400 text-xs">→</span></>}
                      <StatusBadge status={h.to_status} size="sm" />
                    </div>
                    {h.note && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{h.note}</p>}
                    <p className="text-xs text-gray-400 mt-1">{h.changed_by_name || 'System'} · {formatDateTime(h.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rca' && (
          <div>
            {rcaData && !showRCAForm ? (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Root Cause Analysis</h3>
                  {canEdit && (
                    <button onClick={() => setShowRCAForm(true)} className="btn-secondary text-xs py-1.5">Edit RCA</button>
                  )}
                </div>
                <dl className="space-y-4">
                  {[['Category', rcaData.root_cause_category], ['Owner', rcaData.owner_name], ['MTTR', formatDuration(rcaData.mttr_seconds)], ['Start Time', formatDateTime(rcaData.incident_start_time)], ['End Time', formatDateTime(rcaData.incident_end_time)]].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</dt>
                      <dd className="text-sm text-gray-900 dark:text-white mt-1">{value}</dd>
                    </div>
                  ))}
                  {[['Root Cause Summary', rcaData.root_cause_summary], ['Fix Applied', rcaData.fix_applied], ['Prevention Steps', rcaData.prevention_steps], ['Lessons Learned', rcaData.lessons_learned]].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</dt>
                      <dd className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : canEdit ? (
              <RCAForm incidentId={id!} existingRca={rcaData} incident={incident} onSuccess={() => { setShowRCAForm(false); queryClient.invalidateQueries({ queryKey: ['incident-rca', id] }); queryClient.invalidateQueries({ queryKey: ['incident', id] }); }} />
            ) : (
              <div className="card p-8 text-center text-gray-400"><p>No RCA submitted yet</p></div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="card divide-y divide-gray-100 dark:divide-gray-800">
              {(commentsData?.comments || []).map((c: any) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-bold">
                      {(c.author_name || 'U').charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{c.author_name || 'Unknown'}</span>
                    {c.is_internal && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">Internal</span>}
                    <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 ml-9">{c.content}</p>
                </div>
              ))}
              {(!commentsData?.comments || commentsData.comments.length === 0) && (
                <div className="p-8 text-center text-gray-400 text-sm">No comments yet</div>
              )}
            </div>
            {canEdit && (
              <div className="card p-4">
                <textarea className="input resize-none" rows={3} placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} />
                <div className="flex justify-end mt-2">
                  <button onClick={() => comment.trim() && commentMutation.mutate(comment)} disabled={!comment.trim() || commentMutation.isPending} className="btn-primary text-xs py-1.5">
                    Add Comment
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <AISummaryTab incidentId={id!} />
        )}
      </main>
    </div>
  );
};
