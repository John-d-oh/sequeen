/**
 * Visual pattern-preset picker.
 *
 * Each button shows a mini bar chart of the preset's pattern values
 * (bar heights normalised to the pattern's max), so "Ascending" looks
 * like a staircase, "Descending" like an inverted staircase, "Octave
 * Jump" zigzags, etc. The name is displayed below.
 *
 * A preset is shown as "active" when the motif's currently-loaded
 * pattern matches the preset's values (within the active length).
 */

import type { MotifPatternPreset } from '../data/presetPatterns';

const ICON_W = 64;
const ICON_H = 22;

function PatternIcon({ values, length, color }: { values: number[]; length: number; color: string }) {
  const slice = values.slice(0, length);
  const maxVal = Math.max(1, ...slice);
  const barW = ICON_W / length;

  return (
    <svg width={ICON_W} height={ICON_H} role="img" aria-hidden>
      {slice.map((v, i) => {
        const barH = Math.max(1.5, (v / maxVal) * (ICON_H - 2));
        return (
          <rect
            key={i}
            x={i * barW + 0.5}
            y={ICON_H - barH}
            width={barW - 1}
            height={barH}
            fill={color}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}

export interface PatternPresetButtonProps {
  preset: MotifPatternPreset;
  isActive: boolean;
  accent: string;
  onClick: () => void;
}

export function PatternPresetButton({
  preset,
  isActive,
  accent,
  onClick,
}: PatternPresetButtonProps) {
  return (
    <button
      onClick={onClick}
      title={`${preset.name} — [${preset.pattern.slice(0, preset.length).join(', ')}]`}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded transition-colors border-2 min-w-[72px] ${
        isActive ? '' : 'border-slate-700 hover:bg-bg-700'
      }`}
      style={
        isActive
          ? { background: `${accent}22`, borderColor: accent }
          : undefined
      }
    >
      <PatternIcon
        values={preset.pattern}
        length={preset.length}
        color={isActive ? accent : '#94a3b8'}
      />
      <span
        className="text-[9px] text-center leading-tight max-w-[64px] truncate"
        style={{ color: isActive ? accent : '#94a3b8' }}
      >
        {preset.name}
      </span>
    </button>
  );
}

/** Helper so MotifPanelBody can decide which preset button is active. */
export function patternMatchesPreset(
  currentPattern: readonly number[],
  currentLength: number,
  preset: MotifPatternPreset,
): boolean {
  if (currentLength !== preset.length) return false;
  for (let i = 0; i < currentLength; i++) {
    if (currentPattern[i] !== preset.pattern[i]) return false;
  }
  return true;
}
