/**
 * The DRONE part.
 *
 * The drone holds a root-centered voicing in a low octave. Unlike the pad,
 * it has its own notion of whether to track chord changes or stay anchored
 * to the key, and it can retrigger on a rhythmic cadence instead of simply
 * sustaining.
 *
 * Two trigger modes:
 * - `root`  — the drone is locked to the key's root. Chord changes do NOT
 *             affect it. This is the "real drone" feel — something you lay
 *             under an entire progression.
 * - `chord` — the drone follows the root of the current chord degree. When
 *             the chord changes it releases and re-strikes on the new root.
 *
 * Four voicing shapes: root, root+oct, root+5th, root+5th+oct.
 *
 * Cadence is a per-beat trigger pattern. `0` sustains (no retriggers); `1`
 * fires on beat 1 of every bar; other numbers hit various on-beat patterns
 * (v1 implements the common ones; 6/7 fall through to on-one as a
 * placeholder until the multi-bar logic lands).
 *
 * Side effects go through a `DroneSink`: every strike is a `DroneEvent` with
 * `restrike: true`, telling the sink to release whatever drone notes are
 * currently held and hit the new voicing from silence. Tests use a
 * recording sink; the real app routes through `NoteTracker`.
 */

import { getChordRootPitchClass, type ChordQuality } from '../musicTheory';

// ---------------------------------------------------------------------------
// Key → pitch class
// ---------------------------------------------------------------------------

const KEY_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

function keyToPitchClass(key: string): number {
  const pc = KEY_TO_PC[key];
  if (pc === undefined) throw new Error(`Unknown key: ${key}`);
  return pc;
}

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export type DroneNoteSetting = 'root' | 'root+oct' | 'root+5th' | 'root+5th+oct';
export type DroneTriggerMode = 'root' | 'chord';

export interface DroneState {
  /**
   * Octave of the root note (0–4). Uses Yamaha-style naming where C0 = MIDI
   * 12 and C4 = MIDI 60; position 2 = C2 = MIDI 36 for a C key.
   */
  position: number;
  notes: DroneNoteSetting;
  triggerMode: DroneTriggerMode;
  /** Cadence index. 0 = sustained, 1 = on-one, etc. See `cadenceFires`. */
  cadence: number;
  velocity: number;
  midiChannel: number;
  isPlaying: boolean;
}

export const DEFAULT_DRONE_STATE: DroneState = {
  position: 2,
  notes: 'root',
  // `chord` = drone re-strikes on the current chord root whenever the degree
  // changes, which is the more "responsive-feeling" default for new users.
  // Switch to `root` for a true key-locked pedal tone under a progression.
  triggerMode: 'chord',
  cadence: 0,
  velocity: 100,
  midiChannel: 2,
  isPlaying: false,
};

export interface DroneChordContext {
  key: string;
  mode: string;
  degree: number;
  /** Chromatic offset from the diatonic degree: -1 = flat, +1 = sharp. */
  alteration?: number;
  /** `'auto'` = diatonic; anything else forces chord quality (for borrowed chords). */
  chordQuality?: ChordQuality;
}

export const DEFAULT_DRONE_CONTEXT: DroneChordContext = {
  key: 'C',
  mode: 'Major',
  degree: 1,
  alteration: 0,
  chordQuality: 'auto',
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Map a position (0–4) to an octave's C, returning MIDI note number. */
function octaveRoot(position: number, pitchClass: number): number {
  const clamped = Math.max(0, Math.min(4, position));
  // Yamaha convention: C0 = 12, C1 = 24, …, C4 = 60. General: C_n = (n+1)*12.
  return (clamped + 1) * 12 + pitchClass;
}

/**
 * Pitch class of the root note the drone should sound, given the current
 * trigger mode.
 *
 * - `root` mode locks the drone to the key tonic regardless of chords.
 * - `chord` mode follows the root of the current scale degree, honouring
 *   alteration + quality so borrowed chords (bVII, bIII, #IV, …) move the
 *   drone with them. Delegates to `getChordRootPitchClass` so the drone
 *   and pad/motif always agree on what the "chord root" is.
 */
function rootPitchClass(ctx: DroneChordContext, triggerMode: DroneTriggerMode): number {
  const tonicPc = keyToPitchClass(ctx.key);
  if (triggerMode === 'root') return tonicPc;
  return getChordRootPitchClass(
    ctx.key,
    ctx.mode,
    ctx.degree,
    ctx.alteration ?? 0,
    ctx.chordQuality ?? 'auto',
  );
}

/**
 * Build the list of MIDI notes for a drone voicing.
 *
 * @param position       Octave index (0–4)
 * @param notesSetting   Voicing shape
 * @param triggerMode    `'root'` (lock to key) or `'chord'` (follow degree)
 * @param alteration     Chromatic offset for borrowed chords (defaults 0)
 * @param quality        Quality override for borrowed chords (defaults `'auto'`)
 */
export function getDroneNotes(
  key: string,
  mode: string,
  degree: number,
  position: number,
  notesSetting: DroneNoteSetting,
  triggerMode: DroneTriggerMode,
  alteration: number = 0,
  quality: ChordQuality = 'auto',
): number[] {
  const pc = rootPitchClass(
    { key, mode, degree, alteration, chordQuality: quality },
    triggerMode,
  );
  const root = octaveRoot(position, pc);

  switch (notesSetting) {
    case 'root':
      return [root];
    case 'root+oct':
      return [root, root + 12];
    case 'root+5th':
      return [root, root + 7];
    case 'root+5th+oct':
      return [root, root + 7, root + 12];
  }
}

// ---------------------------------------------------------------------------
// Cadence patterns
// ---------------------------------------------------------------------------

/**
 * Decide whether the drone should fire (retrigger) on the given beat
 * (1–4 within a bar).
 *
 * v1 implements the common single-bar patterns. Indices 6 (on-one-of-three)
 * and 7 (on-one-of-five) span multiple bars and fall through to on-one
 * until the bar-counting logic lands — callers that need true multi-bar
 * cadence should track bar counts externally for now.
 */
export function cadenceFires(cadence: number, beat: number): boolean {
  switch (cadence) {
    case 0:
      return false; // no cadence — sustain
    case 1:
      return beat === 1; // on-one
    case 2:
      return beat === 1 || beat === 2; // on-one-&-two
    case 3:
      return beat === 1 || beat === 3; // on-one-&-three
    case 4:
      return beat === 2 || beat === 4; // on-two-&-four
    case 5:
      return beat >= 1 && beat <= 4; // on-one-through-four (every beat)
    case 6:
    case 7:
      // Multi-bar cadences; treat as on-one until bar counting is wired in.
      return beat === 1;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Sink
// ---------------------------------------------------------------------------

export interface DroneEvent {
  notes: number[];
  velocity: number;
  /**
   * When true, the sink must release any currently-held drone notes before
   * striking the new set — even if the note set is identical — so rhythmic
   * retriggers actually restrike instead of being optimised away.
   */
  restrike: boolean;
}

export interface DroneSink {
  emit(event: DroneEvent): void;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface DroneEngineOptions {
  sink: DroneSink;
  initialState?: Partial<DroneState>;
  initialContext?: Partial<DroneChordContext>;
}

export class DroneEngine {
  private state: DroneState;
  private ctx: DroneChordContext;
  private currentNotes: number[] = [];
  private readonly sink: DroneSink;

  constructor(opts: DroneEngineOptions) {
    this.sink = opts.sink;
    this.state = { ...DEFAULT_DRONE_STATE, ...opts.initialState };
    this.ctx = { ...DEFAULT_DRONE_CONTEXT, ...opts.initialContext };
  }

  // -- read-only accessors ------------------------------------------------

  getState(): Readonly<DroneState> {
    return this.state;
  }

  getContext(): Readonly<DroneChordContext> {
    return this.ctx;
  }

  getCurrentNotes(): readonly number[] {
    return this.currentNotes;
  }

  /** Compute the target notes for the current state + context (pure). */
  getDroneNotes(): number[] {
    return getDroneNotes(
      this.ctx.key,
      this.ctx.mode,
      this.ctx.degree,
      this.state.position,
      this.state.notes,
      this.state.triggerMode,
      this.ctx.alteration ?? 0,
      this.ctx.chordQuality ?? 'auto',
    );
  }

  // -- transport ----------------------------------------------------------

  start(): void {
    this.state = { ...this.state, isPlaying: true };
    this.strike();
  }

  stop(): void {
    this.state = { ...this.state, isPlaying: false };
    if (this.currentNotes.length > 0) {
      this.currentNotes = [];
      this.sink.emit({ notes: [], velocity: this.state.velocity, restrike: true });
    }
  }

  // -- external updates ---------------------------------------------------

  /**
   * Called when the sequencer changes chord degree, optionally with a
   * borrowed-chord alteration + quality override.
   *
   * In `root` trigger mode this is a silent update: the drone is anchored
   * to the key tonic and does not follow chords. In `chord` mode the drone
   * re-strikes on the new chord root (which for a borrowed chord is
   * computed via the major-scale + alteration formula).
   */
  onChordChange(
    newDegree: number,
    alteration: number = 0,
    quality: ChordQuality = 'auto',
  ): void {
    const changed =
      this.ctx.degree !== newDegree ||
      (this.ctx.alteration ?? 0) !== alteration ||
      (this.ctx.chordQuality ?? 'auto') !== quality;
    this.ctx = {
      ...this.ctx,
      degree: newDegree,
      alteration,
      chordQuality: quality,
    };
    if (!this.state.isPlaying) return;
    if (this.state.triggerMode === 'root') return;
    if (changed) this.strike();
  }

  /** Called when key or mode changes (degree is handled by `onChordChange`). */
  onContextChange(update: Partial<DroneChordContext>): void {
    const prev = this.ctx;
    this.ctx = { ...this.ctx, ...update };
    if (!this.state.isPlaying) return;
    if (prev.key !== this.ctx.key || prev.mode !== this.ctx.mode) {
      this.strike();
    }
  }

  /**
   * Called when a drone-state parameter changes from the UI.
   *
   * Parameter edits that can change which notes sound (`position`, `notes`,
   * `triggerMode`) re-strike only if the resulting voicing is actually
   * different from what's currently held. Cadence and velocity edits never
   * cause an immediate re-strike — cadence takes effect on the next beat,
   * and velocity affects the next strike only.
   */
  onParameterChange<K extends keyof DroneState>(param: K, value: DroneState[K]): void {
    if (this.state[param] === value) return;
    // `isPlaying` is owned by start()/stop(), not by direct parameter edits.
    if (param === 'isPlaying') return;
    this.state = { ...this.state, [param]: value };
    if (!this.state.isPlaying) return;

    const notesMayChange = param === 'position' || param === 'notes' || param === 'triggerMode';
    if (!notesMayChange) return;

    const next = this.getDroneNotes();
    if (!arraysEqual(this.currentNotes, next)) this.strike();
  }

  /** Clock hook: called at the start of every beat (beat = 1..4). */
  onBeat(beat: number): void {
    if (!this.state.isPlaying) return;
    if (cadenceFires(this.state.cadence, beat)) this.strike();
  }

  // -- internals ----------------------------------------------------------

  private strike(): void {
    const notes = this.getDroneNotes();
    this.currentNotes = notes;
    this.sink.emit({ notes, velocity: this.state.velocity, restrike: true });
  }
}
