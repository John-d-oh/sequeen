/**
 * Live keyboard preview of the notes a motif will play.
 *
 * Takes the motif's current (pattern, patternLength, position, patternType)
 * plus the global music context (key / mode / degree / chordType /
 * alteration / chordQuality) and renders:
 *
 *   1. A compact horizontal keyboard covering exactly the octave range the
 *      pattern notes fall into (plus a 4-semitone padding either side for
 *      context), with every pattern note tinted in the part's accent color.
 *   2. The currently-playing note (polled at 60 Hz) highlighted in a
 *      brighter fill so you can see the playhead move.
 *   3. An ordered list of note names underneath so the Position knob's
 *      "idx N" label isn't the only way to know which notes are in play.
 *
 * This turns `Position` from an abstract pool-index into something
 * immediately visual: nudge it up, watch the highlighted keys shift
 * up the keyboard.
 */

import { useMemo } from 'react';
import { getChordNotes, getScaleNotes, type ChordQuality } from '../engine/musicTheory';
import type { MotifPatternType } from '../engine/parts/motif';
import { motif1Engine, motif2Engine } from '../engine/appEngines';
import { useRafPolled } from '../hooks/useRafPolled';

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

export interface MotifPatternPreviewProps {
  partId: 'motif1' | 'motif2';
  pattern: number[];
  patternLength: number;
  position: number;
  patternType: MotifPatternType;
  music: {
    key: string;
    mode: string;
    degree: number;
    chordType: string;
    alteration: number;
    chordQuality: ChordQuality;
  };
  accent: string;
}

function computePool(patternType: MotifPatternType, m: MotifPatternPreviewProps['music']): number[] {
  switch (patternType) {
    case 'chord':
      return getChordNotes(m.key, m.mode, m.degree, m.chordType, m.alteration, m.chordQuality);
    case 'scale':
      return getScaleNotes(m.key, m.mode);
    case 'chromatic':
      return Array.from({ length: 128 }, (_, i) => i);
  }
}

export function MotifPatternPreview({
  partId,
  pattern,
  patternLength,
  position,
  patternType,
  music,
  accent,
}: MotifPatternPreviewProps) {
  const engine = partId === 'motif1' ? motif1Engine : motif2Engine;
  const currentNote = useRafPolled(() => engine.getCurrentNote());

  // Compute the full set of notes this pattern would play in one cycle.
  const { previewNotes, rangeStart, rangeEnd } = useMemo(() => {
    const pool = computePool(patternType, music);
    const set = new Set<number>();
    for (let i = 0; i < patternLength; i++) {
      const v = pattern[i];
      if (v == null) continue;
      const idx = position + (v - 1);
      const note = pool[idx];
      if (note !== undefined) set.add(note);
    }
    const sorted = [...set].sort((a, b) => a - b);
    if (sorted.length === 0) {
      // No notes (e.g. position out of pool range) — show default range.
      return { previewNotes: [], rangeStart: 48, rangeEnd: 84 };
    }
    // Pad by one octave either side and snap to octave boundaries so the
    // keyboard always starts on a C.
    const minN = sorted[0];
    const maxN = sorted[sorted.length - 1];
    const startOctave = Math.floor(minN / 12) - 1;
    const endOctave = Math.floor(maxN / 12) + 1;
    return {
      previewNotes: sorted,
      rangeStart: Math.max(0, startOctave * 12),
      rangeEnd: Math.min(127, endOctave * 12 + 11),
    };
  }, [pattern, patternLength, position, patternType, music]);

  // Build the keyboard layout.
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let m = rangeStart; m <= rangeEnd; m++) {
    if (BLACK_PCS.has(m % 12)) blacks.push(m);
    else whites.push(m);
  }

  const WHITE_W = 11;
  const H = 40;
  const BLACK_H = Math.round(H * 0.62);
  const BLACK_W = Math.round(WHITE_W * 0.65);
  const width = whites.length * WHITE_W;

  const activeSet = new Set(previewNotes);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          Pattern notes
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {previewNotes.length} note{previewNotes.length === 1 ? '' : 's'}
          {previewNotes.length > 0 &&
            ` · ${midiName(previewNotes[0])}–${midiName(previewNotes[previewNotes.length - 1])}`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg width={width} height={H} className="rounded border border-slate-700/60">
          <rect x={0} y={0} width={width} height={H} fill="#0f172a" />
          {/* White keys */}
          {whites.map((midi, i) => {
            const isPreview = activeSet.has(midi);
            const isCurrent = currentNote === midi;
            const fill = isCurrent
              ? accent
              : isPreview
                ? `${accent}88`
                : '#f8fafc';
            return (
              <rect
                key={midi}
                x={i * WHITE_W}
                y={0}
                width={WHITE_W - 0.5}
                height={H}
                fill={fill}
                stroke="#475569"
                strokeWidth={0.5}
              />
            );
          })}
          {/* Black keys on top */}
          {blacks.map((midi) => {
            const leftWhite = midi - 1;
            const idx = whites.indexOf(leftWhite);
            if (idx === -1) return null;
            const isPreview = activeSet.has(midi);
            const isCurrent = currentNote === midi;
            const fill = isCurrent
              ? accent
              : isPreview
                ? `${accent}cc`
                : '#0f172a';
            return (
              <rect
                key={midi}
                x={(idx + 1) * WHITE_W - BLACK_W / 2}
                y={0}
                width={BLACK_W}
                height={BLACK_H}
                fill={fill}
                stroke="#334155"
                strokeWidth={0.5}
              />
            );
          })}
          {/* Octave tick marks under each C */}
          {whites
            .filter((m) => m % 12 === 0)
            .map((m) => {
              const i = whites.indexOf(m);
              return (
                <text
                  key={`label-${m}`}
                  x={i * WHITE_W + 1}
                  y={H - 2}
                  fontSize={7}
                  fill="#64748b"
                  fontFamily="monospace"
                >
                  C{Math.floor(m / 12) - 1}
                </text>
              );
            })}
        </svg>
      </div>

      {/* Ordered note list: "C3 → E3 → G3 → C4" etc. */}
      {previewNotes.length > 0 && (
        <div
          className="text-[10px] font-mono truncate"
          style={{ color: accent }}
          title={previewNotes.map(midiName).join(' · ')}
        >
          {previewNotes.map(midiName).join(' · ')}
        </div>
      )}
    </div>
  );
}
