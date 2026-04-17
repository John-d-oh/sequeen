/**
 * Preset motif patterns.
 *
 * Each preset is a full 16-slot array so it can be dropped straight into
 * `MotifState.pattern` without padding. `length` is the active sub-range
 * the motif should actually cycle through.
 *
 * Pattern values are 1-based indices into the current note pool — so `1`
 * means "the note at `position + 0`", `5` means "the note at `position + 4`",
 * and so on.
 */

export interface MotifPatternPreset {
  name: string;
  pattern: number[]; // exactly 16 values
  length: number;
}

/** Pad a short pattern out to 16 values by repeating 1s. */
function pad16(values: number[]): number[] {
  const out = values.slice(0, 16);
  while (out.length < 16) out.push(1);
  return out;
}

export const PRESET_PATTERNS: MotifPatternPreset[] = [
  {
    name: 'Ascending',
    pattern: pad16([1, 2, 3, 4, 5, 6, 7, 8]),
    length: 8,
  },
  {
    name: 'Descending',
    pattern: pad16([8, 7, 6, 5, 4, 3, 2, 1]),
    length: 8,
  },
  {
    name: 'Alternating',
    pattern: pad16([1, 3, 2, 4, 3, 5, 4, 6]),
    length: 8,
  },
  {
    name: 'Octave Jump',
    pattern: pad16([1, 5, 2, 6, 3, 7, 4, 8]),
    length: 8,
  },
  {
    name: 'Repeated Root',
    pattern: pad16([1, 1, 2, 1, 3, 1, 4, 1]),
    length: 8,
  },
];
