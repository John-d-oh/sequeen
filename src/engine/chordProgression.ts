/**
 * Chord-progression sequencer for Sequeen.
 *
 * A `ChordProgression` is an ordered list of up to 8 `ChordProgressionStep`s,
 * each parameterised by degree / alteration / quality / chordType / bars.
 * The engine walks those steps in real time, driven by bar-boundary callbacks
 * from the master Clock (one bar = 4 beats = 96 pulses at 24 PPQ).
 *
 * The engine is UI- and store-agnostic: when the active step changes, it
 * calls an injected `onStep` callback. In production that callback writes
 * the new chord into the Zustand store (so UI stays in sync and the
 * existing store→engine bridge fans the change out to pad / drone / motif
 * parts through the standard chord-change flow). Tests pass a recording
 * callback instead.
 *
 * Transport is fully independent of part transport: `play()` / `pause()` /
 * `stop()` control ONLY the progression; the pad, drone, and motifs
 * continue to follow their own armed/playing states.
 */

import type { ChordQuality } from './musicTheory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChordProgressionChordType =
  | 'Triad'
  | '7th'
  | 'sus2'
  | 'sus4'
  | '6th'
  | 'alt1'
  | 'alt2';

export interface ChordProgressionStep {
  /** 1–7, Roman-numeral position in a major scale. */
  degree: number;
  /** -1 flat, 0 natural, +1 sharp. */
  alteration: number;
  /**
   * `'auto'` = follow the current mode's scale (diatonic).
   * Explicit value = force chord quality (required for borrowed chords,
   * optional for diatonic positions as a modal-mixture override).
   */
  quality: ChordQuality;
  chordType: ChordProgressionChordType;
  /** Number of bars (1–8) to hold this step. 1 bar = 4 beats. */
  bars: number;
}

export interface ChordProgression {
  id: string;
  name: string;
  genre: string;
  degrees: ChordProgressionStep[];
  description: string;
  /** Suggested mode (advisory — progression still plays in any mode). */
  suggestedMode?: string;
}

export interface ChordProgressionSnapshot {
  progression: ChordProgression | null;
  /** Index of the step currently playing (or selected, if paused). */
  currentStepIdx: number;
  /** 1-based bar within the current step (1 = just started). */
  barInStep: number;
  /** Total bars the current step holds. */
  totalBarsInStep: number;
  isPlaying: boolean;
  loop: boolean;
  /** Sum of `bars` across all steps in the active progression. */
  totalBars: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface ChordProgressionEngineOptions {
  /**
   * Called whenever the engine loads or advances to a new step. The handler
   * is expected to update the global music state (store) with the new
   * degree / alteration / quality / chordType — the store's change
   * listeners then propagate it to the parts.
   */
  onStep: (step: ChordProgressionStep) => void;
}

function freshSnapshot(): ChordProgressionSnapshot {
  return {
    progression: null,
    currentStepIdx: 0,
    barInStep: 0,
    totalBarsInStep: 0,
    isPlaying: false,
    loop: true,
    totalBars: 0,
  };
}

export class ChordProgressionEngine {
  private progression: ChordProgression | null = null;
  private stepIdx = 0;
  /** Bars still to play on the current step before advancing. */
  private barsRemaining = 0;
  private _isPlaying = false;
  private _loop = true;
  private snapshotCache: ChordProgressionSnapshot = freshSnapshot();
  private listeners = new Set<() => void>();
  private readonly onStep: (step: ChordProgressionStep) => void;

  constructor(opts: ChordProgressionEngineOptions) {
    this.onStep = opts.onStep;
  }

  // ---- read ------------------------------------------------------------

  /** Stable snapshot for `useSyncExternalStore` — new identity only on real change. */
  getSnapshot(): ChordProgressionSnapshot {
    return this.snapshotCache;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getProgression(): ChordProgression | null {
    return this.progression;
  }

  getCurrentStep(): number {
    return this.stepIdx;
  }

  isPlaying(): boolean {
    return this._isPlaying;
  }

  // ---- load / transport -----------------------------------------------

  /** Install a progression. Always deep-copies so external edits can't leak. */
  load(progression: ChordProgression): void {
    this.progression = {
      ...progression,
      degrees: progression.degrees.map((s) => ({ ...s })),
    };
    this.stepIdx = 0;
    this.barsRemaining = 0;
    // If the engine was mid-play when a new progression loaded, re-engage
    // immediately so the new first-step chord change fires.
    if (this._isPlaying && this.progression.degrees.length > 0) {
      this.loadStep(0);
    }
    this.refreshSnapshot();
  }

  play(): void {
    if (this._isPlaying) return;
    if (!this.progression || this.progression.degrees.length === 0) return;
    this._isPlaying = true;
    // Fire the initial step chord change. `loadStep` resets barsRemaining
    // so the subsequent bar-boundary counting is correct.
    this.loadStep(this.stepIdx);
    this.refreshSnapshot();
  }

  pause(): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    this.refreshSnapshot();
  }

  /** Stop and reset to step 0. */
  stop(): void {
    this._isPlaying = false;
    this.stepIdx = 0;
    this.barsRemaining = 0;
    this.refreshSnapshot();
  }

  setLoop(loop: boolean): void {
    if (this._loop === loop) return;
    this._loop = loop;
    this.refreshSnapshot();
  }

  // ---- clock hook ------------------------------------------------------

  /**
   * Called once per bar boundary (after the first bar has elapsed). The
   * master clock wires this up so only genuine "bar 2 has started" events
   * trigger here — not the initial downbeat at t=0.
   */
  onBarComplete(): void {
    if (!this._isPlaying || !this.progression) return;
    this.barsRemaining--;
    if (this.barsRemaining <= 0) {
      const nextIdx = this.stepIdx + 1;
      if (nextIdx >= this.progression.degrees.length) {
        if (this._loop) {
          this.loadStep(0);
        } else {
          // One-shot: hold on the last step, stop playing.
          this._isPlaying = false;
        }
      } else {
        this.loadStep(nextIdx);
      }
    }
    this.refreshSnapshot();
  }

  // ---- editing ---------------------------------------------------------

  /** Partial-update a step in the active progression. Edits are live. */
  updateStep(idx: number, patch: Partial<ChordProgressionStep>): void {
    if (!this.progression) return;
    const len = this.progression.degrees.length;
    if (idx < 0 || idx >= len) return;
    this.progression = {
      ...this.progression,
      degrees: this.progression.degrees.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    };
    this.refreshSnapshot();
  }

  /** Append a default step (1-bar I Triad diatonic). No-op at 8 steps. */
  addStep(): void {
    if (!this.progression) return;
    if (this.progression.degrees.length >= 8) return;
    const next: ChordProgressionStep = {
      degree: 1,
      alteration: 0,
      quality: 'auto',
      chordType: 'Triad',
      bars: 1,
    };
    this.progression = {
      ...this.progression,
      degrees: [...this.progression.degrees, next],
    };
    this.refreshSnapshot();
  }

  /** Remove a step. No-op if it would leave the progression empty. */
  removeStep(idx: number): void {
    if (!this.progression) return;
    if (this.progression.degrees.length <= 1) return;
    this.progression = {
      ...this.progression,
      degrees: this.progression.degrees.filter((_, i) => i !== idx),
    };
    if (this.stepIdx >= this.progression.degrees.length) {
      this.stepIdx = Math.max(0, this.progression.degrees.length - 1);
    }
    this.refreshSnapshot();
  }

  /** Swap a step with its neighbour. */
  moveStep(idx: number, delta: -1 | 1): void {
    if (!this.progression) return;
    const target = idx + delta;
    if (target < 0 || target >= this.progression.degrees.length) return;
    const next = [...this.progression.degrees];
    [next[idx], next[target]] = [next[target], next[idx]];
    this.progression = { ...this.progression, degrees: next };
    this.refreshSnapshot();
  }

  // ---- internals -------------------------------------------------------

  /** Jump to a specific step, emit the chord change, and reset bar counter. */
  private loadStep(idx: number): void {
    if (!this.progression) return;
    this.stepIdx = idx;
    const step = this.progression.degrees[idx];
    if (!step) return;
    this.barsRemaining = Math.max(1, step.bars);
    this.onStep(step);
  }

  private refreshSnapshot(): void {
    const prog = this.progression;
    const step = prog?.degrees[this.stepIdx];
    const totalBarsInStep = step?.bars ?? 0;
    // barInStep = 1-based bar counter within the current step. When a step
    // has just been loaded, barsRemaining === totalBarsInStep, so this
    // evaluates to 1 (we're in bar 1). After each onBarComplete, it bumps.
    const barInStep =
      totalBarsInStep > 0 ? Math.max(1, totalBarsInStep - this.barsRemaining + 1) : 0;
    const totalBars = prog ? prog.degrees.reduce((a, s) => a + s.bars, 0) : 0;

    this.snapshotCache = {
      progression: prog,
      currentStepIdx: this.stepIdx,
      barInStep: Math.min(totalBarsInStep, barInStep),
      totalBarsInStep,
      isPlaying: this._isPlaying,
      loop: this._loop,
      totalBars,
    };

    for (const cb of this.listeners) cb();
  }
}

// ---------------------------------------------------------------------------
// Validation helpers (shared between tests + editor)
// ---------------------------------------------------------------------------

export function totalBars(progression: ChordProgression): number {
  return progression.degrees.reduce((a, s) => a + s.bars, 0);
}

export function isValidProgression(progression: ChordProgression): boolean {
  if (!progression.degrees.length || progression.degrees.length > 8) return false;
  for (const step of progression.degrees) {
    if (!Number.isInteger(step.degree) || step.degree < 1 || step.degree > 7) return false;
    if (step.alteration < -1 || step.alteration > 1) return false;
    if (!Number.isInteger(step.bars) || step.bars < 1 || step.bars > 8) return false;
  }
  return true;
}
