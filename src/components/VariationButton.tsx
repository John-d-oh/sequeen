/**
 * Visual variation picker for the motif engine.
 *
 * Each button renders a miniature bar chart of the variation's first 8
 * outputs at pattern length 4. Active state uses the part accent for the
 * border + bars + glow.
 */

import { variationStep, type MotifVariation } from '../engine/parts/motif';

const ICON_W = 52;
const ICON_H = 26;
const BAR_COUNT = 8;
const DEMO_LENGTH = 4;
const BAR_W = ICON_W / BAR_COUNT;

function makeSeededRng(seed = 0x1f3c) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function VariationIcon({ variation, color }: { variation: MotifVariation; color: string }) {
  const rng = makeSeededRng();
  const heights = Array.from({ length: BAR_COUNT }, (_, k) =>
    variationStep(variation, DEMO_LENGTH, k, rng),
  );
  const maxH = DEMO_LENGTH - 1;

  return (
    <svg width={ICON_W} height={ICON_H} role="img" aria-hidden>
      {heights.map((h, i) => {
        const barH = Math.max(1.5, (h / maxH) * (ICON_H - 3));
        return (
          <rect
            key={i}
            x={i * BAR_W + 1}
            y={ICON_H - barH}
            width={BAR_W - 2}
            height={barH}
            fill={color}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}

const VARIATION_LABEL: Record<MotifVariation, string> = {
  forward: 'Forward',
  backward: 'Back',
  pingpong: 'Ping-Pong',
  pingpong_repeat: 'Ping-Pong ×',
  odd_even: 'Odd-Even',
  random: 'Random',
};

const VARIATION_TOOLTIP: Record<MotifVariation, string> = {
  forward: 'Play pattern steps 1 → 2 → 3 → 4 → loop',
  backward: 'Play pattern steps 4 → 3 → 2 → 1 → loop',
  pingpong: 'Up then down, endpoints played once (1 2 3 4 3 2 1 2)',
  pingpong_repeat: 'Up then down, endpoints doubled (1 2 3 4 4 3 2 1 1)',
  odd_even: 'All odd-indexed steps then all even (1 3 2 4)',
  random: 'Random step on every note',
};

export interface VariationButtonProps {
  variation: MotifVariation;
  isActive: boolean;
  accent: string;
  onClick: () => void;
}

export function VariationButton({ variation, isActive, accent, onClick }: VariationButtonProps) {
  return (
    <button
      onClick={onClick}
      title={VARIATION_TOOLTIP[variation]}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-2xl border-2 transition-[filter,box-shadow,background] duration-120 ease-ui ${
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
      <VariationIcon variation={variation} color={isActive ? accent : '#6F6691'} />
      <span
        className="text-[9px] uppercase tracking-[0.18em] leading-none font-mono"
        style={{ color: isActive ? accent : '#6F6691' }}
      >
        {VARIATION_LABEL[variation]}
      </span>
    </button>
  );
}
