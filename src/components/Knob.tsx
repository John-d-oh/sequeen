import { useCallback, useId, useRef } from 'react';

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
  /**
   * Color used for the indicator arc / needle / center pip. Falls back to
   * the inherited `--accent` CSS variable so any knob inside a `.part.pad`
   * scope (etc.) auto-inherits the part color without a prop.
   */
  accent?: string;
}

/**
 * Tactile rotary knob — synthwave token edition.
 *
 * Visual layers (back to front):
 *   1. Wrapper <div>     — recessed `shadow-knob` (inset highlight + inset
 *                          bottom shadow + heavy drop shadow). Gives the
 *                          "knob sunk into a panel cutout" depth cue.
 *   2. Body circle       — radial gradient `--g-knob-body` (lit from above,
 *                          dark at the bottom). The chrome shoulder.
 *   3. Background arc    — faint full-range track at -135°…+135° so the
 *                          knob's travel is always legible at idle.
 *   4. Travelled arc     — glowing accent stroke from -135° to current
 *                          angle, with a Gaussian-blur halo behind it.
 *   5. Cap circle        — slightly smaller, gradient `--g-knob-cap`. This
 *                          is the raised "face" of the knob.
 *   6. Highlight overlay — soft top-half radial reading as glossy plastic.
 *   7. Indicator + pivot — accent-colored needle from center to cap edge,
 *                          tiny center dot.
 *
 * Interaction: click-drag vertically. Drag distance per unit is
 * `120 / (max - min)` so wide-range knobs (0–127 velocity) feel responsive
 * without being twitchy.
 */
export function Knob({
  value,
  onChange,
  min,
  max,
  label,
  step = 1,
  size = 56,
  format,
  accent = 'currentColor',
}: KnobProps) {
  const uid = useId().replace(/:/g, '');
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
        const dy = startY - me.clientY;
        const delta = Math.round(dy / pxPerUnit / step) * step;
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
  const bodyR = size / 2 - 0.5;
  const capR = bodyR - 4;
  const arcR = bodyR - 1.5;
  const indicatorLen = capR - 5;
  const radians = (angle * Math.PI) / 180;
  const ix = cx + indicatorLen * Math.sin(radians);
  const iy = cy - indicatorLen * Math.cos(radians);

  // Background "full track" arc (dim) — always at -135° → +135°.
  const trackStart = -135;
  const trackEnd = 135;
  const trackStartRad = (trackStart * Math.PI) / 180;
  const trackEndRad = (trackEnd * Math.PI) / 180;
  const trackStartPt = {
    x: cx + arcR * Math.sin(trackStartRad),
    y: cy - arcR * Math.cos(trackStartRad),
  };
  const trackEndPt = {
    x: cx + arcR * Math.sin(trackEndRad),
    y: cy - arcR * Math.cos(trackEndRad),
  };
  const trackPath = `M ${trackStartPt.x} ${trackStartPt.y} A ${arcR} ${arcR} 0 1 1 ${trackEndPt.x} ${trackEndPt.y}`;

  // Travelled arc (glowing accent) — -135° → current.
  const arcEnd = {
    x: cx + arcR * Math.sin(radians),
    y: cy - arcR * Math.cos(radians),
  };
  const largeArc = angle - trackStart > 180 ? 1 : 0;
  const arcPath = `M ${trackStartPt.x} ${trackStartPt.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;

  return (
    <div className="flex flex-col items-center gap-1.5 select-none group">
      {label && <span className="text-lbl">{label}</span>}

      <div
        onPointerDown={onPointerDown}
        className="relative cursor-ns-resize transition-[filter] duration-120 ease-ui hover:brightness-110 active:brightness-125"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          // shadow-knob token: highlight rim + inset bottom + heavy drop.
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -6px 14px rgba(0,0,0,0.5), 0 8px 18px rgba(0,0,0,0.6)',
        }}
      >
        <svg
          width={size}
          height={size}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            {/* knob-body — radial gradient lit from above */}
            <radialGradient id={`body-${uid}`} cx="50%" cy="-10%" r="120%">
              <stop offset="0%" stopColor="#3A3268" />
              <stop offset="40%" stopColor="#1B1636" />
              <stop offset="100%" stopColor="#0A0816" />
            </radialGradient>
            {/* knob-cap — slightly different gradient for the raised face */}
            <radialGradient id={`cap-${uid}`} cx="50%" cy="0%" r="120%">
              <stop offset="0%" stopColor="#241D44" />
              <stop offset="50%" stopColor="#15102a" />
              <stop offset="100%" stopColor="#0A0816" />
            </radialGradient>
            {/* Soft highlight on the cap top */}
            <radialGradient id={`hl-${uid}`} cx="50%" cy="15%" r="55%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            {/* Glow filter for the arc + indicator */}
            <filter
              id={`glow-${uid}`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Body — outer ring of the knob */}
          <circle cx={cx} cy={cy} r={bodyR} fill={`url(#body-${uid})`} />

          {/* Background track — faint full-range arc */}
          <path
            d={trackPath}
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Travelled arc — glowing accent */}
          <path
            d={arcPath}
            fill="none"
            stroke={accent}
            strokeWidth={2.4}
            strokeLinecap="round"
            filter={`url(#glow-${uid})`}
            opacity={0.95}
          />

          {/* Cap — raised inner face */}
          <circle
            cx={cx}
            cy={cy}
            r={capR}
            fill={`url(#cap-${uid})`}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={0.5}
          />
          {/* Cap highlight overlay */}
          <circle
            cx={cx}
            cy={cy}
            r={capR - 0.4}
            fill={`url(#hl-${uid})`}
            pointerEvents="none"
          />

          {/* Indicator needle — center → near edge of cap */}
          <line
            x1={cx}
            y1={cy}
            x2={ix}
            y2={iy}
            stroke={accent}
            strokeWidth={2.6}
            strokeLinecap="round"
            filter={`url(#glow-${uid})`}
          />
          {/* Center pivot — tiny dark recess + accent pip */}
          <circle cx={cx} cy={cy} r={2.6} fill="#06040E" />
          <circle cx={cx} cy={cy} r={1.4} fill={accent} />
        </svg>
      </div>

      <span className="text-[12px] font-mono font-semibold text-fg tabular-nums">
        {format ? format(value) : value}
      </span>
    </div>
  );
}
