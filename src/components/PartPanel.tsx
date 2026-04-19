import type { ReactNode, CSSProperties } from 'react';
import type { PartName, PartStatus } from './../engine/transport';
import { PlayingPulse } from './PlayingPulse';

export interface PartPanelProps {
  partId: PartName;
  title: string;
  /** Legacy prop, no longer read (kept for callers that pass it). */
  color?: string;
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

/**
 * The `part` + `part.{partId}` class chain establishes the per-part
 * `--accent` CSS variable for the panel and every child. Components inside
 * (knobs, mini keyboards, indicators, etc.) can now read `var(--accent)`
 * and inherit the right hue without prop drilling.
 *
 * When the part is playing, the panel adopts the `panel-playing` shadow
 * — accent-tinted ring + outer bloom — so the eye instantly finds the
 * active voice on the page.
 */
export function PartPanel({
  partId,
  title,
  accentHex,
  status,
  onToggle,
  children,
}: PartPanelProps) {
  const isPlaying = status === 'playing';
  const isArmed = status === 'armed';
  const statusColor = isPlaying
    ? 'text-ok'
    : isArmed
      ? 'text-warn'
      : 'text-fg-mute';

  return (
    <section
      className={`part part-${partId} panel panel-accent-top flex flex-col overflow-hidden relative ${
        isPlaying ? 'panel-playing' : ''
      }`}
      style={
        {
          '--accent': accentHex,
          '--panel-accent': accentHex,
          // Subtle accent-tinted radial wash inside the panel — gives each
          // card identity-color without colouring the whole surface.
          backgroundImage: `radial-gradient(ellipse 100% 60% at 50% -20%, ${accentHex}14, transparent 70%)`,
        } as CSSProperties
      }
    >
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{
          borderBottom: '1px solid var(--edge)',
          background:
            'linear-gradient(180deg, rgba(26,22,49,0.4) 0%, rgba(10,8,22,0) 100%)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayingPulse status={status} accent={accentHex} />
          <h3
            className="font-display text-[16px] font-bold tracking-[0.06em] truncate"
            style={{
              color: accentHex,
              textShadow: isPlaying
                ? `0 0 16px ${accentHex}99, 0 0 32px ${accentHex}44`
                : undefined,
            }}
          >
            {title}
          </h3>
          <span className={`text-lbl ${statusColor}`}>{statusLabel[status]}</span>
        </div>
        <button
          onClick={onToggle}
          className="chip px-3 py-1 rounded-md text-[12px] font-medium text-fg shrink-0 hover:brightness-110"
          aria-label={isPlaying ? `Stop ${title}` : `Play ${title}`}
        >
          {status === 'stopped' ? '▶ Play' : '■ Stop'}
        </button>
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}
