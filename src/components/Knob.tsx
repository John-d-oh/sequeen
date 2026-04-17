import { useCallback, useRef } from 'react';

export interface KnobProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label?: string;
  step?: number;
  size?: number;
  /** Optional display mapper, e.g. `v => \`\${v} BPM\``. */
  format?: (v: number) => string;
  /** Colour accent for the indicator line. */
  accent?: string;
}

/**
 * Rotary knob.
 *
 * Click-and-drag vertically to change the value. The indicator rotates
 * through a 270° arc (-135° to +135°). Not a range-input — it's a real
 * pointer-driven drag interaction with a value readout under the knob.
 */
export function Knob({
  value,
  onChange,
  min,
  max,
  label,
  step = 1,
  size = 48,
  format,
  accent = '#38bdf8',
}: KnobProps) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      const startY = e.clientY;
      const startValue = valueRef.current;
      const pxPerUnit = Math.max(1, 120 / (max - min));

      const onMove = (me: PointerEvent) => {
        const dy = startY - me.clientY; // drag up = increase
        const delta = Math.round((dy / pxPerUnit) / step) * step;
        const next = Math.max(min, Math.min(max, startValue + delta));
        if (next !== valueRef.current) onChange(next);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [min, max, step, onChange],
  );

  const pct = max === min ? 0 : (value - min) / (max - min);
  const angle = -135 + pct * 270;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const indicatorLen = r - 4;
  const radians = (angle * Math.PI) / 180;
  const ix = cx + indicatorLen * Math.sin(radians);
  const iy = cy - indicatorLen * Math.cos(radians);

  // Arc path for the "travelled" portion (from -135° to current angle).
  const arcEnd = {
    x: cx + r * Math.sin(radians),
    y: cy - r * Math.cos(radians),
  };
  const arcStart = {
    x: cx + r * Math.sin((-135 * Math.PI) / 180),
    y: cy - r * Math.cos((-135 * Math.PI) / 180),
  };
  const largeArc = angle - -135 > 180 ? 1 : 0;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {label && <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>}
      <svg
        width={size}
        height={size}
        onPointerDown={onPointerDown}
        className="cursor-ns-resize"
      >
        <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke="#334155" strokeWidth={2} />
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.5}
        />
        <line x1={cx} y1={cy} x2={ix} y2={iy} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={2} fill={accent} />
      </svg>
      <span className="text-xs font-mono text-slate-200">{format ? format(value) : value}</span>
    </div>
  );
}
