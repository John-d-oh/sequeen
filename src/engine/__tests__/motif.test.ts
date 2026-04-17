import { describe, it, expect, beforeEach } from 'vitest';
import {
  MotifEngine,
  variationStep,
  pulsesPerDivide,
  type MotifRhythmBeat,
  type MotifSink,
  type MotifState,
} from '../parts/motif';
import { PRESET_PATTERNS } from '../../data/presetPatterns';
import { PRESET_RHYTHMS } from '../../data/presetRhythms';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type NoteEvent =
  | { kind: 'on'; note: number; velocity: number }
  | { kind: 'off'; note: number };

class RecordingSink implements MotifSink {
  events: NoteEvent[] = [];
  noteOn(note: number, velocity: number) {
    this.events.push({ kind: 'on', note, velocity });
  }
  noteOff(note: number) {
    this.events.push({ kind: 'off', note });
  }
  clear() {
    this.events = [];
  }
  get ons(): Array<{ note: number; velocity: number }> {
    return this.events
      .filter((e): e is Extract<NoteEvent, { kind: 'on' }> => e.kind === 'on')
      .map(({ note, velocity }) => ({ note, velocity }));
  }
  get onNotes(): number[] {
    return this.ons.map((e) => e.note);
  }
}

const N = (velocity = 100): MotifRhythmBeat => ({ type: 'note', velocity });
const R = (): MotifRhythmBeat => ({ type: 'rest', velocity: 0 });
const T = (): MotifRhythmBeat => ({ type: 'tie', velocity: 0 });

/** Pad rhythm to 32 entries with rests (inactive slots past `length`). */
function rhythm32(beats: MotifRhythmBeat[]): MotifRhythmBeat[] {
  const out = beats.slice();
  while (out.length < 32) out.push(R());
  return out;
}

/** Pad pattern to 16 entries with 1s. */
function pattern16(values: number[]): number[] {
  const out = values.slice();
  while (out.length < 16) out.push(1);
  return out;
}

/**
 * Build a motif that reads from the chromatic pool starting at MIDI 60, so
 * note output is trivially predictable: pattern value `v` plays MIDI `60 + v - 1`.
 */
function makeChromaticMotif(overrides: Partial<MotifState> = {}) {
  const sink = new RecordingSink();
  const engine = new MotifEngine({
    sink,
    initialState: {
      position: 60,
      patternType: 'chromatic',
      patternLength: 4,
      pattern: pattern16([1, 2, 3, 4]),
      rhythmLength: 1,
      rhythm: rhythm32([N()]),
      variation: 'forward',
      clockDivide: '1/8',
      accent: 'rhythm',
      velocity: 100,
      ...overrides,
    },
  });
  return { engine, sink };
}

function ticks(engine: MotifEngine, n: number): void {
  for (let i = 0; i < n; i++) engine.tick();
}

// ---------------------------------------------------------------------------
// variationStep — pure
// ---------------------------------------------------------------------------

describe('variationStep', () => {
  it('forward: 0,1,2,3,0,1,2,3,…', () => {
    const seq = Array.from({ length: 9 }, (_, k) => variationStep('forward', 4, k));
    expect(seq).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
  });

  it('backward: 3,2,1,0,3,2,1,0,…', () => {
    const seq = Array.from({ length: 9 }, (_, k) => variationStep('backward', 4, k));
    expect(seq).toEqual([3, 2, 1, 0, 3, 2, 1, 0, 3]);
  });

  it('pingpong (no repeat): 0,1,2,3,2,1 | 0,1,…', () => {
    const seq = Array.from({ length: 10 }, (_, k) => variationStep('pingpong', 4, k));
    expect(seq).toEqual([0, 1, 2, 3, 2, 1, 0, 1, 2, 3]);
  });

  it('pingpong_repeat: endpoints played twice per cycle', () => {
    const seq = Array.from({ length: 10 }, (_, k) => variationStep('pingpong_repeat', 4, k));
    expect(seq).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 0, 1]);
  });

  it('odd_even for L=4: 0,2,1,3', () => {
    const seq = Array.from({ length: 8 }, (_, k) => variationStep('odd_even', 4, k));
    expect(seq).toEqual([0, 2, 1, 3, 0, 2, 1, 3]);
  });

  it('odd_even for L=5 (odd length): 0,2,4,1,3', () => {
    const seq = Array.from({ length: 5 }, (_, k) => variationStep('odd_even', 5, k));
    expect(seq).toEqual([0, 2, 4, 1, 3]);
  });

  it('random stays within [0, length)', () => {
    const rng = () => 0.99;
    for (let k = 0; k < 20; k++) {
      expect(variationStep('random', 4, k, rng)).toBeGreaterThanOrEqual(0);
      expect(variationStep('random', 4, k, rng)).toBeLessThan(4);
    }
  });

  it('length 1 always returns 0', () => {
    for (const variation of ['forward', 'backward', 'pingpong', 'pingpong_repeat', 'odd_even'] as const) {
      for (let k = 0; k < 5; k++) {
        expect(variationStep(variation, 1, k)).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// pulsesPerDivide
// ---------------------------------------------------------------------------

describe('pulsesPerDivide', () => {
  it('matches the spec table', () => {
    expect(pulsesPerDivide('1/1')).toBe(24);
    expect(pulsesPerDivide('1/2')).toBe(12);
    expect(pulsesPerDivide('1/4')).toBe(6);
    expect(pulsesPerDivide('1/8')).toBe(3);
    expect(pulsesPerDivide('1/4T')).toBe(4);
    expect(pulsesPerDivide('1/8T')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — variations
// ---------------------------------------------------------------------------

describe('MotifEngine — variation ordering (chromatic, note-only rhythm)', () => {
  it('forward plays pattern values in order', () => {
    const { engine, sink } = makeChromaticMotif({ variation: 'forward' });
    engine.start();
    ticks(engine, 8);
    expect(sink.onNotes).toEqual([60, 61, 62, 63, 60, 61, 62, 63]);
  });

  it('backward plays in reverse', () => {
    const { engine, sink } = makeChromaticMotif({ variation: 'backward' });
    engine.start();
    ticks(engine, 8);
    expect(sink.onNotes).toEqual([63, 62, 61, 60, 63, 62, 61, 60]);
  });

  it('pingpong reverses at the boundaries', () => {
    const { engine, sink } = makeChromaticMotif({ variation: 'pingpong' });
    engine.start();
    ticks(engine, 10);
    expect(sink.onNotes).toEqual([60, 61, 62, 63, 62, 61, 60, 61, 62, 63]);
  });

  it('pingpong_repeat holds endpoints for one extra step', () => {
    const { engine, sink } = makeChromaticMotif({ variation: 'pingpong_repeat' });
    engine.start();
    ticks(engine, 10);
    expect(sink.onNotes).toEqual([60, 61, 62, 63, 63, 62, 61, 60, 60, 61]);
  });

  it('odd_even plays odd indices then even indices', () => {
    const { engine, sink } = makeChromaticMotif({ variation: 'odd_even' });
    engine.start();
    ticks(engine, 8);
    // indices 0,2,1,3 → pattern values 1,3,2,4 → notes 60,62,61,63
    expect(sink.onNotes).toEqual([60, 62, 61, 63, 60, 62, 61, 63]);
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — rhythm semantics (rest, tie)
// ---------------------------------------------------------------------------

describe('MotifEngine — rhythm: rests', () => {
  it('REST does not advance the pattern index', () => {
    // pattern length 3: [1,2,3]; rhythm [N, R, N, N, R] length 5
    const { engine, sink } = makeChromaticMotif({
      patternLength: 3,
      pattern: pattern16([1, 2, 3]),
      rhythmLength: 5,
      rhythm: rhythm32([N(), R(), N(), N(), R()]),
    });
    engine.start();
    ticks(engine, 5);

    // Note events at ticks 1,3,4 → k = 0,1,2 → pattern[0,1,2] → 60,61,62.
    // Crucially, k does NOT advance on the rest at tick 2 — if it did, we'd
    // have skipped 61 and seen [60, 62, 60] instead.
    expect(sink.onNotes).toEqual([60, 61, 62]);

    // Every note is released exactly once: 60 by the rest at tick 2, 61 by
    // the new NoteOn at tick 4, 62 by the rest at tick 5.
    const offs = sink.events.filter((e) => e.kind === 'off').map((e) => e.note);
    expect(offs).toEqual([60, 61, 62]);
  });
});

describe('MotifEngine — rhythm: ties', () => {
  it('TIE holds the previous note without emitting anything', () => {
    const { engine, sink } = makeChromaticMotif({
      patternLength: 3,
      pattern: pattern16([1, 2, 3]),
      rhythmLength: 4,
      rhythm: rhythm32([N(), T(), T(), N()]),
    });
    engine.start();
    // Ticks 1..4: note → tie → tie → note
    engine.tick();
    expect(sink.onNotes).toEqual([60]);
    engine.tick();
    engine.tick();
    // Two ties in a row — still just the one NoteOn, no new off.
    expect(sink.events).toEqual([{ kind: 'on', note: 60, velocity: 100 }]);
    engine.tick();
    // Now a note: release the held 60 and play the next (61).
    expect(sink.events).toEqual([
      { kind: 'on', note: 60, velocity: 100 },
      { kind: 'off', note: 60 },
      { kind: 'on', note: 61, velocity: 100 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — monophonic discipline
// ---------------------------------------------------------------------------

describe('MotifEngine — monophonic NoteOff bookkeeping', () => {
  it('every non-first NoteOn is preceded by a NoteOff of the previous note', () => {
    const { engine, sink } = makeChromaticMotif();
    engine.start();
    ticks(engine, 6);

    // Walk the event stream and assert each On is preceded by an Off for the prior held note.
    let held: number | null = null;
    for (const e of sink.events) {
      if (e.kind === 'on') {
        // If something was held, the last event must have been an off for it.
        if (held !== null) {
          const prev = sink.events[sink.events.indexOf(e) - 1];
          expect(prev).toEqual({ kind: 'off', note: held });
        }
        held = e.note;
      } else {
        expect(held).toBe(e.note);
        held = null;
      }
    }
  });

  it('stop() releases any held note', () => {
    const { engine, sink } = makeChromaticMotif();
    engine.start();
    engine.tick();
    expect(sink.onNotes).toEqual([60]);
    engine.stop();
    expect(sink.events[sink.events.length - 1]).toEqual({ kind: 'off', note: 60 });
    expect(engine.getCurrentNote()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — clock divide
// ---------------------------------------------------------------------------

describe('MotifEngine — clock divide', () => {
  it("'1/4' fires one motif tick per 6 clock pulses", () => {
    const { engine, sink } = makeChromaticMotif({ clockDivide: '1/4' });
    engine.start();
    // 24 pulses → 4 ticks (pulse indices 0, 6, 12, 18)
    for (let i = 0; i < 24; i++) engine.onPulse();
    expect(sink.onNotes).toHaveLength(4);
  });

  it("'1/8' fires one motif tick per 3 clock pulses", () => {
    const { engine, sink } = makeChromaticMotif({ clockDivide: '1/8' });
    engine.start();
    for (let i = 0; i < 12; i++) engine.onPulse();
    expect(sink.onNotes).toHaveLength(4);
  });

  it("'1/8T' fires one motif tick per 2 clock pulses (triplet)", () => {
    const { engine, sink } = makeChromaticMotif({ clockDivide: '1/8T' });
    engine.start();
    for (let i = 0; i < 8; i++) engine.onPulse();
    expect(sink.onNotes).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — chord changes
// ---------------------------------------------------------------------------

describe('MotifEngine — chord changes', () => {
  it("'chord' patternType uses the new chord pool after onChordChange", () => {
    const sink = new RecordingSink();
    const engine = new MotifEngine({
      sink,
      initialState: {
        position: 0, // start at the lowest chord tone
        patternType: 'chord',
        patternLength: 3,
        pattern: pattern16([1, 2, 3]),
        rhythmLength: 1,
        rhythm: rhythm32([N()]),
        variation: 'forward',
      },
      initialContext: { key: 'C', mode: 'Major', degree: 1, chordType: 'Triad' },
    });
    engine.start();
    // C Major I chord pool (ascending MIDI notes with PCs {0,4,7}):
    // 0, 4, 7, 12, 16, 19, … → pool[0..2] = [0, 4, 7]
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([0, 4, 7]);

    // Switch to V (G-B-D, PCs {7,11,2}) — pool: 2,7,11,14,19,23,… → pool[0..2] = [2,7,11]
    engine.onChordChange(5);
    sink.clear();
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([2, 7, 11]);
  });

  it("'scale' patternType ignores chord changes (pool does not depend on degree)", () => {
    const sink = new RecordingSink();
    const engine = new MotifEngine({
      sink,
      initialState: {
        position: 0,
        patternType: 'scale',
        patternLength: 3,
        pattern: pattern16([1, 2, 3]),
        rhythmLength: 1,
        rhythm: rhythm32([N()]),
        variation: 'forward',
      },
      initialContext: { key: 'C', mode: 'Major', degree: 1, chordType: 'Triad' },
    });
    engine.start();
    // C Major scale pool starts at 0: 0, 2, 4, 5, 7, 9, 11, 12, …
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([0, 2, 4]);

    // Change degree — scale pool should stay put; same notes should play.
    engine.onChordChange(5);
    sink.clear();
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([0, 2, 4]);
  });

  it("'chromatic' patternType is degree-independent", () => {
    const { engine, sink } = makeChromaticMotif({
      patternLength: 3,
      pattern: pattern16([1, 2, 3]),
    });
    engine.start();
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([60, 61, 62]);
    engine.onChordChange(4);
    sink.clear();
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([60, 61, 62]);
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — polymetric behaviour
// ---------------------------------------------------------------------------

describe('MotifEngine — polymetric pattern vs rhythm lengths', () => {
  it('pattern cycles at patternLength; rhythm cycles at rhythmLength; k only advances on notes', () => {
    // pattern length 3 vs rhythm length 5 with a rest mid-rhythm:
    //   rhythm: [N, N, R, N, N]    (length 5)
    //   pattern: [1, 2, 3]          (length 3)
    //
    // Over 10 ticks, note events occur at rhythm beats 0,1,3,4,5,6,8,9.
    // That's 8 note events, with k = 0..7 → pattern steps 0,1,2,0,1,2,0,1.
    // pos=60, chromatic → notes 60,61,62,60,61,62,60,61.
    const { engine, sink } = makeChromaticMotif({
      patternLength: 3,
      pattern: pattern16([1, 2, 3]),
      rhythmLength: 5,
      rhythm: rhythm32([N(), N(), R(), N(), N()]),
    });
    engine.start();
    ticks(engine, 10);
    expect(sink.onNotes).toEqual([60, 61, 62, 60, 61, 62, 60, 61]);
  });
});

// ---------------------------------------------------------------------------
// MotifEngine — accent
// ---------------------------------------------------------------------------

describe('MotifEngine — accent modes', () => {
  it("'rhythm' accent uses the per-beat velocity from the rhythm", () => {
    const { engine, sink } = makeChromaticMotif({
      accent: 'rhythm',
      rhythmLength: 2,
      rhythm: rhythm32([N(127), N(50)]),
    });
    engine.start();
    ticks(engine, 4);
    expect(sink.ons.map((e) => e.velocity)).toEqual([127, 50, 127, 50]);
  });

  it("'motif' accent uses the fixed motif velocity regardless of the rhythm beat", () => {
    const { engine, sink } = makeChromaticMotif({
      accent: 'motif',
      velocity: 77,
      rhythmLength: 2,
      rhythm: rhythm32([N(127), N(50)]),
    });
    engine.start();
    ticks(engine, 4);
    expect(sink.ons.every((e) => e.velocity === 77)).toBe(true);
  });

  it("'humanized' accent jitters around the rhythm velocity (deterministic RNG)", () => {
    const sink = new RecordingSink();
    // Seeded random: always 0.5 → jitter = 0. 0.0 → -amount; 1.0 → +amount.
    const fakeRandom = () => 0.5;
    const engine = new MotifEngine({
      sink,
      random: fakeRandom,
      initialState: {
        position: 60,
        patternType: 'chromatic',
        patternLength: 1,
        pattern: pattern16([1]),
        rhythmLength: 1,
        rhythm: rhythm32([N(100)]),
        variation: 'forward',
        accent: 'humanized',
        humanizeAmount: 20,
      },
    });
    engine.start();
    engine.tick();
    // random()==0.5 means zero jitter, so velocity stays at 100.
    expect(sink.ons[0].velocity).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Preset data
// ---------------------------------------------------------------------------

describe('preset data', () => {
  it('every preset pattern has 16 entries and a valid length', () => {
    expect(PRESET_PATTERNS.length).toBeGreaterThanOrEqual(5);
    for (const p of PRESET_PATTERNS) {
      expect(p.pattern).toHaveLength(16);
      expect(p.length).toBeGreaterThanOrEqual(1);
      expect(p.length).toBeLessThanOrEqual(16);
      for (const v of p.pattern) expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it('every preset rhythm has 32 entries and a valid length', () => {
    expect(PRESET_RHYTHMS.length).toBeGreaterThanOrEqual(5);
    for (const r of PRESET_RHYTHMS) {
      expect(r.rhythm).toHaveLength(32);
      expect(r.length).toBeGreaterThanOrEqual(1);
      expect(r.length).toBeLessThanOrEqual(32);
    }
  });

  it('Rhythm 3 (eighths with rests on 2 & 4) has the expected shape', () => {
    const r = PRESET_RHYTHMS[2];
    const types = r.rhythm.slice(0, r.length).map((b) => b.type);
    expect(types).toEqual(['note', 'note', 'rest', 'note', 'note', 'note', 'rest', 'note']);
  });

  it('preset patterns can drive a motif without errors', () => {
    const ascending = PRESET_PATTERNS[0];
    const { engine, sink } = makeChromaticMotif({
      pattern: ascending.pattern,
      patternLength: ascending.length,
    });
    engine.start();
    ticks(engine, 8);
    // Chromatic pool at pos 60: values 1..8 → notes 60..67
    expect(sink.onNotes).toEqual([60, 61, 62, 63, 64, 65, 66, 67]);
  });
});

// ---------------------------------------------------------------------------
// Sanity: start() resets counters
// ---------------------------------------------------------------------------

describe('MotifEngine — start() resets sequence state', () => {
  it('re-starts the pattern and rhythm from their first step', () => {
    const { engine, sink } = makeChromaticMotif();
    engine.start();
    ticks(engine, 3); // k=0,1,2 → notes 60,61,62
    engine.stop();
    sink.clear();
    engine.start();
    ticks(engine, 3);
    expect(sink.onNotes).toEqual([60, 61, 62]);
  });
});

// Silence unused-import lint for beforeEach (kept for parity with other suites).
void beforeEach;
