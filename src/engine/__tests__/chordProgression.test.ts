import { describe, it, expect } from 'vitest';
import {
  ChordProgressionEngine,
  isValidProgression,
  totalBars,
  type ChordProgression,
  type ChordProgressionStep,
} from '../chordProgression';
import {
  PRESET_PROGRESSIONS,
  PROGRESSION_GENRES,
  presetsByGenre,
} from '../../data/presetProgressions';
import { SequeenEngine, type SequeenMidiManager } from '../SequeenEngine';
import type { Scheduler } from '../clock';

// ---------------------------------------------------------------------------
// Recording MIDI manager + harness shared with the existing integration suite
// ---------------------------------------------------------------------------

type MidiEvent =
  | { kind: 'on'; portId: string; channel: number; note: number; velocity: number }
  | { kind: 'off'; portId: string; channel: number; note: number }
  | { kind: 'allOff'; portId: string; channel: number }
  | { kind: 'panic' };

class RecordingMidiManager implements SequeenMidiManager {
  events: MidiEvent[] = [];
  sendNoteOn(portId: string, channel: number, note: number, velocity: number): void {
    this.events.push({ kind: 'on', portId, channel, note, velocity });
  }
  sendNoteOff(portId: string, channel: number, note: number): void {
    this.events.push({ kind: 'off', portId, channel, note });
  }
  sendAllNotesOff(portId: string, channel: number): void {
    this.events.push({ kind: 'allOff', portId, channel });
  }
  panic(): void {
    this.events.push({ kind: 'panic' });
  }
  clear(): void {
    this.events = [];
  }
  get ons() {
    return this.events.filter((e): e is Extract<MidiEvent, { kind: 'on' }> => e.kind === 'on');
  }
}

function seqHarness() {
  let t = 0;
  let tick: (() => void) | null = null;
  const scheduler: Scheduler = {
    start(cb) {
      tick = cb;
    },
    stop() {
      tick = null;
    },
  };
  const midi = new RecordingMidiManager();
  const seq = new SequeenEngine({
    midiManager: midi,
    clockScheduler: scheduler,
    clockNow: () => t,
  });
  return {
    seq,
    midi,
    advance(ms: number) {
      t += ms;
      tick?.();
    },
    setTime(v: number) {
      t = v;
      tick?.();
    },
    /** Advance `n` clock pulses' worth of virtual time (one tick per pulse). */
    runPulses(n: number) {
      const pulseDur = seq.clock.pulseDurationMs;
      for (let i = 0; i < n; i++) {
        t += pulseDur;
        tick?.();
      }
    },
    /** Advance exactly `n` bars (96 pulses each at 24 PPQ, 4 beats/bar). */
    runBars(n: number) {
      this.runPulses(n * 96);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function step(
  degree: number,
  bars = 1,
  alteration = 0,
  quality: ChordProgressionStep['quality'] = 'auto',
  chordType: ChordProgressionStep['chordType'] = 'Triad',
): ChordProgressionStep {
  return { degree, alteration, quality, chordType, bars };
}

function makeProgression(
  degrees: ChordProgressionStep[],
  overrides: Partial<ChordProgression> = {},
): ChordProgression {
  return {
    id: 'test',
    name: 'Test',
    genre: 'Test',
    degrees,
    description: '',
    ...overrides,
  };
}

function standaloneEngine() {
  const emitted: ChordProgressionStep[] = [];
  const engine = new ChordProgressionEngine({
    onStep: (s) => emitted.push(s),
  });
  return { engine, emitted };
}

// ---------------------------------------------------------------------------
// ChordProgressionEngine — unit tests
// ---------------------------------------------------------------------------

describe('ChordProgressionEngine — transport', () => {
  it('play emits the first step immediately', () => {
    const { engine, emitted } = standaloneEngine();
    engine.load(makeProgression([step(1), step(4), step(5)]));
    engine.play();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].degree).toBe(1);
    expect(engine.getSnapshot().isPlaying).toBe(true);
    expect(engine.getSnapshot().currentStepIdx).toBe(0);
    expect(engine.getSnapshot().barInStep).toBe(1);
  });

  it('stop resets to step 0', () => {
    const { engine, emitted } = standaloneEngine();
    engine.load(makeProgression([step(1, 2), step(4, 2), step(5, 2), step(1, 2)]));
    engine.play();
    engine.onBarComplete();
    engine.onBarComplete();
    expect(engine.getCurrentStep()).toBe(1);
    engine.stop();
    expect(engine.getCurrentStep()).toBe(0);
    expect(engine.getSnapshot().isPlaying).toBe(false);
    // stop() shouldn't emit a fresh chord event on its own.
    const count = emitted.length;
    engine.onBarComplete(); // no-op while stopped
    expect(emitted).toHaveLength(count);
  });

  it('pause preserves position', () => {
    const { engine } = standaloneEngine();
    engine.load(makeProgression([step(1, 2), step(4, 2)]));
    engine.play();
    engine.onBarComplete(); // 1 bar into step 0
    engine.pause();
    expect(engine.getSnapshot().isPlaying).toBe(false);
    expect(engine.getCurrentStep()).toBe(0);
    expect(engine.getSnapshot().barInStep).toBe(2);
    // Bar boundaries while paused are ignored.
    engine.onBarComplete();
    engine.onBarComplete();
    expect(engine.getCurrentStep()).toBe(0);
  });
});

describe('ChordProgressionEngine — uniform 2-bar steps', () => {
  it('I(2b) IV(2b) V(2b) I(2b) advances every 2 bars and loops', () => {
    const { engine, emitted } = standaloneEngine();
    engine.load(
      makeProgression([step(1, 2), step(4, 2), step(5, 2), step(1, 2)]),
    );
    engine.play();

    // Initial step 0
    expect(emitted.map((s) => s.degree)).toEqual([1]);
    engine.onBarComplete(); // 1 bar done, still on step 0
    expect(engine.getCurrentStep()).toBe(0);
    engine.onBarComplete(); // 2nd bar done → advance
    expect(engine.getCurrentStep()).toBe(1);
    expect(emitted.map((s) => s.degree)).toEqual([1, 4]);

    engine.onBarComplete();
    engine.onBarComplete(); // step 2
    expect(emitted.map((s) => s.degree)).toEqual([1, 4, 5]);

    engine.onBarComplete();
    engine.onBarComplete(); // step 3
    expect(emitted.map((s) => s.degree)).toEqual([1, 4, 5, 1]);

    // Loop back
    engine.onBarComplete();
    engine.onBarComplete();
    expect(emitted.map((s) => s.degree)).toEqual([1, 4, 5, 1, 1]);
    expect(engine.getCurrentStep()).toBe(0);
  });
});

describe('ChordProgressionEngine — asymmetric bar counts', () => {
  it('3b + 1b + 3b + 1b advances at the right moments', () => {
    const { engine, emitted } = standaloneEngine();
    engine.load(makeProgression([step(1, 3), step(4, 1), step(5, 3), step(1, 1)]));
    engine.play();

    // bar 1-3: step 0
    engine.onBarComplete(); // end of bar 1
    engine.onBarComplete(); // end of bar 2
    expect(engine.getCurrentStep()).toBe(0);
    engine.onBarComplete(); // end of bar 3 → advance
    expect(engine.getCurrentStep()).toBe(1);

    // bar 4: step 1 (1 bar)
    engine.onBarComplete(); // advance
    expect(engine.getCurrentStep()).toBe(2);

    // bars 5-7: step 2 (3 bars)
    engine.onBarComplete();
    engine.onBarComplete();
    expect(engine.getCurrentStep()).toBe(2);
    engine.onBarComplete();
    expect(engine.getCurrentStep()).toBe(3);

    // bar 8: step 3 → loop to 0
    engine.onBarComplete();
    expect(engine.getCurrentStep()).toBe(0);
    expect(emitted.map((s) => s.degree)).toEqual([1, 4, 5, 1, 1]);
  });
});

describe('ChordProgressionEngine — loop vs one-shot', () => {
  it('loop mode wraps back to step 0 after the last step', () => {
    const { engine } = standaloneEngine();
    engine.load(makeProgression([step(1, 1), step(4, 1)]));
    engine.play();
    engine.onBarComplete(); // step 0 → 1
    engine.onBarComplete(); // step 1 → loop to 0
    expect(engine.getCurrentStep()).toBe(0);
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it('one-shot mode stops and holds the last chord', () => {
    const { engine, emitted } = standaloneEngine();
    engine.load(makeProgression([step(1, 1), step(4, 1), step(5, 1)]));
    engine.setLoop(false);
    engine.play();
    engine.onBarComplete(); // 0 → 1
    engine.onBarComplete(); // 1 → 2
    engine.onBarComplete(); // 2 → should halt, not advance
    expect(engine.getSnapshot().isPlaying).toBe(false);
    // Last emission should still be the final chord (degree 5).
    expect(emitted[emitted.length - 1].degree).toBe(5);
    // Further bars are ignored.
    engine.onBarComplete();
    engine.onBarComplete();
    expect(emitted[emitted.length - 1].degree).toBe(5);
  });
});

describe('ChordProgressionEngine — live editing', () => {
  it('updateStep mid-playback takes effect on the next cycle', () => {
    const { engine, emitted } = standaloneEngine();
    engine.load(makeProgression([step(1, 1), step(4, 1)]));
    engine.play(); // emits I
    engine.onBarComplete(); // 0 → 1, emits IV
    expect(emitted.map((s) => s.degree)).toEqual([1, 4]);

    // Live edit: change step 0 (currently not playing) to V.
    engine.updateStep(0, { degree: 5 });
    // The *playing* step is unchanged until we cycle back to step 0.
    engine.onBarComplete(); // 1 → loop to 0, now emits the edited step
    expect(emitted.map((s) => s.degree)).toEqual([1, 4, 5]);
  });

  it('addStep and removeStep mutate the progression', () => {
    const { engine } = standaloneEngine();
    engine.load(makeProgression([step(1, 1), step(4, 1)]));
    engine.addStep();
    expect(engine.getProgression()!.degrees).toHaveLength(3);
    engine.removeStep(1);
    expect(engine.getProgression()!.degrees).toHaveLength(2);
    expect(engine.getProgression()!.degrees[0].degree).toBe(1);
  });

  it('addStep caps at 8 steps', () => {
    const { engine } = standaloneEngine();
    engine.load(makeProgression(Array.from({ length: 8 }, () => step(1, 1))));
    engine.addStep();
    expect(engine.getProgression()!.degrees).toHaveLength(8);
  });

  it('removeStep will not drop the progression below 1 step', () => {
    const { engine } = standaloneEngine();
    engine.load(makeProgression([step(1, 1)]));
    engine.removeStep(0);
    expect(engine.getProgression()!.degrees).toHaveLength(1);
  });

  it('moveStep swaps neighbours', () => {
    const { engine } = standaloneEngine();
    engine.load(makeProgression([step(1, 1), step(4, 1), step(5, 1)]));
    engine.moveStep(0, 1);
    const degrees = engine.getProgression()!.degrees.map((d) => d.degree);
    expect(degrees).toEqual([4, 1, 5]);
  });
});

// ---------------------------------------------------------------------------
// Preset library
// ---------------------------------------------------------------------------

describe('preset progression library', () => {
  it('contains at least 66 presets', () => {
    expect(PRESET_PROGRESSIONS.length).toBeGreaterThanOrEqual(66);
  });

  it('every preset has a unique id', () => {
    const seen = new Set<string>();
    for (const p of PRESET_PROGRESSIONS) {
      expect(seen.has(p.id)).toBe(false);
      seen.add(p.id);
    }
  });

  it('every preset has 1-8 steps with valid degrees (1-7)', () => {
    for (const p of PRESET_PROGRESSIONS) {
      expect(isValidProgression(p)).toBe(true);
      expect(p.degrees.length).toBeGreaterThanOrEqual(1);
      expect(p.degrees.length).toBeLessThanOrEqual(8);
      for (const step of p.degrees) {
        expect(step.degree).toBeGreaterThanOrEqual(1);
        expect(step.degree).toBeLessThanOrEqual(7);
      }
    }
  });

  it('every preset totals 7 or 8 bars', () => {
    for (const p of PRESET_PROGRESSIONS) {
      const total = totalBars(p);
      expect(total, `${p.name} (${p.id}) totaled ${total} bars`).toBeGreaterThanOrEqual(7);
      expect(total, `${p.name} (${p.id}) totaled ${total} bars`).toBeLessThanOrEqual(8);
    }
  });

  it('presets are assigned to the 8 declared genres only', () => {
    const allowed = new Set<string>(PROGRESSION_GENRES);
    for (const p of PRESET_PROGRESSIONS) {
      expect(allowed.has(p.genre)).toBe(true);
    }
  });

  it('presetsByGenre groups into non-empty buckets for every genre', () => {
    const grouped = presetsByGenre();
    for (const g of PROGRESSION_GENRES) {
      expect(grouped[g].length).toBeGreaterThan(0);
    }
  });

  it('borrowed-chord presets encode their alteration and quality correctly', () => {
    const deepDusk = PRESET_PROGRESSIONS.find((p) => p.id === 'deep-dusk')!;
    expect(deepDusk).toBeDefined();
    // "i(2b), bVI(major), bIII(major)(2b), bVII(major), bVI(major), i"
    const alts = deepDusk.degrees.map((s) => s.alteration);
    expect(alts).toEqual([0, -1, -1, -1, -1, 0]);
    // borrowed chords use explicit 'major' quality, diatonic use 'auto'
    const qualities = deepDusk.degrees.map((s) => s.quality);
    expect(qualities).toEqual(['auto', 'major', 'major', 'major', 'major', 'auto']);
  });

  it('Bach Circle of Fifths is a pure 8-bar diatonic cycle', () => {
    const p = PRESET_PROGRESSIONS.find((p) => p.id === 'bach-circle-of-fifths')!;
    expect(p.degrees.map((s) => s.degree)).toEqual([1, 4, 7, 3, 6, 2, 5, 1]);
    expect(p.degrees.every((s) => s.alteration === 0 && s.quality === 'auto')).toBe(true);
    expect(totalBars(p)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// SequeenEngine integration
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — chord progression', () => {
  it('bar-boundary events fire on bar 2, 3, … (not the very first downbeat)', () => {
    const h = seqHarness();
    let bars = 0;
    h.seq.onBar(() => bars++);
    h.seq.toggleGlobalPlay();
    // First pulse at t=0 = start of bar 1. No bar-boundary event yet.
    h.setTime(0);
    expect(bars).toBe(0);
    // After one full bar (96 pulses), bar 1 has completed → 1 event.
    h.runBars(1);
    expect(bars).toBe(1);
    h.runBars(3);
    expect(bars).toBe(4);
  });

  it('progression advances via the clock across bar boundaries', () => {
    const h = seqHarness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.progressionEngine.load(
      makeProgression([step(1, 2), step(4, 2), step(5, 2), step(1, 2)]),
    );

    h.seq.toggleGlobalPlay();
    h.seq.progressionEngine.play();
    h.setTime(0);

    // Step 0 (I) plays on bar 1. Pad voicing PCs should be {C, E, G} = {0, 4, 7}.
    const padPcs = () => new Set(h.seq.padEngine.getCurrentVoicing().map((n) => n % 12));
    expect(padPcs()).toEqual(new Set([0, 4, 7]));

    // Advance 2 bars → progression moves to step 1 (IV).
    h.runBars(2);
    expect(h.seq.progressionEngine.getCurrentStep()).toBe(1);
    // IV in C Major = F-A-C → {5, 9, 0}
    expect(padPcs()).toEqual(new Set([5, 9, 0]));

    // Another 2 bars → step 2 (V = G-B-D = {7, 11, 2}).
    h.runBars(2);
    expect(h.seq.progressionEngine.getCurrentStep()).toBe(2);
    expect(padPcs()).toEqual(new Set([7, 11, 2]));
  });

  it('borrowed bVII in a progression triggers Bb-D-F in the pad', () => {
    const h = seqHarness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');

    // I(1b), bVII major(1b)
    h.seq.progressionEngine.load(
      makeProgression([step(1, 1), step(7, 1, -1, 'major')]),
    );
    h.seq.toggleGlobalPlay();
    h.seq.progressionEngine.play();
    h.setTime(0);

    // Step 0 = I (C-E-G)
    const pcs = () => new Set(h.seq.padEngine.getCurrentVoicing().map((n) => n % 12));
    expect(pcs()).toEqual(new Set([0, 4, 7]));

    // Advance 1 bar → step 1 = bVII major (Bb-D-F = {10, 2, 5})
    h.runBars(1);
    expect(pcs()).toEqual(new Set([10, 2, 5]));
  });

  it('progression transport is independent from part transport', () => {
    const h = seqHarness();
    h.seq.progressionEngine.load(makeProgression([step(1, 1), step(4, 1)]));

    // Start progression WITHOUT touching global play or any part.
    h.seq.playProgression();
    h.setTime(0);

    // No parts should be playing.
    const ts = h.seq.transport.getState();
    expect(ts.globalPlaying).toBe(false);
    for (const status of Object.values(ts.parts)) {
      expect(status).toBe('stopped');
    }
    // But the progression engine should be running.
    expect(h.seq.progressionEngine.isPlaying()).toBe(true);
    // And the clock should have auto-started so bars can be counted.
    expect(h.seq.clock.state).toBe('playing');
  });

  it('stopProgression does not stop the clock or the parts', () => {
    const h = seqHarness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.seq.progressionEngine.load(makeProgression([step(1, 1), step(4, 1)]));
    h.seq.playProgression();
    h.setTime(0);

    h.seq.stopProgression();
    expect(h.seq.progressionEngine.isPlaying()).toBe(false);
    // Parts + clock still running because global play is on.
    expect(h.seq.clock.state).toBe('playing');
    expect(h.seq.transport.getState().globalPlaying).toBe(true);
  });
});
