import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import clsx from 'clsx';

interface Props {
  title: string;
  onMenuClick: () => void;
  actions?: React.ReactNode;
}

export const TopBar: React.FC<Props> = ({ title, onMenuClick, actions }) => {
  const { connected } = useWebSocket();

  return (
    <header className="sticky top-0 z-20 border-b border-[#1e2d45] bg-[#0a0e1a]/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-xs font-mono hidden sm:inline">SYS /</span>
            <h1 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1e2d45] bg-[#0d1117]/60">
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              connected
                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse'
                : 'bg-slate-600'
            )} />
            <span className="text-xs font-mono font-semibold tracking-wider">
              {connected
                ? <span className="text-emerald-400">LIVE</span>
                : <span className="text-slate-500">OFFLINE</span>
              }
            </span>
          </div>
          {actions}
        </div>
      </div>
    </header>
  );
};
