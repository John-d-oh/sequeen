/**
 * Compact piano keyboard showing which MIDI notes a part is currently holding.
 *
 * Synthwave-token edition: the white keys read as cool ivory rather than
 * pure white (so they don't fight the dark surface), the black keys sit
 * deep in ink-2, the panel-frame uses the new --edge token, and active
 * keys take the part's accent color (passed in as `accent` prop).
 *
 * Pure SVG, no interactivity — read-only activity indicator.
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
      className="rounded-md"
      style={{
        background: '#08051a', // --ink-deep / sunken
        border: '1px solid var(--edge)',
      }}
      aria-label="current notes"
    >
      {/* White keys — cool ivory, not pure white. Active keys take accent. */}
      {whites.map((m, i) => {
        const on = active.has(m);
        return (
          <rect
            key={m}
            x={i * whiteWidth}
            y={0}
            width={whiteWidth - 0.5}
            height={height}
            fill={on ? accent : '#cdc4eb'}
            stroke="#251e42"
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
            fill={on ? accent : '#0a0816'}
            stroke="#1a1631"
            strokeWidth={0.5}
          />
        );
      })}
    </svg>
  );
}
