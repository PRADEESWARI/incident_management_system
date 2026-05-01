import { IncidentSeverity, IncidentStatus } from '../types';

export function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export const SEVERITY_CONFIG: Record<IncidentSeverity, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}> = {
  P0_CRITICAL: {
    label: 'P0 Critical',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  P1_HIGH: {
    label: 'P1 High',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
  },
  P2_MEDIUM: {
    label: 'P2 Medium',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    dot: 'bg-yellow-500',
  },
  P3_LOW: {
    label: 'P3 Low',
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
  },
  P4_INFO: {
    label: 'P4 Info',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-400',
  },
};

export const STATUS_CONFIG: Record<IncidentStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  OPEN: { label: 'Open', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  INVESTIGATING: { label: 'Investigating', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  MITIGATED: { label: 'Mitigated', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  RESOLVED: { label: 'Resolved', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  CLOSED: { label: 'Closed', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' },
  REOPENED: { label: 'Reopened', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500 dark:text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800' },
};

export const COMPONENT_TYPE_ICONS: Record<string, string> = {
  API: '🌐',
  SERVER: '🖥️',
  CACHE: '⚡',
  QUEUE: '📨',
  RDBMS: '🗄️',
  NOSQL: '📦',
  SECURITY: '🔒',
  NETWORK: '🔗',
  UNKNOWN: '❓',
};
