import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi, AISummary } from '../../api/ai';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import clsx from 'clsx';

interface Props { incidentId: string; }

const CONFIDENCE_STYLE: Record<string, string> = {
  high:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low:    'bg-red-500/10 text-red-400 border-red-500/30',
};

export const AISummaryTab: React.FC<Props> = ({ incidentId }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-summary', incidentId, refreshKey],
    queryFn: () => aiApi.getSummary(incidentId, refreshKey > 0),
    staleTime: 600000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="card p-10 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner size="lg" />
        <div className="text-center">
          <p className="text-sm font-semibold text-white">Analyzing Incident...</p>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Processing signals, patterns and component history
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="card p-10 text-center">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="text-sm font-semibold text-white">Analysis failed</p>
        <button onClick={() => refetch()} className="btn-secondary mt-4 text-xs">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-bold text-white">AI Incident Analysis</span>
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold font-mono border',
            CONFIDENCE_STYLE[data.confidence] || CONFIDENCE_STYLE.medium
          )}>
            {data.confidence} confidence
          </span>
          {data.cached && (
            <span className="text-xs font-mono text-slate-600 border border-[#1e2d45] px-2 py-0.5 rounded">
              cached
            </span>
          )}
        </div>
        <button onClick={() => { setRefreshKey(k => k + 1); refetch(); }} className="btn-secondary text-xs py-1.5">
          ↻ Regenerate
        </button>
      </div>

      {/* Executive Summary */}
      <div className="card p-5">
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">📋 Executive Summary</p>
        <p className="text-sm text-slate-200 leading-relaxed">{data.executive_summary}</p>
      </div>

      {/* Technical + Business Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">🔧 Technical Analysis</p>
          <p className="text-sm text-slate-300 leading-relaxed">{data.technical_summary}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">💼 Business Impact</p>
          <p className="text-sm text-slate-300 leading-relaxed">{data.business_impact}</p>
        </div>
      </div>

      {/* Likely Cause + ETA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">🔍 Likely Root Cause</p>
          <p className="text-sm text-slate-300 leading-relaxed">{data.likely_cause}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">⏱ Estimated Resolution</p>
          <p className="text-sm text-slate-300">{data.estimated_resolution_time}</p>
          <div className="mt-3 pt-3 border-t border-[#1e2d45]">
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-1">Severity Assessment</p>
            <p className="text-xs text-slate-400">{data.severity_assessment}</p>
          </div>
        </div>
      </div>

      {/* Immediate Actions */}
      <div className="card p-5">
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-4">⚡ Immediate Actions</p>
        <ol className="space-y-3">
          {(data.immediate_actions || []).map((action, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md text-xs font-bold font-mono flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-slate-300">{action}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Prevention */}
      <div className="card p-5">
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-4">🛡️ Prevention Suggestions</p>
        <ul className="space-y-2">
          {(data.prevention_suggestions || []).map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-emerald-400 flex-shrink-0 mt-0.5 text-xs">✓</span>
              <span className="text-sm text-slate-300">{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
