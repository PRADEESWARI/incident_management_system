import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { simulatorApi } from '../api/simulator';
import { TopBar } from '../components/dashboard/TopBar';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Props { onMenuClick?: () => void; }

const SCENARIO_ICONS: Record<string, string> = {
  api_down: '🌐', db_down: '🗄️', db_slow_query: '🐌', queue_lag: '📨',
  cache_failure: '⚡', memory_full: '💾', cpu_spike: '🔥', security_attack: '🔒',
  ssl_expiry: '🔐', latency_spike: '⏱️', consumer_crash: '💥', disk_full: '💿',
  nosql_failure: '📦',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export const SimulatorPage: React.FC<Props> = ({ onMenuClick }) => {
  const [loadTestConfig, setLoadTestConfig] = useState({ rps: 100, duration: 10, scenario: 'api_down' });
  const [stormConfig, setStormConfig] = useState({ component_id: 'payment-api', count: 50 });
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: scenariosData } = useQuery({
    queryKey: ['simulator-scenarios'],
    queryFn: simulatorApi.getScenarios,
  });

  const triggerMutation = useMutation({
    mutationFn: ({ scenario, count }: { scenario: string; count: number }) =>
      simulatorApi.trigger(scenario, { count }),
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(`Triggered ${data.triggered} signal(s)`);
    },
    onError: () => toast.error('Failed to trigger scenario'),
  });

  const loadTestMutation = useMutation({
    mutationFn: () => simulatorApi.loadTest(loadTestConfig.rps, loadTestConfig.duration, loadTestConfig.scenario),
    onSuccess: (data) => {
      toast.success(data.message);
    },
  });

  const stormMutation = useMutation({
    mutationFn: () => simulatorApi.duplicateStorm(stormConfig.component_id, stormConfig.count),
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(`Storm complete: ${data.noise_reduction_pct}% noise reduction`);
    },
  });

  const cascadeMutation = useMutation({
    mutationFn: () => simulatorApi.trigger('cascade', { count: 8 }),
    onSuccess: (data) => {
      setLastResult(data);
      toast.success('Cascading outage scenario triggered');
    },
  });

  const randomMutation = useMutation({
    mutationFn: () => simulatorApi.trigger('random', { count: 5 }),
    onSuccess: (data) => {
      setLastResult(data);
      toast.success('Random multi-service failure triggered');
    },
  });

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Chaos Simulator" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Warning banner */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Chaos Testing Environment</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                These actions generate real signals and incidents in the system. Use for testing and demo purposes only.
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">🌊 Cascading Outage</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Simulate a DB outage causing API failures, queue lag, and cache issues simultaneously.
            </p>
            <button
              onClick={() => cascadeMutation.mutate()}
              disabled={cascadeMutation.isPending}
              className="btn-danger w-full justify-center"
            >
              {cascadeMutation.isPending ? 'Triggering...' : 'Trigger Cascade'}
            </button>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">🎲 Random Multi-Failure</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Trigger 5 random failures across different services and components.
            </p>
            <button
              onClick={() => randomMutation.mutate()}
              disabled={randomMutation.isPending}
              className="btn-secondary w-full justify-center"
            >
              {randomMutation.isPending ? 'Triggering...' : 'Random Failures'}
            </button>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">🌪️ Duplicate Alert Storm</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Test debouncing with a flood of duplicate alerts.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                className="input text-xs"
                placeholder="Component ID"
                value={stormConfig.component_id}
                onChange={e => setStormConfig(s => ({ ...s, component_id: e.target.value }))}
              />
              <input
                type="number"
                className="input text-xs w-20"
                min={10}
                max={200}
                value={stormConfig.count}
                onChange={e => setStormConfig(s => ({ ...s, count: parseInt(e.target.value) }))}
              />
            </div>
            <button
              onClick={() => stormMutation.mutate()}
              disabled={stormMutation.isPending}
              className="btn-secondary w-full justify-center"
            >
              {stormMutation.isPending ? 'Running...' : `Storm (${stormConfig.count} signals)`}
            </button>
          </div>
        </div>

        {/* Load test */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">⚡ Load Test</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Signals/sec</label>
              <input
                type="number"
                className="input"
                min={1}
                max={1000}
                value={loadTestConfig.rps}
                onChange={e => setLoadTestConfig(c => ({ ...c, rps: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Duration (seconds)</label>
              <input
                type="number"
                className="input"
                min={1}
                max={60}
                value={loadTestConfig.duration}
                onChange={e => setLoadTestConfig(c => ({ ...c, duration: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Scenario</label>
              <select
                className="input"
                value={loadTestConfig.scenario}
                onChange={e => setLoadTestConfig(c => ({ ...c, scenario: e.target.value }))}
              >
                {(scenariosData?.scenarios || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => loadTestMutation.mutate()}
              disabled={loadTestMutation.isPending}
              className="btn-primary"
            >
              {loadTestMutation.isPending ? 'Running...' : `Start Load Test (${loadTestConfig.rps * loadTestConfig.duration} total signals)`}
            </button>
            <p className="text-xs text-gray-500">
              Runs in background. Check dashboard for live metrics.
            </p>
          </div>
        </div>

        {/* Individual scenarios */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Individual Scenarios</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800">
            {(scenariosData?.scenarios || []).map(scenario => (
              <div key={scenario.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{SCENARIO_ICONS[scenario.id] || '⚡'}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{scenario.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{scenario.component}</p>
                    <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded mt-1 inline-block', SEVERITY_COLORS[scenario.severity] || '')}>
                      {scenario.severity}
                    </span>
                  </div>
                  <button
                    onClick={() => triggerMutation.mutate({ scenario: scenario.id, count: 1 })}
                    disabled={triggerMutation.isPending}
                    className="btn-secondary text-xs py-1.5 flex-shrink-0"
                  >
                    Trigger
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Last Result</h3>
            <pre className="json-viewer text-xs">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
};
