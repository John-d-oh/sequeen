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
];
