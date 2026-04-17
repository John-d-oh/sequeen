/**
 * Tiny row of dots visualising an "active out of total" length, e.g.
 * "6 of 16 pattern slots are active" or "12 of 32 rhythm beats".
 *
 * The first `active` dots are filled with the accent colour; the rest
 * are dim outlines. Paired with the corresponding knob so the meaning
 * of "Pat Len = 8" or "Rhy Len = 12" is readable at a glance.
 */

export interface LengthIndicatorProps {
  active: number;
  total: number;
  accent: string;
  /** Visual height of each dot in px. */
  dotSize?: number;
}

export function LengthIndicator({
  active,
  total,
  accent,
  dotSize = 5,
}: LengthIndicatorProps) {
  return (
    <div
      className="flex items-center"
      style={{ gap: 1 }}
      aria-label={`${active} of ${total} active`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: 1,
            background: i < active ? accent : 'transparent',
            border: `1px solid ${i < active ? accent : '#334155'}`,
            opacity: i < active ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}
