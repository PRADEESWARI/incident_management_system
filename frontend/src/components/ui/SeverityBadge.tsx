import React from 'react';
import { IncidentSeverity } from '../../types';
import clsx from 'clsx';

const CONFIG: Record<IncidentSeverity, { label: string; cls: string; dot: string }> = {
  P0_CRITICAL: { label: 'P0 Critical', cls: 'bg-red-500/10 text-red-400 border border-red-500/30',    dot: 'bg-red-400 shadow-[0_0_4px_#f87171]' },
  P1_HIGH:     { label: 'P1 High',     cls: 'bg-orange-500/10 text-orange-400 border border-orange-500/30', dot: 'bg-orange-400 shadow-[0_0_4px_#fb923c]' },
  P2_MEDIUM:   { label: 'P2 Medium',   cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30', dot: 'bg-yellow-400' },
  P3_LOW:      { label: 'P3 Low',      cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30', dot: 'bg-emerald-400' },
  P4_INFO:     { label: 'P4 Info',     cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',  dot: 'bg-slate-500' },
};

interface Props { severity: IncidentSeverity; size?: 'sm' | 'md'; }

export const SeverityBadge: React.FC<Props> = ({ severity, size = 'md' }) => {
  const c = CONFIG[severity] ?? CONFIG.P4_INFO;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-md font-semibold font-mono',
      c.cls,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        c.dot,
        severity === 'P0_CRITICAL' && 'animate-pulse'
      )} />
      {c.label}
    </span>
  );
};
