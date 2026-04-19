/**
 * SequeenEngine — master coordinator for all engine classes.
 *
 * Owns the full audio/MIDI pipeline:
 *   Clock → Transport → per-part engines → NoteTracker → MidiPortManager
 *
 * The class is deliberately UI-agnostic: it doesn't know about React, Zustand,
 * or the DOM. The React bridge lives in `appEngines.ts` and talks to an
 * `SequeenEngine` instance through this file's public API. Tests instantiate
 * `SequeenEngine` directly with a recording MIDI manager and a fake clock
 * scheduler, which gives us end-to-end integration coverage without a
 * browser or a real Web MIDI stack.
 */

import { Clock, type Scheduler } from './clock';
import { Transport, ALL_PARTS, type PartName, type TransportState } from './transport';
import { NoteTracker, type MidiSink, type PartMidiConfig } from './midiOutput';
import { PadEngine, type PadSink, type VoicedNote, type PadState } from './parts/pad';
import { DroneEngine, type DroneSink, type DroneEvent, type DroneState } from './parts/drone';
import { MotifEngine, type MotifSink, type MotifState } from './parts/motif';
import type { ChordQuality } from './musicTheory';
import { ChordProgressionEngine, type ChordProgressionStep } from './chordProgression';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimum MIDI output surface SequeenEngine talks to.
 *
 * `MidiPortManager` already implements this shape; tests pass a recording
 * spy with the same methods.
 */
export interface SequeenMidiManager extends MidiSink {
  sendAllNotesOff(portId: string, channel: number): void;
  panic(): void;
}

export interface SequeenMusicState {
  key: string;
  mode: string;
  degree: number;
  /** Chromatic offset: -1 = flat (bVII), 0 = natural, +1 = sharp (#IV). */
  alteration: number;
  /**
   * Chord quality override for borrowed chords. `'auto'` means "diatonic:
   * derive from the scale" and is the only legal value when alteration = 0.
   */
  chordQuality: ChordQuality;
  chordType: string;
  bpm: number;
}

export const DEFAULT_SEQUEEN_MUSIC: SequeenMusicState = {
  key: 'C',
  mode: 'Major',
  degree: 1,
  alteration: 0,
  chordQuality: 'auto',
  chordType: 'Triad',
  bpm: 120,
};

export interface SequeenEngineOptions {
  midiManager: SequeenMidiManager;
  /** Test-friendly override for the Clock's rAF scheduler. */
  clockScheduler?: Scheduler;
  /** Test-friendly override for `performance.now()`. */
  clockNow?: () => number;
  initialMusic?: Partial<SequeenMusicState>;
}

// ---------------------------------------------------------------------------
// SequeenEngine
// ---------------------------------------------------------------------------

function syncPlay(status: string, engine: { start(): void; stop(): void }): void {
  if (status === 'playing') engine.start();
  else engine.stop();
}

export class SequeenEngine {
  readonly clock: Clock;
  readonly transport: Transport;
  readonly noteTracker: NoteTracker;
  readonly padEngine: PadEngine;
  readonly droneEngine: DroneEngine;
  readonly motif1Engine: MotifEngine;
  readonly motif2Engine: MotifEngine;
  readonly progressionEngine: ChordProgressionEngine;

  private readonly midi: SequeenMidiManager;
  private music: SequeenMusicState;
  private partConfigs: Record<PartName, PartMidiConfig> = {
    pad: { portId: '', channel: 1 },
    drone: { portId: '', channel: 2 },
    motif1: { portId: '', channel: 3 },
    motif2: { portId: '', channel: 4 },
  };

  /**
   * Count of complete bars the clock has driven since the current clock
   * session started. Used to distinguish "the very first downbeat at t=0"
   * from "the downbeat starting bar 2+" when firing bar-boundary events.
   */
  private barsPlayed = 0;

  /** Subscribers to bar-boundary events (fired at the start of bar 2, 3, …). */
  private barListeners = new Set<() => void>();

  /** Callback for progression step changes; default routes to `this.setChord`. */
  private onProgressionStep: (step: ChordProgressionStep) => void = (step) => {
    this.setChord({
      degree: step.degree,
      alteration: step.alteration,
      quality: step.quality,
      chordType: step.chordType,
    });
  };

  constructor(opts: SequeenEngineOptions) {
    this.midi = opts.midiManager;
    this.music = { ...DEFAULT_SEQUEEN_MUSIC, ...opts.initialMusic };

    this.clock = new Clock({
      bpm: this.music.bpm,
      scheduler: opts.clockScheduler,
      now: opts.clockNow,
    });
    this.transport = new Transport();
    this.noteTracker = new NoteTracker(this.midi);

    // Pad: emits a target voicing; NoteTracker diffs against the held set.
    // `restrike: true` (used by bar-mode trigger) forces a release of any
    // currently-held pad notes BEFORE the diff so the synth re-attacks
    // even when the note set is identical to what's already sounding.
    const padSink: PadSink = {
      applyVoicing: (voicing: VoicedNote[], opts) => {
        const cfg = this.partConfigs.pad;
        if (!cfg.portId) return;
        if (opts?.restrike) this.noteTracker.releasePart('pad');
        this.noteTracker.updateNotes(
          'pad',
          cfg.portId,
          cfg.channel,
          voicing.map((v) => ({ note: v.note, velocity: v.velocity })),
        );
      },
    };

    // Drone: `restrike: true` forces a release-then-strike even when the
    // target notes are identical to what's currently held (cadence retriggers).
    const droneSink: DroneSink = {
      emit: (event: DroneEvent) => {
        const cfg = this.partConfigs.drone;
        if (!cfg.portId) return;
        if (event.restrike) this.noteTracker.releasePart('drone');
        this.noteTracker.updateNotes(
          'drone',
          cfg.portId,
          cfg.channel,
          event.notes.map((n) => ({ note: n, velocity: event.velocity })),
        );
      },
    };

    // Motifs: monophonic — let them drive NoteOn/NoteOff directly against
    // the manager, since there is no diff to optimise.
    const makeMotifSink = (part: 'motif1' | 'motif2'): MotifSink => ({
      noteOn: (note, velocity) => {
        const cfg = this.partConfigs[part];
        if (!cfg.portId) return;
        this.midi.sendNoteOn(cfg.portId, cfg.channel, note, velocity);
      },
      noteOff: (note) => {
        const cfg = this.partConfigs[part];
        if (!cfg.portId) return;
        this.midi.sendNoteOff(cfg.portId, cfg.channel, note);
      },
    });

    this.padEngine = new PadEngine({ sink: padSink, getBpm: () => this.music.bpm });
    this.droneEngine = new DroneEngine({ sink: droneSink });
    this.motif1Engine = new MotifEngine({ sink: makeMotifSink('motif1') });
    this.motif2Engine = new MotifEngine({ sink: makeMotifSink('motif2') });

    // Progression engine: onStep callback goes through an indirection so
    // appEngines.ts can install its own store-updating callback at init
    // time (see `setProgressionStepHandler`).
    this.progressionEngine = new ChordProgressionEngine({
      onStep: (step) => this.onProgressionStep(step),
    });

    this.wireClock();
    this.wireTransport();
  }

  /**
   * Install a custom step handler for the progression engine. appEngines.ts
   * uses this to route progression advances through the Zustand store so
   * the UI stays in sync with the active chord.
   */
  setProgressionStepHandler(handler: (step: ChordProgressionStep) => void): void {
    this.onProgressionStep = handler;
  }

  /** Subscribe to bar-boundary events (end-of-bar). Returns unsubscribe. */
  onBar(cb: () => void): () => void {
    this.barListeners.add(cb);
    return () => {
      this.barListeners.delete(cb);
    };
  }

  // -- wiring -------------------------------------------------------------

  private wireClock(): void {
    this.clock.onPulse((pulseInBeat, beat) => {
      // Beat boundary: promote armed parts (so individual toggles land on
      // the downbeat), fire drone cadence, and count bars for progression
      // advancement.
      if (pulseInBeat === 0) {
        this.transport.promoteArmedParts();
        this.droneEngine.onBeat(beat);

        if (beat === 1) {
          // Very first beat-1 downbeat after clock start → starts bar 1.
          // Every subsequent beat-1 downbeat → ends the previous bar and
          // starts the next one. The progression engine wants the LATTER,
          // so we fire barListeners only after `barsPlayed` has been
          // incremented at least once.
          if (this.barsPlayed > 0) {
            this.progressionEngine.onBarComplete();
            this.padEngine.onBar();
            for (const cb of this.barListeners) cb();
          }
          this.barsPlayed++;
        }
      }
      // Every pulse: motifs check against their own clockDivide internally.
      this.motif1Engine.onPulse();
      this.motif2Engine.onPulse();
    });
  }

  private wireTransport(): void {
    this.transport.subscribe((state) => this.syncEngineTransport(state));
  }

  private syncEngineTransport(state: TransportState): void {
    syncPlay(state.parts.pad, this.padEngine);
    syncPlay(state.parts.drone, this.droneEngine);
    syncPlay(state.parts.motif1, this.motif1Engine);
    syncPlay(state.parts.motif2, this.motif2Engine);
  }

  // -- music state --------------------------------------------------------

  getMusic(): Readonly<SequeenMusicState> {
    return this.music;
  }

  setKey(key: string): void {
    if (key === this.music.key) return;
    this.music = { ...this.music, key };
    this.padEngine.onContextChange({ key });
    this.droneEngine.onContextChange({ key });
    this.motif1Engine.onContextChange({ key });
    this.motif2Engine.onContextChange({ key });
  }

  setMode(mode: string): void {
    if (mode === this.music.mode) return;
    this.music = { ...this.music, mode };
    this.padEngine.onContextChange({ mode });
    this.droneEngine.onContextChange({ mode });
    this.motif1Engine.onContextChange({ mode });
    this.motif2Engine.onContextChange({ mode });
  }

  setDegree(degree: number): void {
    if (degree === this.music.degree) return;
    this.music = { ...this.music, degree };
    this.propagateChordChange();
  }

  setChordType(chordType: string): void {
    if (chordType === this.music.chordType) return;
    this.music = { ...this.music, chordType };
    this.padEngine.onChordChange(
      this.music.degree,
      chordType,
      this.music.alteration,
      this.music.chordQuality,
    );
    // Drone only uses the chord root, which is independent of chord type.
    this.motif1Engine.onChordChange(
      this.music.degree,
      chordType,
      this.music.alteration,
      this.music.chordQuality,
    );
    this.motif2Engine.onChordChange(
      this.music.degree,
      chordType,
      this.music.alteration,
      this.music.chordQuality,
    );
  }

  /**
   * Set the chromatic alteration applied to the current degree.
   * `-1` = flat, `0` = natural, `+1` = sharp. Triggers a chord change.
   * Also forces `chordQuality` to `'auto'` when stepping back to `0`, since
   * `'auto'` is only meaningful for diatonic chords.
   */
  setAlteration(alteration: number): void {
    const clamped = Math.max(-1, Math.min(1, Math.round(alteration)));
    if (clamped === this.music.alteration) return;
    const nextQuality: ChordQuality =
      clamped === 0 ? 'auto' : this.music.chordQuality === 'auto' ? 'major' : this.music.chordQuality;
    this.music = { ...this.music, alteration: clamped, chordQuality: nextQuality };
    this.propagateChordChange();
  }

  /**
   * Override chord quality (used only for borrowed chords — when
   * `alteration === 0`, the value is coerced back to `'auto'`).
   */
  setChordQuality(quality: ChordQuality): void {
    if (this.music.alteration === 0 && quality !== 'auto') {
      // Ignore — diatonic chords inherit quality from the scale.
      return;
    }
    if (quality === this.music.chordQuality) return;
    this.music = { ...this.music, chordQuality: quality };
    this.propagateChordChange();
  }

  /** Push the current (degree, alteration, quality, chordType) to every part. */
  private propagateChordChange(): void {
    const { degree, chordType, alteration, chordQuality } = this.music;
    this.padEngine.onChordChange(degree, chordType, alteration, chordQuality);
    this.droneEngine.onChordChange(degree, alteration, chordQuality);
    this.motif1Engine.onChordChange(degree, chordType, alteration, chordQuality);
    this.motif2Engine.onChordChange(degree, chordType, alteration, chordQuality);
  }

  /**
   * Atomic chord update. The progression engine and the Zustand bridge
   * both call this so we never go through a transient intermediate state
   * like "degree changed but alteration not yet" that would briefly emit
   * the wrong chord to the parts.
   *
   * This is also the only path that allows forcing a non-`'auto'` quality
   * on a diatonic degree (modal mixture) — the individual `setChordQuality`
   * setter still rejects that for UI ergonomics.
   */
  setChord(chord: {
    degree: number;
    alteration: number;
    quality: ChordQuality;
    chordType: string;
  }): void {
    const m = this.music;
    if (
      chord.degree === m.degree &&
      chord.alteration === m.alteration &&
      chord.quality === m.chordQuality &&
      chord.chordType === m.chordType
    ) {
      return;
    }
    this.music = {
      ...m,
      degree: chord.degree,
      alteration: chord.alteration,
      chordQuality: chord.quality,
      chordType: chord.chordType,
    };
    this.propagateChordChange();
  }

  setBpm(bpm: number): void {
    const clamped = Math.max(10, Math.min(300, bpm));
    if (clamped === this.music.bpm) return;
    this.music = { ...this.music, bpm: clamped };
    this.clock.setBpm(clamped);
  }

  // -- per-part parameter setters ----------------------------------------

  setPadParam<K extends keyof PadState>(key: K, value: PadState[K]): void {
    this.padEngine.onParameterChange(key, value);
  }
  setDroneParam<K extends keyof DroneState>(key: K, value: DroneState[K]): void {
    this.droneEngine.onParameterChange(key, value);
  }
  setMotif1Param<K extends keyof MotifState>(key: K, value: MotifState[K]): void {
    this.motif1Engine.onParameterChange(key, value);
  }
  setMotif2Param<K extends keyof MotifState>(key: K, value: MotifState[K]): void {
    this.motif2Engine.onParameterChange(key, value);
  }

  // -- MIDI routing -------------------------------------------------------

  getPartConfig(part: PartName): Readonly<PartMidiConfig> {
    return this.partConfigs[part];
  }

  /**
   * Reroute a part to a new MIDI destination. Any notes still held by the
   * part on the *old* destination are flushed through NoteTracker first so
   * they don't become orphaned.
   */
  setPartConfig(part: PartName, config: PartMidiConfig): void {
    const prev = this.partConfigs[part];
    if (prev.portId === config.portId && prev.channel === config.channel) return;
    this.noteTracker.releasePart(part);
    this.partConfigs = { ...this.partConfigs, [part]: { ...config } };
  }

  // -- transport ----------------------------------------------------------

  togglePart(part: PartName): void {
    this.transport.togglePart(part);
  }

  /**
   * Global play/pause. On play: reset the clock to before beat 1 and
   * restart — this also resyncs both motifs because `MotifEngine.start()`
   * zeros its internal counters. On pause: release everything.
   */
  toggleGlobalPlay(): void {
    const wasPlaying = this.transport.getState().globalPlaying;
    this.transport.toggleGlobalPlay();
    if (wasPlaying) {
      this.clock.stop();
      this.padEngine.stop();
      this.droneEngine.stop();
      this.motif1Engine.stop();
      this.motif2Engine.stop();
      this.noteTracker.releaseAll();
      this.barsPlayed = 0;
    } else {
      this.clock.stop(); // hard reset to pulseIndex = -1
      this.barsPlayed = 0;
      this.clock.play();
    }
  }

  /**
   * Panic: stop every engine, release every tracked note, and blast
   * CC 123 / 120 on every channel of every connected port.
   */
  panic(): void {
    this.clock.stop();
    this.transport.setGlobalPlay(false);
    this.padEngine.stop();
    this.droneEngine.stop();
    this.motif1Engine.stop();
    this.motif2Engine.stop();
    this.noteTracker.releaseAll();
    this.progressionEngine.stop();
    this.barsPlayed = 0;
    this.midi.panic();
  }

  // -- progression transport (independent from part transport) -----------

  /**
   * Start the chord progression. This implicitly starts the clock if it
   * isn't already running, because the progression needs a bar tick to
   * advance. Note: part transport is independent — pad/drone/motifs
   * only sound if they've been individually armed + globally played.
   */
  playProgression(): void {
    if (this.clock.state !== 'playing') {
      this.clock.stop();
      this.barsPlayed = 0;
      this.clock.play();
    }
    this.progressionEngine.play();
  }

  pauseProgression(): void {
    this.progressionEngine.pause();
  }

  /** Stop progression and reset to step 0. Does NOT stop the master clock. */
  stopProgression(): void {
    this.progressionEngine.stop();
  }
}

export { ALL_PARTS };
