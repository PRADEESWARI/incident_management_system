import React, { useState } from 'react';
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
  onClose: () => void;
  onSuccess: () => void;
}

export const ReassignModal: React.FC<Props> = ({ incident, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState(incident.assignee_id || '');
  const [selectedTeam, setSelectedTeam] = useState(incident.team || '');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.listUsers,
  });

  const mutation = useMutation({
    mutationFn: () => aiApi.reassign(incident.id, selectedUserId, selectedTeam),
    onSuccess: (data) => {
      toast.success(`Reassigned to ${data.assignee_name || 'new owner'} / ${data.team}`);
      queryClient.invalidateQueries({ queryKey: ['incident', incident.id] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['ai-summary', incident.id] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Reassignment failed');
    },
  });

  // Filter to only engineers and admins (not viewers)
  const assignableUsers = users.filter(u => u.role !== 'viewer' && u.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Reassign Incident</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{incident.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">
            ×
          </button>
        </div>

        {/* Current assignment */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-5 text-xs">
          <p className="text-gray-500 dark:text-gray-400 mb-1">Current Assignment</p>
          <p className="font-medium text-gray-900 dark:text-white">
            Owner: <span className="text-brand-600 dark:text-brand-400">{incident.assignee_name || 'Unassigned'}</span>
          </p>
          <p className="font-medium text-gray-900 dark:text-white mt-0.5">
            Team: <span className="text-brand-600 dark:text-brand-400">{incident.team || 'Unassigned'}</span>
          </p>
        </div>

        <div className="space-y-4">
          {/* Owner selection */}
          <div>
            <label className="label">Assign Owner</label>
            <select
              className="input"
              value={selectedUserId}
              onChange={e => {
                setSelectedUserId(e.target.value);
                // Auto-set team based on selected user
                const user = assignableUsers.find(u => u.id === e.target.value);
                if (user?.team) setSelectedTeam(user.team);
              }}
            >
              <option value="">— Unassigned —</option>
              {assignableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) {u.team ? `· ${u.team}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Team selection */}
          <div>
            <label className="label">Assign Team</label>
            <select
              className="input"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              <option value="">— No Team —</option>
              {TEAMS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!selectedUserId && !selectedTeam)}
            className="btn-primary flex-1 justify-center"
          >
            {mutation.isPending ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};
