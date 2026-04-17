/**
 * Visual rhythm-preset picker.
 *
 * Each button renders a miniature rhythm strip: one cell per active
 * beat showing the beat's type at a glance —
 *
 *   note      vertical bar, height ∝ velocity
 *   rest      small red dot
 *   tie       horizontal green line spanning the cell (held from prev note)
 *
 * This matches the visual vocabulary in the rhythm editor and makes it
 * trivial to spot "lots of notes" (solid bars) vs "sparse" (mostly dots)
 * vs "legato" (tied lines) rhythms without reading any labels.
 */

import type { MotifRhythmBeat } from '../engine/parts/motif';
import type { MotifRhythmPreset } from '../data/presetRhythms';

const ICON_W = 72;
const ICON_H = 20;

function RhythmIcon({
  beats,
  length,
  color,
}: {
  beats: readonly MotifRhythmBeat[];
  length: number;
  color: string;
}) {
  const slice = beats.slice(0, length);
  const cellW = ICON_W / Math.max(1, length);

  return (
    <svg width={ICON_W} height={ICON_H} role="img" aria-hidden>
      {slice.map((beat, i) => {
        const x = i * cellW;
        if (beat.type === 'note') {
          const velH = Math.max(2, (beat.velocity / 127) * (ICON_H - 2));
          return (
            <rect
              key={i}
              x={x + 0.5}
              y={ICON_H - velH}
              width={cellW - 1}
              height={velH}
              fill={color}
              rx={0.5}
            />
          );
        }
        if (beat.type === 'rest') {
          return (
            <circle
              key={i}
              cx={x + cellW / 2}
              cy={ICON_H / 2}
              r={1.5}
              fill="#ef4444"
            />
          );
        }
        // tie
        return (
          <line
            key={i}
            x1={x}
            y1={ICON_H / 2}
            x2={x + cellW}
            y2={ICON_H / 2}
            stroke="#22c55e"
            strokeWidth={2}
            strokeLinecap="square"
          />
        );
      })}
    </svg>
  );
}

export interface RhythmPresetButtonProps {
  preset: MotifRhythmPreset;
  isActive: boolean;
  accent: string;
  onClick: () => void;
}

export function RhythmPresetButton({
  preset,
  isActive,
  accent,
  onClick,
}: RhythmPresetButtonProps) {
  return (
    <button
      onClick={onClick}
      title={`${preset.name} · length ${preset.length} · ${preset.suggestedDivide}`}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded transition-colors border-2 min-w-[84px] ${
        isActive ? '' : 'border-slate-700 hover:bg-bg-700'
      }`}
      style={
        isActive
          ? { background: `${accent}22`, borderColor: accent }
          : undefined
      }
    >
      <RhythmIcon
        beats={preset.rhythm}
        length={preset.length}
        color={isActive ? accent : '#94a3b8'}
      />
      <span
        className="text-[9px] text-center leading-tight max-w-[78px] truncate"
        style={{ color: isActive ? accent : '#94a3b8' }}
      >
        {preset.name.replace('Bass — ', '')}
      </span>
    </button>
  );
}

/** Shallow-compare a live rhythm array against a preset, within the active length. */
export function rhythmMatchesPreset(
  currentRhythm: readonly MotifRhythmBeat[],
  currentLength: number,
  preset: MotifRhythmPreset,
): boolean {
  if (currentLength !== preset.length) return false;
  for (let i = 0; i < currentLength; i++) {
    const a = currentRhythm[i];
    const b = preset.rhythm[i];
    if (!a || !b) return false;
    if (a.type !== b.type) return false;
    if (a.type === 'note' && a.velocity !== b.velocity) return false;
  }
  return true;
}
