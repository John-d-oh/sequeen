/**
 * Visual pattern-preset picker — bar chart of each preset's actual values.
 * Active state: accent border + glow + radial accent fill behind the bars.
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
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-2xl border-2 min-w-[72px] transition-[filter,box-shadow,background] duration-120 ease-ui ${
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
      <PatternIcon
        values={preset.pattern}
        length={preset.length}
        color={isActive ? accent : '#6F6691'}
      />
      <span
        className="text-[9px] text-center leading-tight max-w-[64px] truncate font-mono uppercase tracking-wider"
        style={{ color: isActive ? accent : '#6F6691' }}
      >
        {preset.name}
      </span>
    </button>
  );
}

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
