/**
 * Visual variation picker for the motif engine.
 *
 * Each button renders a miniature bar chart of the variation's actual
 * step sequence (first 8 outputs at pattern length 4), so the motion of
 * each variation is readable at a glance:
 *
 *   forward         ▁▂▃▄▁▂▃▄    (ascending staircase, wrap)
 *   backward        ▄▃▂▁▄▃▂▁    (descending)
 *   pingpong        ▁▂▃▄▃▂▁▂    (mirror at the ends)
 *   pingpong_repeat ▁▂▃▄▄▃▂▁    (endpoints doubled)
 *   odd_even        ▁▃▂▄▁▃▂▄    (odd indices then even)
 *   random          scattered
 *
 * Clicking a button makes it the active variation. The active state tints
 * the background with the motif's accent colour so it's obvious which one
 * is playing.
 */

import { variationStep, type MotifVariation } from '../engine/parts/motif';

// Icon dimensions
const ICON_W = 52;
const ICON_H = 26;
const BAR_COUNT = 8;
const DEMO_LENGTH = 4;
const BAR_W = ICON_W / BAR_COUNT;

/** Deterministic PRNG so the "random" icon doesn't flicker on re-renders. */
function makeSeededRng(seed = 0x1f3c) {
  let state = seed;
  return () => {
    // Linear congruential generator.
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
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded transition-colors border-2 ${
        isActive ? '' : 'border-slate-700 hover:bg-bg-700'
      }`}
      style={
        isActive
          ? { background: `${accent}22`, borderColor: accent }
          : undefined
      }
    >
      <VariationIcon variation={variation} color={isActive ? accent : '#94a3b8'} />
      <span
        className="text-[9px] uppercase tracking-wider leading-none"
        style={{ color: isActive ? accent : '#94a3b8' }}
      >
        {VARIATION_LABEL[variation]}
      </span>
    </button>
  );
}
