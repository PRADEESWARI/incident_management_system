import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { aiApi } from '../../api/ai';
import { Incident } from '../../types';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const TEAMS = [
  'backend-team',
  'dba-team',
  'infrastructure-team',
  'security-team',
  'platform-team',
  'frontend-team',
  'devops-team',
];

interface Props {
  incident: Incident;
}

export const InlineReassign: React.FC<Props> = ({ incident }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'owner' | 'team'>('owner');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.listUsers,
    enabled: open,
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: ({ assigneeId, team }: { assigneeId?: string; team?: string }) =>
      aiApi.reassign(incident.id, assigneeId || incident.assignee_id || '', team || incident.team || ''),
    onSuccess: (data) => {
      toast.success(`Reassigned → ${data.assignee_name || data.team || 'updated'}`);
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Reassignment failed'),
  });

  const assignableUsers = users.filter(u => u.role !== 'viewer' && u.is_active);
  const isUnassigned = !incident.assignee_name && !incident.team;
  const displayLabel = incident.assignee_name || incident.team || 'Unassigned';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors group',
          isUnassigned
            ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        )}
        title="Click to reassign"
      >
        <span className="truncate max-w-[100px]">{displayLabel}</span>
        <svg className={clsx('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl animate-fade-in">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setTab('owner')}
              className={clsx(
                'flex-1 text-xs font-medium py-2.5 transition-colors',
                tab === 'owner'
                  ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              👤 Owner
            </button>
            <button
              onClick={() => setTab('team')}
              className={clsx(
                'flex-1 text-xs font-medium py-2.5 transition-colors',
                tab === 'team'
                  ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              👥 Team
            </button>
          </div>

          <div className="p-2 max-h-56 overflow-y-auto">
            {tab === 'owner' ? (
              <>
                {/* Unassign option */}
                <button
                  onClick={() => mutation.mutate({ assigneeId: '', team: incident.team || '' })}
                  disabled={mutation.isPending}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  — Unassigned
                </button>
                {assignableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => mutation.mutate({ assigneeId: u.id, team: u.team || incident.team || '' })}
                    disabled={mutation.isPending}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded-lg transition-colors',
                      incident.assignee_id === u.id
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-300 text-xs font-bold flex-shrink-0">
                        {u.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{u.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.team || u.role}</p>
                      </div>
                      {incident.assignee_id === u.id && (
                        <span className="ml-auto text-brand-500 text-xs flex-shrink-0">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <>
                <button
                  onClick={() => mutation.mutate({ assigneeId: incident.assignee_id || '', team: '' })}
                  disabled={mutation.isPending}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  — No Team
                </button>
                {TEAMS.map(t => (
                  <button
                    key={t}
                    onClick={() => mutation.mutate({ assigneeId: incident.assignee_id || '', team: t })}
                    disabled={mutation.isPending}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-xs rounded-lg transition-colors',
                      incident.team === t
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    <span>{t}</span>
                    {incident.team === t && <span className="ml-2 text-brand-500">✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>

          {mutation.isPending && (
            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-center">
              Saving...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
