/**
 * Preset motif rhythms.
 *
 * Each preset is a full 32-slot rhythm array so it can be dropped straight
 * into `MotifState.rhythm`. `length` is the active sub-range the motif
 * should actually cycle through — any slots past `length` are never read.
 *
 * The clock-division that makes each rhythm feel "right" is listed as a
 * hint (`suggestedDivide`) but isn't enforced — the motif can play any
 * rhythm at any clock division.
 */

import type { MotifClockDivide, MotifRhythmBeat } from '../engine/parts/motif';

export interface MotifRhythmPreset {
  name: string;
  rhythm: MotifRhythmBeat[]; // exactly 32 entries
  length: number;
  suggestedDivide: MotifClockDivide;
}

const note = (velocity = 100): MotifRhythmBeat => ({ type: 'note', velocity });
const rest = (): MotifRhythmBeat => ({ type: 'rest', velocity: 0 });
const tie = (): MotifRhythmBeat => ({ type: 'tie', velocity: 0 });

/** Pad a rhythm out to 32 entries with rests. */
function pad32(beats: MotifRhythmBeat[]): MotifRhythmBeat[] {
  const out = beats.slice(0, 32);
  while (out.length < 32) out.push(rest());
  return out;
}

export const PRESET_RHYTHMS: MotifRhythmPreset[] = [
  {
    name: 'Quarters',
    rhythm: pad32([note(), note(), note(), note()]),
    length: 4,
    suggestedDivide: '1/4',
  },
  {
    name: 'Eighths',
    rhythm: pad32([note(), note(), note(), note(), note(), note(), note(), note()]),
    length: 8,
    suggestedDivide: '1/8',
  },
  {
    name: 'Eighths w/ Rests on 2 & 4',
    rhythm: pad32([
      note(), note(), rest(), note(),
      note(), note(), rest(), note(),
    ]),
    length: 8,
    suggestedDivide: '1/8',
  },
  {
    name: '16ths w/ Accents',
    rhythm: pad32([
      note(127), note(80), note(80), note(80),
      note(100), note(80), note(80), note(80),
      note(110), note(80), note(80), note(80),
      note(100), note(80), note(80), note(80),
    ]),
    length: 16,
    suggestedDivide: '1/8',
  },
  {
    name: 'Syncopated',
    rhythm: pad32([
      note(100), tie(), note(90), note(100),
      tie(),     note(90), note(100), note(90),
    ]),
    length: 8,
    suggestedDivide: '1/8',
  },

  // ----------- Bass-oriented rhythms (slow, sparse, bass-friendly) ---------

  {
    // One note per bar — pure root drone-like bass.
    name: 'Bass — Whole Notes',
    rhythm: pad32([note(110)]),
    length: 1,
    suggestedDivide: '1/1',
  },
  {
    // Two notes per bar at half-note intervals.
    name: 'Bass — Half Notes',
    rhythm: pad32([note(110), note(95)]),
    length: 2,
    suggestedDivide: '1/2',
  },
  {
    // Hit on beat 1 only — classic minimal bass anchor.
    name: 'Bass — On 1',
    rhythm: pad32([note(115), rest(), rest(), rest()]),
    length: 4,
    suggestedDivide: '1/4',
  },
  {
    // Hit on beats 1 & 3 — staple of dub, reggae downbeat patterns.
    name: 'Bass — On 1 & 3',
    rhythm: pad32([note(115), rest(), note(95), rest()]),
    length: 4,
    suggestedDivide: '1/4',
  },
  {
    // Beats 2 & 4 — reggae / ska "skank" offbeat for stab-style basslines.
    name: 'Bass — Reggae Offbeat',
    rhythm: pad32([rest(), note(105), rest(), note(105)]),
    length: 4,
    suggestedDivide: '1/4',
  },
  {
    // Classic four-on-the-floor house bass: every quarter, accent on 1.
    name: 'Bass — Four On Floor',
    rhythm: pad32([note(115), note(95), note(105), note(95)]),
    length: 4,
    suggestedDivide: '1/4',
  },
  {
    // Off-beat eighth bassline (Deep House / Garage). Thumps every "and".
    name: 'Bass — Off-beat 8ths',
    rhythm: pad32([
      rest(),   note(110), rest(),   note(95),
      rest(),   note(110), rest(),   note(95),
    ]),
    length: 8,
    suggestedDivide: '1/8',
  },
  {
    // Syncopated dub bass with ties for sustained low notes.
    name: 'Bass — Dub Sustain',
    rhythm: pad32([
      note(115), tie(),    rest(),   note(90),
      rest(),    rest(),   note(100), tie(),
    ]),
    length: 8,
    suggestedDivide: '1/8',
  },
  {
    // Long-held single note — sub-bass / drone bass with tied sustain.
    name: 'Bass — Sub Pulse',
    rhythm: pad32([note(120), tie(), tie(), tie()]),
    length: 4,
    suggestedDivide: '1/4',
  },
  {
    // Walking bass — 4 evenly spaced notes per bar with subtle dynamics.
    name: 'Bass — Walking',
    rhythm: pad32([note(105), note(85), note(95), note(85)]),
    length: 4,
    suggestedDivide: '1/4',
  },
];
