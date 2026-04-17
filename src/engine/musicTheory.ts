/**
 * Music theory primitives for Sequeen.
 *
 * Everything here is pitch-class / MIDI based (0 = C-1, 60 = middle C, 127 = G9).
 * A "mode" is an array of semitone offsets from the tonic (always starting at 0).
 * A "key" is a tonic pitch class name in circle-of-fifths order.
 */

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** The 12 keys laid out in circle-of-fifths order starting at C. */
export const KEYS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F',
] as const;

export type Key = (typeof KEYS)[number];

/** Map key name → pitch class (0–11). Includes common enharmonic spellings. */
const KEY_TO_PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

/** Resolve a key name to its pitch class, throwing for unknown names. */
function keyToPitchClass(key: string): number {
  const pc = KEY_TO_PITCH_CLASS[key];
  if (pc === undefined) throw new Error(`Unknown key: ${key}`);
  return pc;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

/**
 * Mode name → interval array (semitones from the tonic).
 * Every mode's array MUST start with 0 and be strictly ascending within an octave.
 */
export const MODES: Record<string, number[]> = {
  Major:             [0, 2, 4, 5, 7, 9, 11],
  Dorian:            [0, 2, 3, 5, 7, 9, 10],
  Phrygian:          [0, 1, 3, 5, 7, 8, 10],
  Lydian:            [0, 2, 4, 6, 7, 9, 11],
  Mixolydian:        [0, 2, 4, 5, 7, 9, 10],
  Minor:             [0, 2, 3, 5, 7, 8, 10],
  Locrian:           [0, 1, 3, 5, 6, 8, 10],
  'Gypsy Min':       [0, 2, 3, 6, 7, 8, 11],
  'Harmonic Minor':  [0, 2, 3, 5, 7, 8, 11],
  'Whole Tone':      [0, 2, 4, 6, 8, 10],
  'Minor Pentatonic':[0, 3, 5, 7, 10],
  'Tonic 2nds':      [0, 2],
  'Tonic 3rds':      [0, 4],
  'Tonic 4ths':      [0, 5],
  'Tonic 6ths':      [0, 9],
};

export type ModeName = keyof typeof MODES;

// ---------------------------------------------------------------------------
// Chord degree & quality — borrowed-chord support
// ---------------------------------------------------------------------------

/**
 * Quality of a chord built on a scale degree.
 *
 * `'auto'` is the signal that the chord is diatonic and should inherit its
 * quality from the current mode's scale (the behaviour the sequencer has
 * always had). Anything else is an explicit override that forces the chord
 * to be built from a fixed interval formula, regardless of what the mode
 * would produce at that scale degree — that's how borrowed chords (bVII,
 * bIII, #iv°, etc.) get their identity.
 */
export type ChordQuality = 'auto' | 'major' | 'minor' | 'diminished' | 'augmented';

/**
 * A chord degree, possibly borrowed from outside the current scale.
 *
 * `degree` is always 1–7 (the Roman-numeral position in a major scale).
 * `alteration` chromatically shifts the chord root by a semitone
 * (`-1` = flat, `+1` = sharp, `0` = natural). `quality` either follows
 * the diatonic scale (`'auto'`) or forces a specific chord colour.
 */
export interface ChordDegree {
  degree: number;
  alteration: number;
  quality: ChordQuality;
}

/** Convenience: build a plain diatonic degree. */
export function diatonic(degree: number): ChordDegree {
  return { degree, alteration: 0, quality: 'auto' };
}

/**
 * Semitone offset of a scale-degree root in borrowed-chord math. Uses the
 * major scale as the reference, matching traditional Roman-numeral analysis
 * (bVII in *any* key is the note 10 semitones above the tonic, not 9 or 11).
 */
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

/**
 * Pitch class (0–11) of the chord root for a given degree in a given key,
 * honouring alteration and quality. For pure diatonic degrees (`alteration
 * === 0 && quality === 'auto'`), the lookup uses the current mode's
 * intervals so the drone/pad/motif stay inside the scale. For borrowed
 * chords, the reference is the *major* scale + the alteration offset.
 */
export function getChordRootPitchClass(
  key: string,
  mode: string,
  degree: number,
  alteration = 0,
  quality: ChordQuality = 'auto',
): number {
  const tonicPc = keyToPitchClass(key);
  if (alteration === 0 && quality === 'auto') {
    const intervals = MODES[mode];
    if (!intervals) throw new Error(`Unknown mode: ${mode}`);
    const idx = (((degree - 1) % intervals.length) + intervals.length) % intervals.length;
    return (tonicPc + intervals[idx]) % 12;
  }
  const idx = (((degree - 1) % 7) + 7) % 7;
  return (((tonicPc + MAJOR_SCALE_INTERVALS[idx] + alteration) % 12) + 12) % 12;
}

// ---------------------------------------------------------------------------
// Chord types
// ---------------------------------------------------------------------------

/**
 * Roman-numeral scale-degree names (1-indexed).
 * Used by alt1 / alt2 per-degree chord recipes.
 */
export type DegreeRoman = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII';

const DEGREE_ROMANS: DegreeRoman[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * A chord recipe is either a list of scale-step offsets from the chord root
 * (where step 0 = the root itself, step 2 = the diatonic 3rd, step 4 = the 5th,
 * etc.) or a per-degree lookup mapping each scale degree to another chord-type
 * name (used by alt1 / alt2).
 */
export type ChordRecipe =
  | { kind: 'steps'; steps: number[] }
  | { kind: 'perDegree'; map: Record<DegreeRoman, string> };

/**
 * All chord-type recipes supported by the sequencer.
 *
 * Scale-step offsets (for `kind: 'steps'`):
 *   0 = root, 1 = 2nd, 2 = 3rd, 3 = 4th, 4 = 5th, 5 = 6th, 6 = 7th
 */
export const CHORD_TYPES: Record<string, ChordRecipe> = {
  Triad: { kind: 'steps', steps: [0, 2, 4] },
  '7th': { kind: 'steps', steps: [0, 2, 4, 6] },
  sus2:  { kind: 'steps', steps: [0, 1, 4] },
  sus4:  { kind: 'steps', steps: [0, 3, 4] },
  '6th': { kind: 'steps', steps: [0, 2, 4, 5] },
  alt1: {
    kind: 'perDegree',
    map: { I: 'Triad', II: '7th', III: 'Triad', IV: 'Triad', V: '7th', VI: '7th', VII: '6th' },
  },
  alt2: {
    kind: 'perDegree',
    map: { I: '7th', II: '7th', III: 'Triad', IV: '7th', V: '7th', VI: '6th', VII: '7th' },
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the semitone offset (from the tonic) of the scale note at the given
 * zero-based scale-step index, wrapping into higher octaves as needed.
 *
 * Example: in C Major ([0,2,4,5,7,9,11]), scaleDegree(s, 7) = 12 (C one octave up).
 */
function scaleStep(intervals: number[], index: number): number {
  const n = intervals.length;
  const wrapped = ((index % n) + n) % n;
  const octaveShift = Math.floor(index / n) * 12;
  return intervals[wrapped] + octaveShift;
}

/** Expand a set of pitch classes to every MIDI note (0–127) with that PC. */
function allMidiWithPitchClasses(pitchClasses: Set<number>): number[] {
  const out: number[] = [];
  for (let n = 0; n <= 127; n++) {
    if (pitchClasses.has(n % 12)) out.push(n);
  }
  return out;
}

/** Resolve a (possibly per-degree) chord recipe to a concrete `steps` list. */
function resolveSteps(chordType: string, degree: number): number[] {
  const recipe = CHORD_TYPES[chordType];
  if (!recipe) throw new Error(`Unknown chord type: ${chordType}`);
  if (recipe.kind === 'steps') return recipe.steps;

  const roman = DEGREE_ROMANS[(degree - 1) % 7];
  const delegated = recipe.map[roman];
  const inner = CHORD_TYPES[delegated];
  if (!inner || inner.kind !== 'steps') {
    throw new Error(`Chord type ${chordType} delegates to unknown/nested type ${delegated}`);
  }
  return inner.steps;
}

// ---------------------------------------------------------------------------
// Note-pool caches
// ---------------------------------------------------------------------------
//
// Both `getScaleNotes` and `getChordNotes` sweep 0–127 and filter by a small
// set of pitch classes — O(128) per call, allocating a 75-ish-element array
// each time. At 1/8 clock division and 120 BPM a motif calls `getNotePool`
// every 62 ms, so the allocation pressure adds up. The cache keys on every
// argument that affects output and returns the same array reference until
// the key is invalidated by a new combination. Callers treat the result as
// read-only (they only `.slice()` or index into it), so sharing refs is safe.
//
// Hard cap so pathological callers can't grow the map forever.

const POOL_CACHE_LIMIT = 256;
const scaleCache = new Map<string, number[]>();
const chordCache = new Map<string, number[]>();

function capCache<K, V>(cache: Map<K, V>): void {
  if (cache.size >= POOL_CACHE_LIMIT) cache.clear();
}

/** Exposed for tests so they can assert on cache behaviour. */
export function _clearPoolCaches(): void {
  scaleCache.clear();
  chordCache.clear();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return every MIDI note (0–127) that belongs to the given key + mode.
 * Notes are returned in ascending order. Cached by `key|mode`.
 */
export function getScaleNotes(key: string, mode: string): number[] {
  const cacheKey = `${key}|${mode}`;
  const cached = scaleCache.get(cacheKey);
  if (cached) return cached;

  const intervals = MODES[mode];
  if (!intervals) throw new Error(`Unknown mode: ${mode}`);
  const tonicPc = keyToPitchClass(key);
  const pcs = new Set(intervals.map((iv) => (tonicPc + iv) % 12));
  const result = allMidiWithPitchClasses(pcs);

  capCache(scaleCache);
  scaleCache.set(cacheKey, result);
  return result;
}

/**
 * Return every MIDI note (0–127) that is a chord tone for the chord built on
 * `degree` (1-indexed) of `key` + `mode`, using the given chord type. Cached
 * by `key|mode|degree|chordType|alteration|quality`.
 *
 * When `alteration === 0` and `quality === 'auto'` (the defaults), the chord
 * is built diatonically from the current mode — this is the original
 * sequencer behaviour and every existing call site hits this path unchanged.
 *
 * When either override is non-default, the call is delegated to
 * `getBorrowedChordNotes`, which rebuilds the chord from a fixed Roman-
 * numeral + quality interval formula so chromatic chords (bVII, bIII, #iv°,
 * etc.) escape the diatonic scale entirely.
 *
 * Notes come out in ascending MIDI order; callers can pick voicings as needed.
 */
export function getChordNotes(
  key: string,
  mode: string,
  degree: number,
  chordType: string,
  alteration = 0,
  quality: ChordQuality = 'auto',
): number[] {
  // Borrowed path — short-circuit before touching the diatonic cache/logic.
  if (alteration !== 0 || quality !== 'auto') {
    return getBorrowedChordNotes(key, degree, alteration, quality, chordType);
  }

  const cacheKey = `${key}|${mode}|${degree}|${chordType}`;
  const cached = chordCache.get(cacheKey);
  if (cached) return cached;

  const intervals = MODES[mode];
  if (!intervals) throw new Error(`Unknown mode: ${mode}`);
  if (degree < 1) throw new Error(`Degree must be 1-indexed, got ${degree}`);

  const tonicPc = keyToPitchClass(key);
  const steps = resolveSteps(chordType, degree);
  const rootIndex = degree - 1;

  const pcs = new Set<number>();
  for (const step of steps) {
    const semi = scaleStep(intervals, rootIndex + step);
    pcs.add((((tonicPc + semi) % 12) + 12) % 12);
  }
  const result = allMidiWithPitchClasses(pcs);

  capCache(chordCache);
  chordCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Borrowed chords
// ---------------------------------------------------------------------------

/**
 * Interval arrays (semitones from the chord root) for every
 * (quality, chordType) combination borrowed chords support.
 *
 * `sus2` and `sus4` ignore quality (the defining feature of a sus chord is
 * that the third is replaced). `alt1` and `alt2` are per-degree diatonic
 * recipes that don't have a natural borrowed analogue, so they fall through
 * to `Triad` — callers who want 7ths on borrowed chords should pick the
 * `7th` chord type explicitly.
 */
function getBorrowedChordIntervals(quality: ChordQuality, chordType: string): number[] {
  if (chordType === 'sus2') return [0, 2, 7];
  if (chordType === 'sus4') return [0, 5, 7];

  // alt1 / alt2 are diatonic-only; collapse to Triad for borrowed math.
  const resolved = chordType === 'alt1' || chordType === 'alt2' ? 'Triad' : chordType;

  // `auto` reaching this function means the caller ticked an alteration but
  // didn't commit a quality — the musical default for altered degrees is
  // major (bVII, bIII, bVI, bII, etc. are overwhelmingly major in practice).
  const q: Exclude<ChordQuality, 'auto'> = quality === 'auto' ? 'major' : quality;

  switch (resolved) {
    case 'Triad':
      if (q === 'minor') return [0, 3, 7];
      if (q === 'diminished') return [0, 3, 6];
      if (q === 'augmented') return [0, 4, 8];
      return [0, 4, 7];
    case '7th':
      if (q === 'minor') return [0, 3, 7, 10];      // min7
      if (q === 'diminished') return [0, 3, 6, 9];  // dim7 (fully diminished)
      if (q === 'augmented') return [0, 4, 8, 10];  // aug7
      return [0, 4, 7, 11];                         // maj7
    case '6th':
      if (q === 'minor') return [0, 3, 7, 9];       // min6
      return [0, 4, 7, 9];                          // maj6
    default:
      // Unknown chord type — safest fallback is a plain major triad.
      return [0, 4, 7];
  }
}

/**
 * Build a chord whose root is `alteration` semitones away from the major-
 * scale degree, with the interval structure dictated by
 * (`quality`, `chordType`), then return every MIDI note 0–127 that matches.
 *
 * This deliberately ignores `mode` — borrowed chords are defined relative
 * to the key tonic via the major scale, so `bVII` sounds the same whether
 * the current mode is Dorian or Harmonic Minor.
 *
 * Example: `getBorrowedChordNotes('C', 7, -1, 'major', 'Triad')` produces
 * the pitch-class set {Bb, D, F} expanded across all 10 octaves.
 */
export function getBorrowedChordNotes(
  key: string,
  degree: number,
  alteration: number,
  quality: string,
  chordType: string,
): number[] {
  if (degree < 1) throw new Error(`Degree must be 1-indexed, got ${degree}`);

  const cacheKey = `borrowed|${key}|${degree}|${alteration}|${quality}|${chordType}`;
  const cached = chordCache.get(cacheKey);
  if (cached) return cached;

  const rootPc = getChordRootPitchClass(key, 'Major', degree, alteration, quality as ChordQuality);
  const intervals = getBorrowedChordIntervals(quality as ChordQuality, chordType);

  const pcs = new Set<number>();
  for (const iv of intervals) pcs.add((rootPc + iv) % 12);
  const result = allMidiWithPitchClasses(pcs);

  capCache(chordCache);
  chordCache.set(cacheKey, result);
  return result;
}

/**
 * Decide whether the diatonic triad built on a scale degree is major, minor,
 * or diminished, based on the 3rd and 5th intervals above the chord root.
 *
 * For modes with exotic structure (Whole Tone augmented triads, pentatonic
 * wrap-arounds, the 2-note Tonic modes, etc.) the function falls back to
 * `'major'` when the triad is not one of the three common qualities — these
 * edge cases are not meaningful musically, the caller should not rely on them.
 */
export function getScaleDegreeChordSonority(
  mode: string,
  degree: number,
): 'major' | 'minor' | 'diminished' {
  const intervals = MODES[mode];
  if (!intervals) throw new Error(`Unknown mode: ${mode}`);

  const i = degree - 1;
  const root = scaleStep(intervals, i);
  const third = scaleStep(intervals, i + 2) - root;
  const fifth = scaleStep(intervals, i + 4) - root;

  if (third === 4 && fifth === 7) return 'major';
  if (third === 3 && fifth === 7) return 'minor';
  if (third === 3 && fifth === 6) return 'diminished';
  return 'major';
}

/**
 * Return a Roman numeral label for a scale degree, cased by sonority:
 *   - uppercase      → major    (e.g. "I", "IV", "V")
 *   - lowercase      → minor    (e.g. "ii", "vi")
 *   - lowercase + °  → diminished (e.g. "vii°")
 */
export function getDegreeRomanNumeral(mode: string, degree: number): string {
  const base = DEGREE_ROMANS[(degree - 1) % 7];
  const sonority = getScaleDegreeChordSonority(mode, degree);
  if (sonority === 'major') return base;
  if (sonority === 'minor') return base.toLowerCase();
  return `${base.toLowerCase()}°`;
}
