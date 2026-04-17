import { describe, it, expect, beforeEach } from 'vitest';
import {
  PadEngine,
  getActiveNotes,
  strumDelayMs,
  type VoicedNote,
  type PadSink,
} from '../parts/pad';

// ---------------------------------------------------------------------------
// getActiveNotes — pure voicing selection
// ---------------------------------------------------------------------------

describe('getActiveNotes', () => {
  it('C Major I, position 60, range 3 → C4-E4-G4', () => {
    expect(getActiveNotes('C', 'Major', 1, 'Triad', 60, 3)).toEqual([60, 64, 67]);
  });

  it('moving position up an octave → C5-E5-G5', () => {
    expect(getActiveNotes('C', 'Major', 1, 'Triad', 72, 3)).toEqual([72, 76, 79]);
  });

  it('inverts as position moves between chord tones', () => {
    // Position 63 (between E4=64 and Eb4=63): lowest chord tone ≥ 63 is E4.
    // Voicing: E4-G4-C5 (first inversion).
    expect(getActiveNotes('C', 'Major', 1, 'Triad', 63, 3)).toEqual([64, 67, 72]);
    // Position 65: lowest ≥ 65 is G4 → G4-C5-E5 (second inversion).
    expect(getActiveNotes('C', 'Major', 1, 'Triad', 65, 3)).toEqual([67, 72, 76]);
  });

  it('degree V in C Major yields notes with {G, B, D} pitch classes', () => {
    const notes = getActiveNotes('C', 'Major', 5, 'Triad', 60, 3);
    expect(notes).toHaveLength(3);
    // G = 7, B = 11, D = 2
    expect(new Set(notes.map((n) => n % 12))).toEqual(new Set([7, 11, 2]));
  });

  it('range = 1 yields a single note', () => {
    expect(getActiveNotes('C', 'Major', 1, 'Triad', 60, 1)).toEqual([60]);
  });

  it('range = 6 spans approximately two octaves', () => {
    const notes = getActiveNotes('C', 'Major', 1, 'Triad', 60, 6);
    expect(notes).toHaveLength(6);
    const span = notes[5] - notes[0];
    // 6 diatonic triad tones ≈ 1.5 octaves at the low end, 2 at the high end.
    expect(span).toBeGreaterThanOrEqual(17);
    expect(span).toBeLessThanOrEqual(24);
  });

  it('range = 0 yields an empty array', () => {
    expect(getActiveNotes('C', 'Major', 1, 'Triad', 60, 0)).toEqual([]);
  });

  it('position above the top of the pool clamps into range', () => {
    // Position 127 is above the highest chord tone but we should still get
    // `range` notes by pulling the window down.
    const notes = getActiveNotes('C', 'Major', 1, 'Triad', 127, 3);
    expect(notes).toHaveLength(3);
    expect(new Set(notes.map((n) => n % 12))).toEqual(new Set([0, 4, 7]));
  });
});

// ---------------------------------------------------------------------------
// strumDelayMs
// ---------------------------------------------------------------------------

describe('strumDelayMs', () => {
  it('strum = 1 is simultaneous', () => {
    expect(strumDelayMs(1, 120)).toBe(0);
  });

  it('strum values 2–7 are strictly increasing', () => {
    const delays = [2, 3, 4, 5, 6, 7].map((s) => strumDelayMs(s, 120));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('scales inversely with BPM', () => {
    expect(strumDelayMs(3, 60)).toBeCloseTo(2 * strumDelayMs(3, 120), 10);
  });
});

// ---------------------------------------------------------------------------
// PadEngine — stateful behaviour
// ---------------------------------------------------------------------------

class RecordingSink implements PadSink {
  voicings: VoicedNote[][] = [];
  applyVoicing(voicing: VoicedNote[]): void {
    this.voicings.push(voicing);
  }
  clear(): void {
    this.voicings = [];
  }
  get last(): VoicedNote[] {
    return this.voicings[this.voicings.length - 1];
  }
}

function makeEngine() {
  const sink = new RecordingSink();
  const engine = new PadEngine({
    sink,
    getBpm: () => 120,
    initialState: { position: 60, range: 3, strum: 1, velocity: 100, isPlaying: false },
  });
  return { engine, sink };
}

describe('PadEngine', () => {
  let engine: PadEngine;
  let sink: RecordingSink;

  beforeEach(() => {
    ({ engine, sink } = makeEngine());
  });

  it('does nothing while stopped', () => {
    engine.onChordChange(5);
    engine.onParameterChange('range', 4);
    expect(sink.voicings).toHaveLength(0);
  });

  it('start() emits the initial voicing', () => {
    engine.start();
    expect(sink.voicings).toHaveLength(1);
    expect(sink.last.map((v) => v.note)).toEqual([60, 64, 67]);
    expect(sink.last.every((v) => v.velocity === 100)).toBe(true);
    expect(sink.last.every((v) => v.delayMs === 0)).toBe(true);
  });

  it('chord change emits a new voicing with the new chord tones', () => {
    engine.start();
    sink.clear();
    engine.onChordChange(5); // V in C Major = G-B-D
    expect(sink.voicings).toHaveLength(1);
    const pcs = new Set(sink.last.map((v) => v.note % 12));
    expect(pcs).toEqual(new Set([7, 11, 2]));
  });

  it('range change emits a longer voicing', () => {
    engine.start();
    sink.clear();
    engine.onParameterChange('range', 5);
    expect(sink.last).toHaveLength(5);
  });

  it('setting a parameter to the same value is a no-op', () => {
    engine.start();
    sink.clear();
    engine.onParameterChange('velocity', 100);
    expect(sink.voicings).toHaveLength(0);
  });

  it('stop() emits an empty voicing and clears the current chord', () => {
    engine.start();
    sink.clear();
    engine.stop();
    expect(sink.voicings).toEqual([[]]);
    expect(engine.getCurrentVoicing()).toEqual([]);
  });

  it('stop() is a no-op when nothing is currently voiced', () => {
    engine.stop(); // already stopped
    expect(sink.voicings).toHaveLength(0);
  });

  it('resuming play after stop re-emits the voicing', () => {
    engine.start();
    engine.stop();
    sink.clear();
    engine.start();
    expect(sink.voicings).toHaveLength(1);
    expect(sink.last.map((v) => v.note)).toEqual([60, 64, 67]);
  });
});

describe('PadEngine — strum', () => {
  it('strum > 1 stamps each note with an increasing delayMs', () => {
    const sink = new RecordingSink();
    const engine = new PadEngine({
      sink,
      getBpm: () => 120,
      initialState: { position: 60, range: 3, strum: 3, isPlaying: false },
    });
    engine.start();

    const delays = sink.last.map((v) => v.delayMs);
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeGreaterThan(0);
    expect(delays[2]).toBeGreaterThan(delays[1]);
    // Each successive note is offset by the same strum interval.
    expect(delays[2] - delays[1]).toBeCloseTo(delays[1] - delays[0], 10);
  });
});
