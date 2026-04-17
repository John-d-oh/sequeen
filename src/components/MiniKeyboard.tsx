/**
 * Compact piano keyboard showing which MIDI notes a part is currently holding.
 *
 * Renders white + black keys across a configurable MIDI range. Active notes
 * (the set passed in `notes`) are highlighted in the part's accent color.
 * Pure SVG, no interactivity — it's a read-only activity indicator.
 */
export interface MiniKeyboardProps {
  /** Currently-sounding MIDI notes to highlight. */
  notes: readonly number[];
  /** Accent colour used for active keys. */
  accent: string;
  /** Inclusive MIDI range. Defaults to C2–C6 (36..84) = 4 octaves. */
  startMidi?: number;
  endMidi?: number;
  whiteWidth?: number;
  height?: number;
}

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export function MiniKeyboard({
  notes,
  accent,
  startMidi = 36,
  endMidi = 84,
  whiteWidth = 7,
  height = 28,
}: MiniKeyboardProps) {
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let m = startMidi; m <= endMidi; m++) {
    if (BLACK_PCS.has(m % 12)) blacks.push(m);
    else whites.push(m);
  }

  const width = whites.length * whiteWidth;
  const blackHeight = Math.round(height * 0.62);
  const blackWidth = Math.round(whiteWidth * 0.65);
  const active = new Set(notes);

  return (
    <svg
      width={width}
      height={height}
      className="rounded-sm border border-slate-700/60"
      style={{ background: '#0f172a' }}
      aria-label="current notes"
    >
      {/* White keys */}
      {whites.map((m, i) => {
        const on = active.has(m);
        return (
          <rect
            key={m}
            x={i * whiteWidth}
            y={0}
            width={whiteWidth - 0.5}
            height={height}
            fill={on ? accent : '#f8fafc'}
            stroke="#475569"
            strokeWidth={0.5}
            opacity={on ? 1 : 0.92}
          />
        );
      })}
      {/* Black keys (drawn on top) */}
      {blacks.map((m) => {
        const whiteLeft = m - 1;
        const whiteIdx = whites.indexOf(whiteLeft);
        if (whiteIdx === -1) return null;
        const x = (whiteIdx + 1) * whiteWidth - blackWidth / 2;
        const on = active.has(m);
        return (
          <rect
            key={m}
            x={x}
            y={0}
            width={blackWidth}
            height={blackHeight}
            fill={on ? accent : '#0f172a'}
            stroke="#334155"
            strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
}
