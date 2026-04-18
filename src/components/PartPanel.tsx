import type { ReactNode } from 'react';
import type { PartStatus } from '../engine/transport';
import { PlayingPulse } from './PlayingPulse';

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
  const isPlaying = status === 'playing';
  const isArmed = status === 'armed';
  const statusColor = isPlaying
    ? 'text-emerald-300'
    : isArmed
      ? 'text-amber-300'
      : 'text-slate-500';

  return (
    <section
      className="rounded-lg bg-bg-800 border border-slate-700/60 overflow-hidden flex flex-col"
      style={{ borderTopWidth: 3, borderTopColor: accentHex }}
    >
      <header className="flex items-center justify-between px-4 py-2.5 bg-bg-700">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayingPulse status={status} accent={accentHex} />
          <h3
            className="font-semibold tracking-wide text-sm truncate"
            style={{ color: accentHex }}
          >
            {title}
          </h3>
          <span className={`type-label ${statusColor}`}>{statusLabel[status]}</span>
        </div>
        <button
          onClick={onToggle}
          className="type-body px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 shrink-0"
          aria-label={isPlaying ? `Stop ${title}` : `Play ${title}`}
        >
          {status === 'stopped' ? '▶ Play' : '■ Stop'}
        </button>
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}
