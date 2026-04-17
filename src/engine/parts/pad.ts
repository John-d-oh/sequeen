/**
 * The PAD part.
 *
 * The pad holds a slice of the current chord as a sustained voicing:
 * - `position` chooses a center MIDI note — as it rises, the voicing climbs
 *   and naturally inverts because we simply pick the lowest chord tones at
 *   or above the center.
 * - `range` chooses how many stacked chord tones to include from that
 *   starting point (v1 implements spread=1 = stacked thirds, which is the
 *   natural ordering of `getChordNotes`).
 * - On any chord or parameter change, a fresh voicing is computed and the
 *   delta is emitted to a `PadSink`. The sink is responsible for sending
 *   NoteOff for notes that left the voicing and NoteOn for notes that
 *   joined (typically via the shared `NoteTracker`).
 * - `strum` stretches the attacks of the voicing across a small time
 *   interval instead of striking them simultaneously. The engine doesn't
 *   schedule the strum itself; it stamps each note with a `delayMs` offset
 *   and leaves the scheduling to the caller (so tests stay deterministic).
 *
 * The `getActiveNotes` helper is exported separately as a pure function so
 * it can be unit-tested without a sink.
 */

import { getChordNotes, type ChordQuality } from '../musicTheory';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface PadState {
  /**
   * Center MIDI note of the voicing. The Sequeen UI exposes this as a 0–100
   * slider, but internally we store the resolved MIDI note number directly
   * so voicing math is straightforward.
   */
  position: number;
  /** Number of stacked chord tones to include (1–22). */
  range: number;
  /** Voicing openness (1–6). v1 only implements `1` = stacked thirds. */
  spread: number;
  /** Strum index: 1 = simultaneous, 2–7 = successive delays between notes. */
  strum: number;
  /** Velocity 0–127 used for every note in the voicing. */
  velocity: number;
  /** 1-based MIDI channel. */
  midiChannel: number;
  /** When false, all parameter/chord changes are buffered and no audio emits. */
  isPlaying: boolean;
}

export const DEFAULT_PAD_STATE: PadState = {
  position: 60,
  range: 3,
  spread: 1,
  strum: 1,
  velocity: 100,
  midiChannel: 1,
  isPlaying: false,
};

export interface PadChordContext {
  key: string;
  mode: string;
  degree: number;
  chordType: string;
  /** Chromatic offset from the diatonic degree: -1 = flat, +1 = sharp. */
  alteration?: number;
  /** `'auto'` = diatonic; anything else forces the chord quality. */
  chordQuality?: ChordQuality;
}

export const DEFAULT_PAD_CONTEXT: PadChordContext = {
  key: 'C',
  mode: 'Major',
  degree: 1,
  chordType: 'Triad',
  alteration: 0,
  chordQuality: 'auto',
};

// ---------------------------------------------------------------------------
// Pure voicing selection
// ---------------------------------------------------------------------------

/**
 * Select `range` chord tones centered around the given MIDI `position`.
 *
 * Rule: starting from the lowest chord tone whose MIDI number is ≥ `position`,
 * take the next `range` chord tones moving upward. If fewer than `range`
 * tones remain above the anchor (i.e. position is near 127), the anchor is
 * pulled down so the full `range` still fits.
 *
 * This is what produces the natural inversion behaviour: as `position`
 * moves up past a chord tone, that tone drops out of the bottom of the
 * voicing and a higher one enters at the top.
 */
export function getActiveNotes(
  key: string,
  mode: string,
  degree: number,
  chordType: string,
  position: number,
  range: number,
  alteration = 0,
  quality: ChordQuality = 'auto',
): number[] {
  if (range <= 0) return [];
  const pool = getChordNotes(key, mode, degree, chordType, alteration, quality);
  if (pool.length === 0) return [];

  // First chord tone at or above the center position.
  let startIdx = pool.findIndex((n) => n >= position);
  if (startIdx === -1) startIdx = pool.length; // position is above every chord tone

  // Pull back if the window would fall off the top of the pool.
  const maxStart = Math.max(0, pool.length - range);
  if (startIdx > maxStart) startIdx = maxStart;

  return pool.slice(startIdx, startIdx + range);
}

// ---------------------------------------------------------------------------
// Strum timing
// ---------------------------------------------------------------------------

/**
 * Delay between successive notes in a strummed voicing, in milliseconds.
 *
 * Sequeen's seven strum settings span "simultaneous" through roughly a
 * quarter-note spread. We map them to increasing beat fractions at the
 * current tempo. Exact musical note-value labels in the spec are ambiguous
 * in a few places ("3+1/8T" etc.); this mapping preserves monotonic
 * ordering and covers the full expressive range from a fast flutter to a
 * slow arpeggio.
 */
export function strumDelayMs(strum: number, bpm: number): number {
  const quarterMs = 60_000 / bpm;
  switch (strum) {
    case 1:
      return 0; // simultaneous
    case 2:
      return quarterMs / 8; // 1/32 note
    case 3:
      return quarterMs / 4; // 1/16 note
    case 4:
      return quarterMs / 3; // 1/8 triplet
    case 5:
      return quarterMs / 2; // 1/8 note
    case 6:
      return (quarterMs / 2) * 1.5; // dotted 1/8
    case 7:
      return quarterMs; // 1/4 note
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Sink + voiced note type
// ---------------------------------------------------------------------------

/**
 * A note within a voicing, optionally offset in time to implement strum.
 * Callers that want the old chord to release and the new chord to be
 * struck should compute the diff themselves (or route through NoteTracker).
 */
export interface VoicedNote {
  note: number;
  velocity: number;
  /** Offset from the voicing-change moment, in ms. `0` = play immediately. */
  delayMs: number;
}

/**
 * The pad engine emits a complete target voicing on every change. The sink
 * is responsible for reconciling that voicing against what is currently
 * sounding (via NoteTracker in the real app, or a test spy in unit tests).
 */
export interface PadSink {
  applyVoicing(voicing: VoicedNote[]): void;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface PadEngineOptions {
  sink: PadSink;
  /** Accessor so tempo changes are picked up without re-wiring the engine. */
  getBpm: () => number;
  initialState?: Partial<PadState>;
  initialContext?: Partial<PadChordContext>;
}

/**
 * Stateful pad voice. Holds the current `PadState` + `PadChordContext`,
 * computes the diff on every change, and pushes a new voicing to the sink
 * only when the *note set* has actually changed.
 */
export class PadEngine {
  private state: PadState;
  private ctx: PadChordContext;
  private currentVoicing: number[] = [];
  private readonly sink: PadSink;
  private readonly getBpm: () => number;

  constructor(opts: PadEngineOptions) {
    this.sink = opts.sink;
    this.getBpm = opts.getBpm;
    this.state = { ...DEFAULT_PAD_STATE, ...opts.initialState };
    this.ctx = { ...DEFAULT_PAD_CONTEXT, ...opts.initialContext };
  }

  // -- read-only accessors ------------------------------------------------

  getState(): Readonly<PadState> {
    return this.state;
  }

  getContext(): Readonly<PadChordContext> {
    return this.ctx;
  }

  /** Notes currently held by the pad (empty while stopped). */
  getCurrentVoicing(): readonly number[] {
    return this.currentVoicing;
  }

  /** Compute the target voicing for the current state + context, without side effects. */
  getActiveNotes(): number[] {
    return getActiveNotes(
      this.ctx.key,
      this.ctx.mode,
      this.ctx.degree,
      this.ctx.chordType,
      this.state.position,
      this.state.range,
      this.ctx.alteration ?? 0,
      this.ctx.chordQuality ?? 'auto',
    );
  }

  // -- transport ----------------------------------------------------------

  start(): void {
    this.state = { ...this.state, isPlaying: true };
    this.revoice();
  }

  stop(): void {
    this.state = { ...this.state, isPlaying: false };
    if (this.currentVoicing.length > 0) {
      this.currentVoicing = [];
      this.sink.applyVoicing([]);
    }
  }

  // -- external updates ---------------------------------------------------

  /**
   * Called by the sequencer when the harmonic context changes.
   *
   * `alteration` and `quality` propagate borrowed-chord info. When omitted,
   * the pad stays on the diatonic path (alteration=0, quality='auto').
   */
  onChordChange(
    newDegree: number,
    newChordType?: string,
    alteration: number = 0,
    quality: ChordQuality = 'auto',
  ): void {
    this.ctx = {
      ...this.ctx,
      degree: newDegree,
      chordType: newChordType ?? this.ctx.chordType,
      alteration,
      chordQuality: quality,
    };
    this.revoice();
  }

  /** Called when anything else in the chord context (key, mode) changes. */
  onContextChange(update: Partial<PadChordContext>): void {
    this.ctx = { ...this.ctx, ...update };
    this.revoice();
  }

  /** Called when a pad state parameter changes from the UI. */
  onParameterChange<K extends keyof PadState>(param: K, value: PadState[K]): void {
    if (this.state[param] === value) return;
    this.state = { ...this.state, [param]: value };
    this.revoice();
  }

  // -- internals ----------------------------------------------------------

  private revoice(): void {
    if (!this.state.isPlaying) return;
    const nextNotes = this.getActiveNotes();
    if (arraysEqual(this.currentVoicing, nextNotes)) return;

    const delay = strumDelayMs(this.state.strum, this.getBpm());
    const voiced: VoicedNote[] = nextNotes.map((note, i) => ({
      note,
      velocity: this.state.velocity,
      delayMs: i * delay,
    }));
    this.currentVoicing = nextNotes;
    this.sink.applyVoicing(voiced);
  }
}
