import React from 'react';
import { IncidentStatus } from '../../types';
import clsx from 'clsx';

const CONFIG: Record<IncidentStatus, { label: string; cls: string }> = {
  OPEN:          { label: 'Open',          cls: 'bg-red-500/10 text-red-400 border border-red-500/25' },
  ACKNOWLEDGED:  { label: 'Acknowledged',  cls: 'bg-orange-500/10 text-orange-400 border border-orange-500/25' },
  INVESTIGATING: { label: 'Investigating', cls: 'bg-purple-500/10 text-purple-400 border border-purple-500/25' },
  MITIGATED:     { label: 'Mitigated',     cls: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25' },
  RESOLVED:      { label: 'Resolved',      cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' },
  CLOSED:        { label: 'Closed',        cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
  REOPENED:      { label: 'Reopened',      cls: 'bg-red-500/10 text-red-400 border border-red-500/25' },
  CANCELLED:     { label: 'Cancelled',     cls: 'bg-slate-500/10 text-slate-500 border border-slate-600/20' },
};

interface Props { status: IncidentStatus; size?: 'sm' | 'md'; }

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const c = CONFIG[status] ?? CONFIG.OPEN;
  return (
    <span className={clsx(
      'inline-flex items-center rounded-md font-semibold font-mono',
      c.cls,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      {c.label}
    </span>
  );
};
