/**
 * Animated status dot for part panels.
 *
 * - `playing`  → pulsing dot in the part's accent colour
 * - `armed`    → static amber dot
 * - `stopped`  → dim outline
 *
 * Motion respects `prefers-reduced-motion` via the `.sequeen-pulse` class
 * defined in index.css.
 */

import type { PartStatus } from '../engine/transport';

export interface PlayingPulseProps {
  status: PartStatus;
  accent: string;
  size?: number;
}

export function PlayingPulse({ status, accent, size = 9 }: PlayingPulseProps) {
  const isPlaying = status === 'playing';
  const isArmed = status === 'armed';

  const fill = isPlaying ? accent : isArmed ? '#f59e0b' : 'transparent';
  const border = isPlaying ? accent : isArmed ? '#f59e0b' : '#475569';
  const glow = isPlaying ? `0 0 8px ${accent}` : 'none';

  return (
    <span
      aria-label={status}
      title={status}
      className={`inline-block rounded-full ${isPlaying ? 'sequeen-pulse' : ''}`}
      style={{
        width: size,
        height: size,
        background: fill,
        boxShadow: glow,
        border: `1px solid ${border}`,
      }}
    />
  );
}
