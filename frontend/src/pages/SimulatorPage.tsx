import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { simulatorApi } from '../api/simulator';
import { TopBar } from '../components/dashboard/TopBar';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Props { onMenuClick?: () => void; }

const SEV_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const SCENARIO_ICONS: Record<string, string> = {
  api_down:        '🌐',
  db_down:         '🗄️',
  db_slow_query:   '🐌',
  queue_lag:       '📨',
  cache_failure:   '⚡',
  memory_full:     '💾',
  cpu_spike:       '🔥',
  security_attack: '🔒',
  ssl_expiry:      '🔐',
  latency_spike:   '⏱️',
  consumer_crash:  '💥',
  disk_full:       '💿',
  nosql_failure:   '📦',
};

export const SimulatorPage: React.FC<Props> = ({ onMenuClick }) => {
  const [triggering, setTriggering] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loadConfig, setLoadConfig] = useState({ rps: 50, duration: 10, scenario: 'api_down' });
  const [loadRunning, setLoadRunning] = useState(false);

  const { data: scenariosData } = useQuery({
    queryKey: ['simulator-scenarios'],
    queryFn: simulatorApi.getScenarios,
  });

  const triggerScenario = async (scenarioId: string, label: string) => {
    setTriggering(scenarioId);
    try {
      const result = await simulatorApi.trigger(scenarioId, { count: 1 });
      const r = result.results?.[0];
      setLastResult({ scenario: label, ...result });
      if (r?.created) {
        toast.success(`New incident created — ${r.component_id?.slice(-12)}`);
      } else if (r?.incident_id) {
        toast.success(`Signal sent → grouped into incident ${r.incident_id?.slice(0, 8)}`);
      } else {
        toast.error('Trigger failed — no incident returned');
      }
    } catch {
      toast.error('Trigger failed');
    } finally {
      setTriggering(null);
    }
  };

  const triggerCascade = async () => {
    setTriggering('cascade');
    try {
      const result = await simulatorApi.trigger('cascade', { count: 4 });
      setLastResult({ scenario: 'Cascading Outage', ...result });
      toast.success(`Cascading outage: ${result.incidents_created} new incidents created`);
    } catch {
      toast.error('Failed to trigger cascade');
    } finally {
      setTriggering(null);
    }
  };

  const triggerDebounceTest = async () => {
    setTriggering('debounce');
    try {
      const r = await simulatorApi.duplicateStorm('debounce-test', 30);
      setLastResult({ scenario: 'Debounce Engine Test', ...r });
      if (r.incidents_created === 1) {
        toast.success(
          `✓ Debounce working: ${r.total_signals} signals → ${r.incidents_created} incident (${r.noise_reduction_pct}% noise reduced)`
        );
      } else if (r.incidents_created === 0) {
        toast.error('No incident created — check backend logs');
      } else {
        toast.success(`${r.total_signals} signals sent → ${r.incidents_created} incidents`);
      }
    } catch {
      toast.error('Failed');
    } finally {
      setTriggering(null);
    }
  };

  const runLoadTest = async () => {
    setLoadRunning(true);
    try {
      const result = await simulatorApi.loadTest(loadConfig.rps, loadConfig.duration, loadConfig.scenario);
      toast.success(`Load test started — ${loadConfig.rps * loadConfig.duration} total signals. Watch Dashboard → Signals/sec`);
    } catch {
      toast.error('Load test failed to start');
    } finally {
      setLoadRunning(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Chaos Simulator" onMenuClick={onMenuClick || (() => {})} />

      <main className="flex-1 p-4 sm:p-6 space-y-6">

        {/* Warning banner */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
          <span className="text-yellow-400 text-lg flex-shrink-0">⚠</span>
          <div>
            <p className="text-sm font-bold text-yellow-400">Chaos Testing Environment</p>
            <p className="text-xs text-yellow-400/60 mt-0.5">
              All actions create real incidents in the system. Use for testing and demonstration only.
            </p>
          </div>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Cascading Outage */}
            <div className="card p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🌊</span>
                <div>
                  <p className="text-sm font-bold text-white">Cascading Outage</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Simulates a realistic chain reaction: DB goes down → API starts failing → Queue builds up → Cache node drops.
                    Creates 4 linked incidents simultaneously.
                  </p>
                </div>
              </div>
              <button
                onClick={triggerCascade}
                disabled={triggering === 'cascade'}
                className="btn-danger w-full justify-center"
              >
                {triggering === 'cascade' ? '⏳ Triggering...' : '⚡ Trigger Cascade (4 incidents)'}
              </button>
            </div>

            {/* Debounce Test */}
            <div className="card p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="text-2xl">🔁</span>
                <div>
                  <p className="text-sm font-bold text-white">Debounce Engine Test</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Sends 30 identical signals for the same component. The debounce engine groups them into 1 incident.
                    Proves noise reduction is working — 30 signals, 1 incident.
                  </p>
                </div>
              </div>
              <button
                onClick={triggerDebounceTest}
                disabled={triggering === 'debounce'}
                className="btn-secondary w-full justify-center"
              >
                {triggering === 'debounce' ? '⏳ Running...' : '🔁 Run Debounce Test (30 signals → 1 incident)'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Individual Scenarios ──────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Individual Scenarios</p>
          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {(scenariosData?.scenarios || []).map((s, i) => {
                const total = scenariosData?.scenarios?.length || 0;
                const isLastRow = i >= total - (total % 3 || 3);
                return (
                  <div
                    key={s.id}
                    className={clsx(
                      'p-4 hover:bg-blue-500/3 transition-colors',
                      !isLastRow && 'border-b border-[#1e2d45]',
                      i % 3 !== 2 && 'lg:border-r border-[#1e2d45]',
                      i % 2 !== 1 && 'sm:border-r sm:lg:border-r-0 border-[#1e2d45]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-lg">{SCENARIO_ICONS[s.id] || '⬡'}</span>
                          <span className="text-sm font-semibold text-white">{s.name}</span>
                        </div>
                        <p className="text-xs font-mono text-slate-600 truncate mb-2">{s.component}</p>
                        <span className={clsx(
                          'text-xs font-mono px-2 py-0.5 rounded-md border',
                          SEV_STYLE[s.severity] || SEV_STYLE.MEDIUM
                        )}>
                          {s.severity}
                        </span>
                      </div>
                      <button
                        onClick={() => triggerScenario(s.id, s.name)}
                        disabled={triggering === s.id}
                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                      >
                        {triggering === s.id ? '...' : 'Trigger'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {!scenariosData?.scenarios?.length && (
                <div className="col-span-3 p-8 text-center text-slate-600 font-mono text-xs">
                  Loading scenarios...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Load Test ─────────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Load Test</p>
          <div className="card p-5">
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Sends a high volume of signals to test the ingestion pipeline under load.
              Watch <strong className="text-white">Dashboard → Signals/sec</strong> to see live throughput during the test.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="label">Signals per second</label>
                <input
                  type="number"
                  className="input font-mono"
                  min={1} max={500}
                  value={loadConfig.rps}
                  onChange={e => setLoadConfig(c => ({ ...c, rps: Math.min(500, Math.max(1, parseInt(e.target.value) || 1)) }))}
                />
                <p className="text-xs text-slate-700 mt-1 font-mono">1 – 500</p>
              </div>
              <div>
                <label className="label">Duration (seconds)</label>
                <input
                  type="number"
                  className="input font-mono"
                  min={1} max={60}
                  value={loadConfig.duration}
                  onChange={e => setLoadConfig(c => ({ ...c, duration: Math.min(60, Math.max(1, parseInt(e.target.value) || 1)) }))}
                />
                <p className="text-xs text-slate-700 mt-1 font-mono">1 – 60 seconds</p>
              </div>
              <div>
                <label className="label">Scenario</label>
                <select
                  className="input font-mono"
                  value={loadConfig.scenario}
                  onChange={e => setLoadConfig(c => ({ ...c, scenario: e.target.value }))}
                >
                  {(scenariosData?.scenarios || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-6 mb-5 p-3 bg-[#0d1117] rounded-lg border border-[#1e2d45]">
              <div>
                <p className="text-xs text-slate-600 font-mono">Total signals</p>
                <p className="text-lg font-black text-white font-mono">{(loadConfig.rps * loadConfig.duration).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-mono">Rate</p>
                <p className="text-lg font-black text-blue-400 font-mono">{loadConfig.rps}/sec</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-mono">Duration</p>
                <p className="text-lg font-black text-purple-400 font-mono">{loadConfig.duration}s</p>
              </div>
            </div>

            <button
              onClick={runLoadTest}
              disabled={loadRunning}
              className="btn-primary"
            >
              {loadRunning ? '⏳ Starting...' : `▶ Start Load Test`}
            </button>
          </div>
        </div>

        {/* ── Last Result ───────────────────────────────────────────────────── */}
        {lastResult && (
          <div>
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">Last Result</p>
            <div className="card p-5">
              <p className="text-sm font-bold text-white mb-3">{lastResult.scenario}</p>
              <pre className="json-viewer text-xs">{JSON.stringify(lastResult, null, 2)}</pre>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
