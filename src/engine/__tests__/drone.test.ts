import { describe, it, expect, beforeEach } from 'vitest';
import {
  DroneEngine,
  getDroneNotes,
  cadenceFires,
  type DroneEvent,
  type DroneSink,
} from '../parts/drone';

// ---------------------------------------------------------------------------
// getDroneNotes — pure voicing selection
// ---------------------------------------------------------------------------

describe('getDroneNotes — root mode', () => {
  it('C Major, position 2, root only → [36] (C2)', () => {
    expect(getDroneNotes('C', 'Major', 1, 2, 'root', 'root')).toEqual([36]);
  });

  it("C Major, position 2, 'root+5th+oct' → [36, 43, 48] (C2, G2, C3)", () => {
    expect(getDroneNotes('C', 'Major', 1, 2, 'root+5th+oct', 'root')).toEqual([36, 43, 48]);
  });

  it("'root+oct' → [root, root+12]", () => {
    expect(getDroneNotes('C', 'Major', 1, 2, 'root+oct', 'root')).toEqual([36, 48]);
  });

  it("'root+5th' → [root, root+7]", () => {
    expect(getDroneNotes('C', 'Major', 1, 2, 'root+5th', 'root')).toEqual([36, 43]);
  });

  it('position 0 → C0 = 12, position 4 → C4 = 60', () => {
    expect(getDroneNotes('C', 'Major', 1, 0, 'root', 'root')).toEqual([12]);
    expect(getDroneNotes('C', 'Major', 1, 4, 'root', 'root')).toEqual([60]);
  });

  it('key F at position 2 → F2 = 41', () => {
    expect(getDroneNotes('F', 'Major', 1, 2, 'root', 'root')).toEqual([41]);
  });

  it('root mode IGNORES the degree', () => {
    const deg1 = getDroneNotes('C', 'Major', 1, 2, 'root', 'root');
    const deg4 = getDroneNotes('C', 'Major', 4, 2, 'root', 'root');
    const deg5 = getDroneNotes('C', 'Major', 5, 2, 'root', 'root');
    expect(deg1).toEqual(deg4);
    expect(deg1).toEqual(deg5);
  });
});

describe('getDroneNotes — chord mode', () => {
  it('degree IV in C Major → F as root (F2 = 41)', () => {
    expect(getDroneNotes('C', 'Major', 4, 2, 'root', 'chord')).toEqual([41]);
  });

  it('degree V in C Major → G as root (G2 = 43)', () => {
    expect(getDroneNotes('C', 'Major', 5, 2, 'root', 'chord')).toEqual([43]);
  });

  it('degree VI in C Major → A as root (A2 = 45)', () => {
    expect(getDroneNotes('C', 'Major', 6, 2, 'root', 'chord')).toEqual([45]);
  });

  it("chord mode with 'root+5th+oct' at degree IV → F2, C3, F3", () => {
    // F = 41; 41 + 7 = 48 (C3); 41 + 12 = 53 (F3)
    expect(getDroneNotes('C', 'Major', 4, 2, 'root+5th+oct', 'chord')).toEqual([41, 48, 53]);
  });
});

// ---------------------------------------------------------------------------
// cadenceFires
// ---------------------------------------------------------------------------

describe('cadenceFires', () => {
  it('cadence 0 never fires', () => {
    for (const b of [1, 2, 3, 4]) expect(cadenceFires(0, b)).toBe(false);
  });

  it('cadence 1 fires only on beat 1', () => {
    expect(cadenceFires(1, 1)).toBe(true);
    for (const b of [2, 3, 4]) expect(cadenceFires(1, b)).toBe(false);
  });

  it('cadence 2 fires on beats 1 and 2', () => {
    expect(cadenceFires(2, 1)).toBe(true);
    expect(cadenceFires(2, 2)).toBe(true);
    expect(cadenceFires(2, 3)).toBe(false);
    expect(cadenceFires(2, 4)).toBe(false);
  });

  it('cadence 4 fires on beats 2 and 4 (backbeat)', () => {
    expect(cadenceFires(4, 1)).toBe(false);
    expect(cadenceFires(4, 2)).toBe(true);
    expect(cadenceFires(4, 3)).toBe(false);
    expect(cadenceFires(4, 4)).toBe(true);
  });

  it('cadence 5 fires on every beat', () => {
    for (const b of [1, 2, 3, 4]) expect(cadenceFires(5, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DroneEngine — state machine
// ---------------------------------------------------------------------------

class RecordingSink implements DroneSink {
  events: DroneEvent[] = [];
  emit(e: DroneEvent): void {
    this.events.push(e);
  }
  clear(): void {
    this.events = [];
  }
  get last(): DroneEvent {
    return this.events[this.events.length - 1];
  }
}

function makeEngine(overrides: Partial<ConstructorParameters<typeof DroneEngine>[0]['initialState']> = {}) {
  const sink = new RecordingSink();
  const engine = new DroneEngine({
    sink,
    initialState: { position: 2, notes: 'root', triggerMode: 'root', cadence: 0, ...overrides },
  });
  return { engine, sink };
}

describe('DroneEngine — root trigger mode', () => {
  let engine: DroneEngine;
  let sink: RecordingSink;

  beforeEach(() => {
    ({ engine, sink } = makeEngine({ triggerMode: 'root' }));
  });

  it('start strikes the root note and stores current notes', () => {
    engine.start();
    expect(sink.events).toHaveLength(1);
    expect(sink.last).toEqual({ notes: [36], velocity: 100, restrike: true });
    expect(engine.getCurrentNotes()).toEqual([36]);
  });

  it('does NOT re-strike when the chord degree changes', () => {
    engine.start();
    sink.clear();
    engine.onChordChange(4);
    engine.onChordChange(5);
    engine.onChordChange(2);
    expect(sink.events).toHaveLength(0);
    expect(engine.getCurrentNotes()).toEqual([36]);
  });

  it('stop releases held notes via an empty emit', () => {
    engine.start();
    sink.clear();
    engine.stop();
    expect(sink.events).toHaveLength(1);
    expect(sink.last.notes).toEqual([]);
    expect(sink.last.restrike).toBe(true);
    expect(engine.getCurrentNotes()).toEqual([]);
  });

  it('stop is a no-op when nothing is currently held', () => {
    engine.stop(); // already stopped, never started
    expect(sink.events).toHaveLength(0);
  });
});

describe('DroneEngine — chord trigger mode', () => {
  it('DOES re-strike when the chord degree changes', () => {
    const { engine, sink } = makeEngine({ triggerMode: 'chord' });
    engine.start();
    expect(sink.last.notes).toEqual([36]); // I = C
    sink.clear();

    engine.onChordChange(4); // IV = F
    expect(sink.events).toHaveLength(1);
    expect(sink.last.notes).toEqual([41]);
    expect(sink.last.restrike).toBe(true);

    engine.onChordChange(5); // V = G
    expect(sink.events).toHaveLength(2);
    expect(sink.last.notes).toEqual([43]);
  });

  it('identical degree change is a no-op', () => {
    const { engine, sink } = makeEngine({ triggerMode: 'chord' });
    engine.start();
    sink.clear();
    engine.onChordChange(1); // same degree
    expect(sink.events).toHaveLength(0);
  });
});

describe('DroneEngine — parameter changes', () => {
  it('changing position re-strikes with the new octave', () => {
    const { engine, sink } = makeEngine();
    engine.start();
    sink.clear();
    engine.onParameterChange('position', 3);
    expect(sink.events).toHaveLength(1);
    expect(sink.last.notes).toEqual([48]); // C3
  });

  it("changing notes from 'root' to 'root+5th' re-strikes with the new voicing", () => {
    const { engine, sink } = makeEngine();
    engine.start();
    sink.clear();
    engine.onParameterChange('notes', 'root+5th');
    expect(sink.last.notes).toEqual([36, 43]);
  });

  it('changing cadence does NOT re-strike immediately', () => {
    const { engine, sink } = makeEngine();
    engine.start();
    sink.clear();
    engine.onParameterChange('cadence', 1);
    expect(sink.events).toHaveLength(0);
  });

  it('changing velocity does NOT re-strike', () => {
    const { engine, sink } = makeEngine();
    engine.start();
    sink.clear();
    engine.onParameterChange('velocity', 64);
    expect(sink.events).toHaveLength(0);
  });

  it('no re-strike if the new value matches the old', () => {
    const { engine, sink } = makeEngine();
    engine.start();
    sink.clear();
    engine.onParameterChange('position', 2);
    expect(sink.events).toHaveLength(0);
  });
});

describe('DroneEngine — cadence-driven retriggers', () => {
  it('cadence = 0 (sustain) never fires on beats', () => {
    const { engine, sink } = makeEngine({ cadence: 0 });
    engine.start();
    sink.clear();
    for (const b of [1, 2, 3, 4, 1, 2]) engine.onBeat(b);
    expect(sink.events).toHaveLength(0);
  });

  it('cadence = 1 (on-one) re-strikes on beat 1 only', () => {
    const { engine, sink } = makeEngine({ cadence: 1 });
    engine.start();
    sink.clear();
    engine.onBeat(2);
    engine.onBeat(3);
    engine.onBeat(4);
    expect(sink.events).toHaveLength(0);
    engine.onBeat(1);
    expect(sink.events).toHaveLength(1);
    expect(sink.last.notes).toEqual([36]);
    expect(sink.last.restrike).toBe(true);
  });

  it('cadence = 4 (on 2 & 4) fires twice per bar', () => {
    const { engine, sink } = makeEngine({ cadence: 4 });
    engine.start();
    sink.clear();
    engine.onBeat(1);
    engine.onBeat(2);
    engine.onBeat(3);
    engine.onBeat(4);
    expect(sink.events).toHaveLength(2);
  });

  it('beats while stopped are ignored', () => {
    const { engine, sink } = makeEngine({ cadence: 5 });
    // not started
    engine.onBeat(1);
    engine.onBeat(2);
    expect(sink.events).toHaveLength(0);
  });
});
