/**
 * The MOTIF part — a monophonic sequenced arpeggio.
 *
 * A motif has TWO independent sequences that run against each other:
 *
 *   1. The PATTERN picks which note of the current note pool to play next.
 *      It's a list of 1-based indices ("pattern values") into the pool,
 *      cycled according to a `variation` (forward, backward, ping-pong, …).
 *
 *   2. The RHYTHM decides what HAPPENS at each motif tick — a note, a rest,
 *      or a tie. It carries per-beat velocities. The rhythm advances on
 *      every tick regardless of type; the pattern only advances on `note`.
 *
 * The rhythm and pattern loop at different lengths, which is where the
 * polymetric shift comes from: over multiple bars the pattern's note
 * sequence and the rhythm's accent pattern drift against each other and
 * eventually realign at the LCM of their lengths.
 *
 * Clock ticks arrive via `onPulse()` at 24 PPQ; `clockDivide` determines
 * how many pulses make one motif tick.
 *
 * Monophonic discipline: the engine remembers the currently-sounding note
 * and sends a NoteOff before every new NoteOn. Rests send NoteOff
 * immediately; ties do nothing (the previous note keeps sounding).
 *
 * All MIDI side effects go through a `MotifSink` — tests inject a recording
 * sink; the real app routes through `NoteTracker` / `MidiPortManager`.
 */

import { getChordNotes, getScaleNotes, type ChordQuality } from '../musicTheory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MotifVariation =
  | 'forward'
  | 'backward'
  | 'pingpong'
  | 'pingpong_repeat'
  | 'odd_even'
  | 'random';

export type MotifPatternType = 'chord' | 'scale' | 'chromatic';

export type MotifClockDivide = '1/1' | '1/2' | '1/4' | '1/8' | '1/4T' | '1/8T';

export type MotifRhythmType = 'note' | 'rest' | 'tie';

export type MotifAccent = 'rhythm' | 'motif' | 'humanized';

export interface MotifRhythmBeat {
  type: MotifRhythmType;
  velocity: number;
}

export interface MotifState {
  /** Starting offset into the generated note pool. */
  position: number;
  /** Number of pattern slots that are active (1–16). */
  patternLength: number;
  variation: MotifVariation;
  /** 16-slot pattern. Each entry is a 1-based index into the note pool. */
  pattern: number[];
  patternType: MotifPatternType;
  clockDivide: MotifClockDivide;
  /** Number of rhythm beats that are active (4–32). */
  rhythmLength: number;
  /** 32-slot rhythm. Inactive slots past `rhythmLength` are ignored. */
  rhythm: MotifRhythmBeat[];
  accent: MotifAccent;
  /** Used when `accent === 'motif'`. */
  velocity: number;
  /** Humanize jitter amount 0–100 (% of rhythm velocity). Used for `'humanized'`. */
  humanizeAmount: number;
  midiChannel: number;
  isPlaying: boolean;
}

export interface MotifChordContext {
  key: string;
  mode: string;
  degree: number;
  chordType: string;
  /** Chromatic offset from the diatonic degree: -1 = flat, +1 = sharp. */
  alteration?: number;
  /** `'auto'` = diatonic; anything else forces chord quality (borrowed chords). */
  chordQuality?: ChordQuality;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default rhythm: 8 eighth notes filling one bar at 1/8 clockDivide. */
function makeDefaultRhythm(): MotifRhythmBeat[] {
  const r: MotifRhythmBeat[] = [];
  for (let i = 0; i < 8; i++) r.push({ type: 'note', velocity: 100 });
  for (let i = 8; i < 32; i++) r.push({ type: 'rest', velocity: 0 });
  return r;
}

function makeDefaultPattern(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8];
}

export const DEFAULT_MOTIF_STATE: MotifState = {
  // `position` is an INDEX into the generated note pool, not a MIDI note.
  // For the default `chord` patternType, a C-major chord pool ascends
  //   [C-1, E-1, G-1, C0, E0, G0, C1, E1, G1, C2, E2, G2, C3, ...]
  // so position 12 lines up around C3, putting an 8-note ascending
  // arpeggio in the C3..E5 range — well inside any synth's playable
  // register. Position 0 was index zero into the pool, which produced
  // sub-audible MIDI 0–7 notes and made the motifs sound silent.
  position: 12,
  patternLength: 8,
  variation: 'forward',
  pattern: makeDefaultPattern(),
  patternType: 'chord',
  clockDivide: '1/8',
  // 8-eighth-note rhythm at 1/8 = exactly one bar, which lines up with
  // the 8-step pattern so they cycle in phase by default.
  rhythmLength: 8,
  rhythm: makeDefaultRhythm(),
  accent: 'rhythm',
  velocity: 100,
  humanizeAmount: 20,
  midiChannel: 3,
  isPlaying: false,
};

export const DEFAULT_MOTIF_CONTEXT: MotifChordContext = {
  key: 'C',
  mode: 'Major',
  degree: 1,
  chordType: 'Triad',
  alteration: 0,
  chordQuality: 'auto',
};

// ---------------------------------------------------------------------------
// Clock divide → pulses per motif tick
// ---------------------------------------------------------------------------

/**
 * Pulse counts per motif tick, at 24 PPQ. Sequeen's naming treats "1/1"
 * as a quarter note (24 pulses), so the whole table is scaled to that.
 */
export function pulsesPerDivide(div: MotifClockDivide): number {
  switch (div) {
    case '1/1':
      return 24;
    case '1/2':
      return 12;
    case '1/4':
      return 6;
    case '1/8':
      return 3;
    case '1/4T':
      return 4;
    case '1/8T':
      return 2;
  }
}

// ---------------------------------------------------------------------------
// Variation iterator (stateless)
// ---------------------------------------------------------------------------

/**
 * Given a variation, a pattern length, and the running count `k` of note
 * events emitted so far, return the 0-based index into `pattern` for the
 * k-th note event. Stateless and closed-form so tests can assert on it
 * directly.
 *
 * `random` is injected for the `'random'` variation so tests stay
 * deterministic.
 */
export function variationStep(
  variation: MotifVariation,
  length: number,
  k: number,
  random: () => number = Math.random,
): number {
  const L = Math.max(1, length);
  if (L === 1) return 0;

  switch (variation) {
    case 'forward':
      return ((k % L) + L) % L;
    case 'backward':
      return (L - 1) - (((k % L) + L) % L);
    case 'pingpong': {
      // Period = 2*(L-1): 0,1,…,L-1,L-2,…,1 | 0,1,… (endpoints not repeated)
      const period = 2 * (L - 1);
      const cycle = ((k % period) + period) % period;
      return cycle < L ? cycle : period - cycle;
    }
    case 'pingpong_repeat': {
      // Period = 2L: 0,1,…,L-1,L-1,L-2,…,0 | 0,1,… (endpoints repeated once)
      const period = 2 * L;
      const cycle = ((k % period) + period) % period;
      return cycle < L ? cycle : 2 * L - 1 - cycle;
    }
    case 'odd_even': {
      // First the odd-indexed 1-based slots (0,2,4,…), then the even ones (1,3,5,…).
      const oddCount = Math.ceil(L / 2);
      const cycle = ((k % L) + L) % L;
      if (cycle < oddCount) return cycle * 2;
      return (cycle - oddCount) * 2 + 1;
    }
    case 'random':
      return Math.floor(random() * L);
  }
}

// ---------------------------------------------------------------------------
// Sink
// ---------------------------------------------------------------------------

export interface MotifSink {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface MotifEngineOptions {
  sink: MotifSink;
  initialState?: Partial<MotifState>;
  initialContext?: Partial<MotifChordContext>;
  /** Override for `Math.random` so tests stay deterministic. */
  random?: () => number;
}

export class MotifEngine {
  private state: MotifState;
  private ctx: MotifChordContext;
  private readonly sink: MotifSink;
  private readonly random: () => number;

  /** Counts pulses since last `start()`. Used for clock division. */
  private pulseCounter = 0;
  /** Counts note events (rests/ties excluded) since last `start()`. Feeds `variationStep`. */
  private noteEventCount = 0;
  /** Current position in the rhythm sequence. Wraps at `rhythmLength`. */
  private rhythmIndex = 0;
  /** The single note currently being held, or `null` if silent. */
  private currentNote: number | null = null;
  /** Pattern step index of the most recently played note; `-1` if nothing has played yet. */
  private lastStepIdx = -1;

  constructor(opts: MotifEngineOptions) {
    this.sink = opts.sink;
    this.random = opts.random ?? Math.random;
    this.state = {
      ...DEFAULT_MOTIF_STATE,
      ...opts.initialState,
      // Arrays must be copied so external mutations don't bleed in.
      pattern: [...(opts.initialState?.pattern ?? DEFAULT_MOTIF_STATE.pattern)],
      rhythm: [...(opts.initialState?.rhythm ?? DEFAULT_MOTIF_STATE.rhythm)],
    };
    this.ctx = { ...DEFAULT_MOTIF_CONTEXT, ...opts.initialContext };
  }

  // -- read-only accessors ------------------------------------------------

  getState(): Readonly<MotifState> {
    return this.state;
  }

  getContext(): Readonly<MotifChordContext> {
    return this.ctx;
  }

  getCurrentNote(): number | null {
    return this.currentNote;
  }

  /**
   * The 0-based pattern step index of the most recently played note, or `-1`
   * if nothing has been played since the last `start()`. Used by the UI to
   * highlight the active step in the pattern editor / step indicator.
   */
  getCurrentStep(): number {
    return this.lastStepIdx;
  }

  /**
   * Build the ascending pool of MIDI notes the motif pattern picks from,
   * based on `patternType`:
   *   - `chord`    → chord tones of the current degree, *including borrowed
   *                  chord alterations* (moves with chords)
   *   - `scale`    → all scale notes of the current key/mode (fixed; does
   *                  NOT depend on degree OR on borrowed-chord alterations —
   *                  a borrowed bVII in C Major does NOT magically add Bb
   *                  to the C Major scale pool)
   *   - `chromatic`→ every MIDI note 0–127 (fixed, degree-independent)
   */
  getNotePool(): number[] {
    switch (this.state.patternType) {
      case 'chord':
        return getChordNotes(
          this.ctx.key,
          this.ctx.mode,
          this.ctx.degree,
          this.ctx.chordType,
          this.ctx.alteration ?? 0,
          this.ctx.chordQuality ?? 'auto',
        );
      case 'scale':
        return getScaleNotes(this.ctx.key, this.ctx.mode);
      case 'chromatic':
        return Array.from({ length: 128 }, (_, i) => i);
    }
  }

  // -- transport ----------------------------------------------------------

  /**
   * Begin playback. Resets pulse / rhythm / note-event counters so the
   * motif always starts from the top when global play engages.
   */
  start(): void {
    this.releaseCurrentNote();
    this.state = { ...this.state, isPlaying: true };
    this.pulseCounter = 0;
    this.noteEventCount = 0;
    this.rhythmIndex = 0;
    this.lastStepIdx = -1;
  }

  /** Stop playback and release any held note. */
  stop(): void {
    this.state = { ...this.state, isPlaying: false };
    this.releaseCurrentNote();
    this.lastStepIdx = -1;
  }

  // -- external updates ---------------------------------------------------

  /**
   * Called by the sequencer on chord changes, with optional borrowed-chord
   * alteration + quality. Only `chord`-type patterns pick up the change on
   * the NEXT note event; `scale` and `chromatic` pools are degree- and
   * alteration-independent, so the stored context is updated but the pool
   * stays put.
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
  }

  onContextChange(update: Partial<MotifChordContext>): void {
    this.ctx = { ...this.ctx, ...update };
  }

  onParameterChange<K extends keyof MotifState>(param: K, value: MotifState[K]): void {
    if (param === 'isPlaying') return; // owned by start()/stop()
    this.state = { ...this.state, [param]: value };
    // No immediate note output — changes take effect at the next tick.
  }

  // -- clock --------------------------------------------------------------

  /**
   * Clock pulse hook. Call exactly once per 24-PPQ pulse while the global
   * transport is running. The motif divides these pulses by `clockDivide`
   * internally, firing a motif tick on every N-th pulse.
   */
  onPulse(): void {
    if (!this.state.isPlaying) return;
    const ppt = pulsesPerDivide(this.state.clockDivide);
    if (this.pulseCounter % ppt === 0) this.tick();
    this.pulseCounter++;
  }

  /**
   * Advance exactly one motif tick. Exposed for tests that want to bypass
   * the pulse-division arithmetic; the real app goes through `onPulse`.
   */
  tick(): void {
    if (!this.state.isPlaying) return;

    const beat = this.state.rhythm[this.rhythmIndex];
    if (!beat) {
      this.advanceRhythm();
      return;
    }

    switch (beat.type) {
      case 'rest':
        this.releaseCurrentNote();
        break;

      case 'tie':
        // Hold whatever is currently sounding. Explicitly do nothing.
        break;

      case 'note': {
        this.releaseCurrentNote();
        const stepIdx = variationStep(
          this.state.variation,
          this.state.patternLength,
          this.noteEventCount,
          this.random,
        );
        this.lastStepIdx = stepIdx;
        const patternValue = this.state.pattern[stepIdx];
        const pool = this.getNotePool();
        const poolIdx = this.state.position + (patternValue - 1);
        const note = pool[poolIdx];
        if (note !== undefined) {
          const velocity = this.resolveVelocity(beat.velocity);
          this.sink.noteOn(note, velocity);
          this.currentNote = note;
        }
        this.noteEventCount++;
        break;
      }
    }

    this.advanceRhythm();
  }

  private advanceRhythm(): void {
    const len = Math.max(1, this.state.rhythmLength);
    this.rhythmIndex = (this.rhythmIndex + 1) % len;
  }

  private releaseCurrentNote(): void {
    if (this.currentNote !== null) {
      this.sink.noteOff(this.currentNote);
      this.currentNote = null;
    }
  }

  private resolveVelocity(rhythmVelocity: number): number {
    switch (this.state.accent) {
      case 'rhythm':
        return rhythmVelocity;
      case 'motif':
        return this.state.velocity;
      case 'humanized': {
        const amount = Math.max(0, Math.min(100, this.state.humanizeAmount)) / 100;
        // `random()` is in [0,1); shift to [-amount, +amount] and jitter around rhythmVelocity.
        const jitter = (this.random() - 0.5) * 2 * amount * rhythmVelocity;
        return Math.max(1, Math.min(127, Math.round(rhythmVelocity + jitter)));
      }
    }
  }
}
