import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi, AISummary } from '../../api/ai';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import clsx from 'clsx';

interface Props {
  incidentId: string;
}

const CONFIDENCE_COLORS = {
  high:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const SOURCE_COLORS = {
  'ai':          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'rule-based':  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export const AISummaryTab: React.FC<Props> = ({ incidentId }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-summary', incidentId, refreshKey],
    queryFn: () => aiApi.getSummary(incidentId, refreshKey > 0),
    staleTime: 600000, // 10 minutes
    retry: 1,
  });

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner size="lg" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Generating AI Summary...</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Analyzing incident signals, patterns, and component history
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">Failed to generate summary</p>
        <p className="text-xs text-gray-500 mt-1">Check backend logs for details</p>
        <button onClick={() => refetch()} className="btn-secondary mt-4 text-xs">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">AI Incident Analysis</span>
          <span className={clsx('badge text-xs', SOURCE_COLORS[data.source] || SOURCE_COLORS['rule-based'])}>
            {data.source === 'ai' ? `✨ ${data.model}` : '⚙️ Rule Engine'}
          </span>
          <span className={clsx('badge text-xs', CONFIDENCE_COLORS[data.confidence])}>
            {data.confidence} confidence
          </span>
          {data.cached && (
            <span className="badge text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              cached
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="btn-secondary text-xs py-1.5"
          title="Regenerate summary"
        >
          ↻ Refresh
        </button>
      </div>

      {/* HF Token note */}
      {data.note && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
          <span className="text-blue-500 flex-shrink-0">ℹ️</span>
          <p className="text-xs text-blue-700 dark:text-blue-300">{data.note}</p>
        </div>
      )}

      {/* Executive Summary */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          📋 Executive Summary
        </h3>
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {data.executive_summary}
        </p>
      </div>

      {/* Two column: Technical + Business Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            🔧 Technical Summary
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {data.technical_summary}
          </p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            💼 Business Impact
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {data.business_impact}
          </p>
        </div>
      </div>

      {/* Likely Cause + ETA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            🔍 Likely Root Cause
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {data.likely_cause}
          </p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            ⏱️ Estimated Resolution
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {data.estimated_resolution_time}
          </p>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Severity Assessment
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">{data.severity_assessment}</p>
          </div>
        </div>
      </div>

      {/* Immediate Actions */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          ⚡ Immediate Actions
        </h3>
        <ol className="space-y-2">
          {(data.immediate_actions || []).map((action, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Prevention Suggestions */}
      <div className="card p-5">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          🛡️ Prevention Suggestions
        </h3>
        <ul className="space-y-2">
          {(data.prevention_suggestions || []).map((suggestion, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
