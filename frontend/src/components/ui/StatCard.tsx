import React from 'react';
import clsx from 'clsx';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'default' | 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'cyan';
  loading?: boolean;
  pulse?: boolean;
}

const ACCENT: Record<string, string> = {
  default: 'stat-accent-blue',
  red:     'stat-accent-red',
  orange:  'stat-accent-orange',
  green:   'stat-accent-green',
  blue:    'stat-accent-blue',
  purple:  'stat-accent-purple',
  cyan:    'stat-accent-cyan',
};

const VALUE_COLOR: Record<string, string> = {
  default: 'text-white',
  red:     'text-red-400',
  orange:  'text-orange-400',
  green:   'text-emerald-400',
  blue:    'text-blue-400',
  purple:  'text-purple-400',
  cyan:    'text-cyan-400',
};

const ICON_BG: Record<string, string> = {
  default: 'bg-blue-500/10 border-blue-500/20',
  red:     'bg-red-500/10 border-red-500/20',
  orange:  'bg-orange-500/10 border-orange-500/20',
  green:   'bg-emerald-500/10 border-emerald-500/20',
  blue:    'bg-blue-500/10 border-blue-500/20',
  purple:  'bg-purple-500/10 border-purple-500/20',
  cyan:    'bg-cyan-500/10 border-cyan-500/20',
};

export const StatCard: React.FC<Props> = ({
  title, value, subtitle, icon, color = 'default', loading, pulse
}) => {
  return (
    <div className={clsx('card p-5 hover:card-glow transition-all duration-200', ACCENT[color])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest truncate mb-3">
            {title}
          </p>
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : (
            <p className={clsx(
              'text-2xl font-black tabular-nums tracking-tight',
              VALUE_COLOR[color],
              pulse && 'severity-pulse'
            )}>
              {value}
            </p>
          )}
          {subtitle && (
            <p className="mt-1.5 text-xs text-slate-600 font-mono">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={clsx(
            'p-2.5 rounded-lg border flex-shrink-0',
            ICON_BG[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
