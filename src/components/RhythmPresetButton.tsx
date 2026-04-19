/**
 * Visual rhythm-preset picker.
 *
 *   note      vertical bar, height ∝ velocity (in part accent when active)
 *   rest      small siren-red dot
 *   tie       horizontal mint line spanning the cell (held from prev note)
 *
 * Active state: accent border + glow + radial accent fill, matching the
 * other preset buttons for visual consistency.
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
              fill="#FF4E6B"
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
            stroke="#4EF0C1"
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
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-2xl border-2 min-w-[84px] transition-[filter,box-shadow,background] duration-120 ease-ui ${
        isActive ? '' : 'border-edge hover:border-edge-2 hover:brightness-110'
      }`}
      style={
        isActive
          ? {
              background: `radial-gradient(80% 120% at 50% 0%, ${accent}30, transparent 65%), linear-gradient(180deg, rgba(26,22,49,0.6), rgba(10,8,22,0.6))`,
              borderColor: accent,
              boxShadow: `0 0 18px -4px ${accent}99, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }
          : { background: 'rgba(10,8,22,0.4)' }
      }
    >
      <RhythmIcon
        beats={preset.rhythm}
        length={preset.length}
        color={isActive ? accent : '#6F6691'}
      />
      <span
        className="text-[9px] text-center leading-tight max-w-[78px] truncate font-mono uppercase tracking-wider"
        style={{ color: isActive ? accent : '#6F6691' }}
      >
        {preset.name.replace('Bass — ', '')}
      </span>
    </button>
  );
}

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
