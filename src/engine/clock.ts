/**
 * High-precision MIDI clock.
 *
 * Music-grade timing cannot use `setInterval` — its drift (easily 10–50 ms under
 * load) is audible and accumulates. Instead we drive from a high-resolution
 * time source (`performance.now()`) and a frame-rate scheduler
 * (`requestAnimationFrame`) that compares elapsed wall time against an ideal
 * "start time" to compute which pulses are due. Every pulse in the clock's
 * history has a mathematically exact target time; the scheduler just decides
 * *when to observe* that the time has passed.
 *
 * The clock generates 24 PPQ (pulses per quarter note), matching the MIDI 1.0
 * clock standard. Bar length is fixed at 4 beats (1 bar = 96 pulses).
 */

/** Pulses per quarter note — MIDI 1.0 clock standard. */
export const PPQ = 24;

/** Beats per bar (fixed 4/4 for Sequeen). */
export const BEATS_PER_BAR = 4;

/** BPM limits. */
export const MIN_BPM = 10;
export const MAX_BPM = 300;

export type ClockState = 'stopped' | 'playing' | 'paused';

/**
 * Callback fired once per pulse.
 *
 * @param pulseNumber  0–23, pulse index within the current beat
 * @param beatNumber   1–4, current beat within the bar
 * @param time         The *ideal* performance time (in ms) the pulse was due.
 *                     May be slightly in the past relative to `performance.now()`
 *                     — use this for sample-accurate scheduling of audio events.
 */
export type PulseCallback = (pulseNumber: number, beatNumber: number, time: number) => void;

/**
 * Pluggable scheduler. The clock only knows how to tick when told; the
 * scheduler decides *how often* to tick. In production this wraps
 * `requestAnimationFrame`; in tests we swap in a manually-driven fake so
 * timing is deterministic.
 */
export interface Scheduler {
  start(tick: () => void): void;
  stop(): void;
}

export interface ClockOptions {
  bpm?: number;
  /** Override for `performance.now()`. Used by tests for deterministic time. */
  now?: () => number;
  /** Override scheduler. Defaults to a `requestAnimationFrame` loop. */
  scheduler?: Scheduler;
}

// ---------------------------------------------------------------------------
// Default implementations (browser)
// ---------------------------------------------------------------------------

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function createRafScheduler(): Scheduler {
  let rafId: number | null = null;
  let currentTick: (() => void) | null = null;

  const loop = () => {
    const cb = currentTick;
    if (!cb) return;
    cb();
    // `currentTick` may have been cleared by stop() during the callback; re-check.
    if (currentTick !== null) rafId = requestAnimationFrame(loop);
  };

  return {
    start(tick) {
      currentTick = tick;
      if (rafId === null) rafId = requestAnimationFrame(loop);
    },
    stop() {
      currentTick = null;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}

function clampBpm(bpm: number): number {
  if (Number.isNaN(bpm)) throw new Error(`BPM must be a number, got NaN`);
  return Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
}

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

export class Clock {
  private readonly nowFn: () => number;
  private readonly scheduler: Scheduler;
  private listeners = new Set<PulseCallback>();

  private _bpm: number;
  private _state: ClockState = 'stopped';

  /**
   * Index of the most-recently-fired pulse. `-1` means nothing has fired yet
   * (either we're freshly stopped, or play hasn't reached the first pulse).
   * This is the single source of truth for "where are we?" in the timeline.
   */
  private _pulseIndex = -1;

  /**
   * Wall-clock reference point: the performance time at which pulse 0 would
   * have fired (even if we started mid-song). `elapsed = now - startTime`
   * divided by `pulseDurationMs` gives the index of the latest due pulse.
   */
  private _startTime = 0;

  constructor(opts: ClockOptions = {}) {
    this._bpm = clampBpm(opts.bpm ?? 120);
    this.nowFn = opts.now ?? defaultNow;
    this.scheduler = opts.scheduler ?? createRafScheduler();
  }

  // -- readonly getters ----------------------------------------------------

  /** Current BPM (10–300). */
  get bpm(): number {
    return this._bpm;
  }

  get state(): ClockState {
    return this._state;
  }

  /** Duration of a single pulse at the current BPM, in milliseconds. */
  get pulseDurationMs(): number {
    return 60_000 / this._bpm / PPQ;
  }

  /** Index of the most-recently-fired pulse. `-1` if nothing has fired yet. */
  get pulseIndex(): number {
    return this._pulseIndex;
  }

  /** Pulse position within the current beat, 0–23. Clamped to 0 before first pulse. */
  get pulseInBeat(): number {
    const i = Math.max(0, this._pulseIndex);
    return i % PPQ;
  }

  /** Current beat within the bar, 1–4. Clamped to 1 before first pulse. */
  get beat(): number {
    const i = Math.max(0, this._pulseIndex);
    return (Math.floor(i / PPQ) % BEATS_PER_BAR) + 1;
  }

  /** True when the *next* pulse to fire is the start of beat 1 of a bar. */
  get isDownbeat(): boolean {
    return this.beat === 1 && this.pulseInBeat === 0;
  }

  // -- subscription --------------------------------------------------------

  /** Register a pulse callback. Returns an unsubscribe function. */
  onPulse(cb: PulseCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // -- transport controls --------------------------------------------------

  /**
   * Start (or resume) playback. If the clock was stopped, the next pulse
   * fired is pulse 0. If paused, it continues from the stored position.
   */
  play(): void {
    if (this._state === 'playing') return;
    const now = this.nowFn();

    if (this._pulseIndex < 0) {
      // Fresh start — align pulse 0 exactly with "now".
      this._startTime = now;
    } else {
      // Resume — anchor the timeline so the last-fired pulse lies at "now";
      // the next tick advances forward from there.
      this._startTime = now - this._pulseIndex * this.pulseDurationMs;
    }

    this._state = 'playing';
    this.scheduler.start(() => this.tick(this.nowFn()));
  }

  /**
   * Pause playback. The current position is preserved; calling `play()` again
   * continues from the same pulse.
   */
  pause(): void {
    if (this._state !== 'playing') return;
    this._state = 'paused';
    this.scheduler.stop();
  }

  /**
   * Stop playback and reset position to before beat 1. The next `play()` will
   * fire pulse 0 again.
   */
  stop(): void {
    this._state = 'stopped';
    this.scheduler.stop();
    this._pulseIndex = -1;
  }

  /**
   * Change tempo. Takes effect immediately: the current pulse position stays
   * fixed in time, and future pulses are spaced at the new rate.
   */
  setBpm(bpm: number): void {
    const clamped = clampBpm(bpm);
    if (clamped === this._bpm) return;

    if (this._state === 'playing') {
      // Preserve position: re-anchor startTime so the already-fired pulse
      // index still maps to the current wall-clock time under the new rate.
      const now = this.nowFn();
      this._bpm = clamped;
      const anchorIndex = Math.max(0, this._pulseIndex);
      this._startTime = now - anchorIndex * this.pulseDurationMs;
    } else {
      this._bpm = clamped;
    }
  }

  // -- driving the timeline ------------------------------------------------

  /**
   * Advance the clock to the given wall-clock time, firing any pulses whose
   * target times have passed. Normally called by the internal scheduler; it
   * is public so tests (and alternate scheduling strategies, e.g. an
   * AudioContext look-ahead loop) can drive the clock deterministically.
   *
   * Catch-up is bounded only by the number of pulses actually due — if the
   * scheduler was delayed, multiple pulses will fire in one tick with their
   * original (past) target times, which is the correct behaviour for sample-
   * accurate audio scheduling.
   */
  tick(currentTime: number): void {
    if (this._state !== 'playing') return;
    const pulseDur = this.pulseDurationMs;
    const elapsed = currentTime - this._startTime;
    // Add a tiny epsilon before flooring: `pulseDur` is almost always a
    // non-terminating fraction (at 120 BPM it's 500/24 ≈ 20.8333…), so
    // `N * pulseDur / pulseDur` routinely computes to N − 1ulp and would
    // cause pulses to fire one tick late. The epsilon is far below any
    // realistic audio-scheduling precision.
    const target = Math.floor(elapsed / pulseDur + 1e-9);

    while (this._pulseIndex < target) {
      this._pulseIndex++;
      const p = this._pulseIndex;
      const pulseInBeat = p % PPQ;
      const beat = (Math.floor(p / PPQ) % BEATS_PER_BAR) + 1;
      const pulseTime = this._startTime + p * pulseDur;
      for (const listener of this.listeners) {
        listener(pulseInBeat, beat, pulseTime);
      }
    }
  }
}
