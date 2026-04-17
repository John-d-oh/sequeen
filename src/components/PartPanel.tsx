import type { ReactNode } from 'react';
import type { PartStatus } from '../engine/transport';

export interface PartPanelProps {
  title: string;
  color: string; // Tailwind class like 'sky', or a hex for inline styles
  accentHex: string;
  status: PartStatus;
  onToggle: () => void;
  children: ReactNode;
}

const statusLabel: Record<PartStatus, string> = {
  stopped: 'STOPPED',
  armed: 'ARMED',
  playing: 'PLAYING',
};

export function PartPanel({ title, accentHex, status, onToggle, children }: PartPanelProps) {
  return (
    <section
      className="rounded-lg bg-bg-800 border border-slate-700/60 overflow-hidden flex flex-col"
      style={{ borderTopWidth: 3, borderTopColor: accentHex }}
    >
      <header className="flex items-center justify-between px-4 py-2 bg-bg-700">
        <h3 className="font-semibold tracking-wide text-sm" style={{ color: accentHex }}>
          {title}
        </h3>
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              status === 'playing'
                ? 'bg-emerald-500/20 text-emerald-300'
                : status === 'armed'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-slate-600/30 text-slate-400'
            }`}
          >
            {statusLabel[status]}
          </span>
          <button
            onClick={onToggle}
            className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors"
          >
            {status === 'stopped' ? '▶ Play' : '■ Stop'}
          </button>
        </div>
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}
