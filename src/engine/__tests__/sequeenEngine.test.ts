import { describe, it, expect } from 'vitest';
import { SequeenEngine, type SequeenMidiManager } from '../SequeenEngine';
import type { Scheduler } from '../clock';
import type { MotifRhythmBeat } from '../parts/motif';

// ---------------------------------------------------------------------------
// Recording MIDI manager — the whole integration runs against this.
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
  get offs() {
    return this.events.filter((e): e is Extract<MidiEvent, { kind: 'off' }> => e.kind === 'off');
  }
}

// ---------------------------------------------------------------------------
// Fake clock scheduler + harness
// ---------------------------------------------------------------------------

function harness() {
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
    getTime: () => t,
  };
}

// ---------------------------------------------------------------------------
// Rhythm / pattern builders
// ---------------------------------------------------------------------------

const N = (v = 100): MotifRhythmBeat => ({ type: 'note', velocity: v });
const R = (): MotifRhythmBeat => ({ type: 'rest', velocity: 0 });

function pad32(beats: MotifRhythmBeat[]): MotifRhythmBeat[] {
  const out = beats.slice();
  while (out.length < 32) out.push(R());
  return out;
}
function pattern16(values: number[]): number[] {
  const out = values.slice();
  while (out.length < 16) out.push(1);
  return out;
}

/**
 * Arrange a simple motif that plays one chromatic note per tick so the
 * integration tests can reason about output trivially.
 */
function configureSimpleMotif1(seq: SequeenEngine) {
  seq.setMotif1Param('position', 60);
  seq.setMotif1Param('patternType', 'chromatic');
  seq.setMotif1Param('patternLength', 4);
  seq.setMotif1Param('pattern', pattern16([1, 2, 3, 4]));
  seq.setMotif1Param('rhythmLength', 1);
  seq.setMotif1Param('rhythm', pad32([N(100)]));
  seq.setMotif1Param('variation', 'forward');
  seq.setMotif1Param('clockDivide', '1/8');
}

/**
 * Advance the virtual clock by `count` pulses, firing one scheduler tick
 * per pulse. Relative to the current time so it works correctly across
 * clock restarts.
 */
function runPulses(h: ReturnType<typeof harness>, count: number): void {
  const pulseDur = h.seq.clock.pulseDurationMs;
  for (let i = 0; i < count; i++) h.advance(pulseDur);
}

// ---------------------------------------------------------------------------
// 1. Motif 1 plays on its configured MIDI channel
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — MIDI routing', () => {
  it('motif 1 NoteOns land on its configured port + channel', () => {
    const h = harness();
    h.seq.setPartConfig('motif1', { portId: 'port-a', channel: 5 });
    configureSimpleMotif1(h.seq);
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();

    // Pulse 0 fires on play start → promotes motif1 armed → playing → start()
    // resets its counters → motif1.onPulse() immediately fires tick 0.
    h.setTime(0);
    expect(h.midi.ons).toHaveLength(1);
    expect(h.midi.ons[0]).toEqual({
      kind: 'on',
      portId: 'port-a',
      channel: 5,
      note: 60,
      velocity: 100,
    });

    // 1/8 = 3 pulses/tick. Running to pulse 9 fires ticks at pulses 0, 3, 6, 9.
    runPulses(h, 9);
    expect(h.midi.ons.map((e) => e.note)).toEqual([60, 61, 62, 63]);
    expect(h.midi.ons.every((e) => e.portId === 'port-a' && e.channel === 5)).toBe(true);
  });

  it('rerouting a part mid-play releases notes on the old destination', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'port-a', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0); // pad promoted → playing → voicing emits

    expect(h.midi.ons.length).toBeGreaterThanOrEqual(3);
    expect(h.midi.ons.every((e) => e.portId === 'port-a')).toBe(true);

    h.midi.clear();
    h.seq.setPartConfig('pad', { portId: 'port-b', channel: 2 });

    // Every previously-held note on port-a is released.
    expect(h.midi.offs.every((e) => e.portId === 'port-a' && e.channel === 1)).toBe(true);
    expect(h.midi.offs).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Chord changes mid-play
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — chord changes', () => {
  it('pad transitions smoothly: old chord tones off, new ones on, common tones held', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    // Default pad: position=60, range=3, C Major I → [60, 64, 67]
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    // Initial voicing.
    expect(h.midi.ons.map((e) => e.note).sort((a, b) => a - b)).toEqual([60, 64, 67]);

    h.midi.clear();
    h.seq.setDegree(5); // V = G-B-D → voicing at position 60 is [62, 67, 71]

    // 67 is a common tone → NOT restruck.
    const offs = h.midi.offs.map((e) => e.note).sort((a, b) => a - b);
    const ons = h.midi.ons.map((e) => e.note).sort((a, b) => a - b);
    expect(offs).toEqual([60, 64]); // old notes that aren't in the new chord
    expect(ons).toEqual([62, 71]); // new notes that weren't in the old chord
  });

  it("motif 1 with patternType='chord' pulls from the new chord pool after setDegree", () => {
    const h = harness();
    h.seq.setPartConfig('motif1', { portId: 'p', channel: 1 });
    h.seq.setMotif1Param('position', 0); // bottom of the pool
    h.seq.setMotif1Param('patternType', 'chord');
    h.seq.setMotif1Param('patternLength', 3);
    h.seq.setMotif1Param('pattern', pattern16([1, 2, 3]));
    h.seq.setMotif1Param('rhythmLength', 1);
    h.seq.setMotif1Param('rhythm', pad32([N()]));
    h.seq.setMotif1Param('clockDivide', '1/8');
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();

    // Tick 0 on pulse 0, then 1/8 ticks at pulses 3, 6.
    h.setTime(0);
    runPulses(h, 6);
    // C Major I pool: 0, 4, 7, 12, 16, 19, … → first 3 = [0, 4, 7]
    expect(h.midi.ons.map((e) => e.note)).toEqual([0, 4, 7]);

    h.midi.clear();
    h.seq.setDegree(5); // V = G-B-D → pool: 2, 7, 11, 14, 19, 23, …
    runPulses(h, 9); // 3 more note events
    expect(h.midi.ons.slice(0, 3).map((e) => e.note)).toEqual([2, 7, 11]);
  });

  it("motif 1 with patternType='scale' ignores chord changes", () => {
    const h = harness();
    h.seq.setPartConfig('motif1', { portId: 'p', channel: 1 });
    h.seq.setMotif1Param('position', 0);
    h.seq.setMotif1Param('patternType', 'scale');
    h.seq.setMotif1Param('patternLength', 3);
    h.seq.setMotif1Param('pattern', pattern16([1, 2, 3]));
    h.seq.setMotif1Param('rhythmLength', 1);
    h.seq.setMotif1Param('rhythm', pad32([N()]));
    h.seq.setMotif1Param('clockDivide', '1/8');
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();

    h.setTime(0);
    runPulses(h, 6);
    // C Major scale pool starts at 0: 0, 2, 4, 5, 7, 9, 11, … → first 3 = [0, 2, 4]
    expect(h.midi.ons.map((e) => e.note)).toEqual([0, 2, 4]);

    h.midi.clear();
    h.seq.setDegree(5); // should not affect scale pool
    runPulses(h, 9);
    expect(h.midi.ons.slice(0, 3).map((e) => e.note)).toEqual([0, 2, 4]);
  });
});

// ---------------------------------------------------------------------------
// 3. Key changes re-voice every part
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — key changes', () => {
  it('changing key re-voices the pad', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    // C Major I at pos 60 → [60, 64, 67]
    const firstVoicing = h.midi.ons.map((e) => e.note).sort((a, b) => a - b);
    expect(firstVoicing).toEqual([60, 64, 67]);

    h.midi.clear();
    h.seq.setKey('G'); // G Major I at pos 60 → [62, 67, 71]

    const newOns = h.midi.ons.map((e) => e.note).sort((a, b) => a - b);
    // Voicing shifted — at least one note should differ.
    expect(newOns).not.toEqual([60, 64, 67]);
    expect(new Set(newOns).size).toBe(newOns.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Global play/pause resyncs motifs
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — global play/pause', () => {
  it('re-engaging global play restarts the motif from its first pattern step', () => {
    const h = harness();
    h.seq.setPartConfig('motif1', { portId: 'p', channel: 1 });
    configureSimpleMotif1(h.seq);
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();
    h.setTime(0);
    runPulses(h, 9); // 4 motif ticks at 1/8
    expect(h.midi.ons.map((e) => e.note)).toEqual([60, 61, 62, 63]);

    // Stop everything.
    h.seq.toggleGlobalPlay();
    h.midi.clear();

    // Start again — should replay from note 60.
    h.seq.toggleGlobalPlay();
    // Clock was reset by toggleGlobalPlay(on); pulse 0 fires on the next tick.
    h.setTime(h.getTime());
    runPulses(h, 9);
    expect(h.midi.ons.map((e) => e.note)).toEqual([60, 61, 62, 63]);
  });

  it('stopping global play releases all held notes', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    const heldCount = h.midi.ons.length;
    expect(heldCount).toBeGreaterThan(0);

    h.midi.clear();
    h.seq.toggleGlobalPlay(); // stop

    expect(h.midi.offs).toHaveLength(heldCount);
    expect(h.seq.transport.getState().globalPlaying).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Panic
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — panic', () => {
  it('panic() releases everything, stops the clock, and blasts the MIDI panic', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.setPartConfig('motif1', { portId: 'p', channel: 2 });
    configureSimpleMotif1(h.seq);
    h.seq.togglePart('pad');
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();
    h.setTime(0);
    runPulses(h, 3);

    // Confirm something is audibly running.
    expect(h.midi.ons.length).toBeGreaterThan(0);
    expect(h.seq.clock.state).toBe('playing');

    h.midi.clear();
    h.seq.panic();

    // Hardware-level panic message was sent.
    expect(h.midi.events.some((e) => e.kind === 'panic')).toBe(true);
    // Pad notes were released through the NoteTracker before panic flushed.
    expect(h.midi.offs.length).toBeGreaterThanOrEqual(3);
    // Everything is now quiescent.
    expect(h.seq.clock.state).toBe('stopped');
    expect(h.seq.transport.getState().globalPlaying).toBe(false);
    for (const status of Object.values(h.seq.transport.getState().parts)) {
      expect(status).toBe('stopped');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. BPM / tempo changes
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — tempo', () => {
  it('setBpm flows through to the clock', () => {
    const h = harness();
    expect(h.seq.clock.bpm).toBe(120);
    h.seq.setBpm(90);
    expect(h.seq.clock.bpm).toBe(90);
    h.seq.setBpm(9999); // clamp
    expect(h.seq.clock.bpm).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// 7. Borrowed chords
// ---------------------------------------------------------------------------

describe('SequeenEngine integration — borrowed chords', () => {
  it('pad re-voices from diatonic I (C-E-G) to borrowed bVII (Bb-D-F)', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    // Default pad: position=60, range=3, C Major I → [60, 64, 67]
    expect(h.midi.ons.map((e) => e.note).sort((a, b) => a - b)).toEqual([60, 64, 67]);
    expect(new Set(h.seq.padEngine.getCurrentVoicing().map((n) => n % 12))).toEqual(
      new Set([0, 4, 7]),
    );

    // Flip to bVII: Bb-D-F in C Major
    h.seq.setDegree(7);
    h.seq.setAlteration(-1);

    // The pad's held voicing now comes from the borrowed-chord pool.
    const voicingPcs = new Set(h.seq.padEngine.getCurrentVoicing().map((n) => n % 12));
    expect(voicingPcs).toEqual(new Set([10, 2, 5]));

    // And the MIDI diff shows Bb (10) entering and B (11) leaving, while
    // the common tones D (2) and F (5) remain sounding.
    expect(h.midi.ons.some((e) => e.note % 12 === 10)).toBe(true); // Bb entered
    expect(h.midi.offs.some((e) => e.note % 12 === 11)).toBe(true); // B (from vii°) left
  });

  it('stepping alteration back to 0 returns to the diatonic path', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    // Set up bVII first
    h.seq.setDegree(7);
    h.seq.setAlteration(-1);
    h.midi.clear();

    // Back to natural vii°
    h.seq.setAlteration(0);
    // vii° in C Major is B-D-F (PCs 11, 2, 5)
    const pcs = new Set(
      h.midi.ons.map((e) => e.note % 12).concat([...new Set(h.midi.offs.map((e) => e.note % 12))]),
    );
    // The pad transitioned — verify vii° PCs present among the messages
    expect(pcs.has(11)).toBe(true); // B entered
  });

  it("motif with patternType='chord' pulls borrowed chord tones", () => {
    const h = harness();
    h.seq.setPartConfig('motif1', { portId: 'p', channel: 1 });
    h.seq.setMotif1Param('position', 0);
    h.seq.setMotif1Param('patternType', 'chord');
    h.seq.setMotif1Param('patternLength', 3);
    h.seq.setMotif1Param('pattern', pattern16([1, 2, 3]));
    h.seq.setMotif1Param('rhythmLength', 1);
    h.seq.setMotif1Param('rhythm', pad32([N()]));
    h.seq.setMotif1Param('clockDivide', '1/8');
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();

    // Before the borrowed chord: C Major I pool starts with 0, 4, 7 → [0, 4, 7]
    h.setTime(0);
    runPulses(h, 6);
    expect(h.midi.ons.map((e) => e.note)).toEqual([0, 4, 7]);

    h.midi.clear();
    h.seq.setDegree(7);
    h.seq.setAlteration(-1); // bVII

    // bVII = Bb major triad, ascending MIDI pool starts 2, 5, 10, 14, 17, 22, …
    // pattern [1,2,3] at pos 0 → [2, 5, 10]
    runPulses(h, 9);
    expect(h.midi.ons.slice(0, 3).map((e) => e.note)).toEqual([2, 5, 10]);
  });

  it("motif with patternType='scale' ignores borrowed chords (stays diatonic)", () => {
    const h = harness();
    h.seq.setPartConfig('motif1', { portId: 'p', channel: 1 });
    h.seq.setMotif1Param('position', 0);
    h.seq.setMotif1Param('patternType', 'scale');
    h.seq.setMotif1Param('patternLength', 3);
    h.seq.setMotif1Param('pattern', pattern16([1, 2, 3]));
    h.seq.setMotif1Param('rhythmLength', 1);
    h.seq.setMotif1Param('rhythm', pad32([N()]));
    h.seq.setMotif1Param('clockDivide', '1/8');
    h.seq.togglePart('motif1');
    h.seq.toggleGlobalPlay();

    h.setTime(0);
    runPulses(h, 6);
    // C Major scale pool starts 0, 2, 4, 5, 7, 9, 11, … → [0, 2, 4]
    expect(h.midi.ons.map((e) => e.note)).toEqual([0, 2, 4]);

    h.midi.clear();
    h.seq.setDegree(7);
    h.seq.setAlteration(-1); // bVII shouldn't affect the scale pool

    runPulses(h, 9);
    // Still drawing from C Major scale — same three notes
    expect(h.midi.ons.slice(0, 3).map((e) => e.note)).toEqual([0, 2, 4]);
  });

  it('drone in chord mode follows the borrowed chord root', () => {
    const h = harness();
    h.seq.setPartConfig('drone', { portId: 'p', channel: 1 });
    // Drone defaults to triggerMode 'chord' now.
    h.seq.togglePart('drone');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    // Default: C Major I → root C (pos 2 → C2 = MIDI 36)
    expect(h.midi.ons[h.midi.ons.length - 1]?.note).toBe(36);

    h.midi.clear();
    h.seq.setDegree(7);
    h.seq.setAlteration(-1); // bVII → Bb2 = MIDI 46

    const lastOn = h.midi.ons[h.midi.ons.length - 1];
    expect(lastOn?.note).toBe(46);
  });

  it('setChordQuality flips a borrowed major chord to minor', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);

    h.seq.setDegree(7);
    h.seq.setAlteration(-1); // bVII major = Bb-D-F

    h.midi.clear();
    h.seq.setChordQuality('minor'); // bvii minor = Bb-Db-F

    // Minor triad on Bb: PCs {10, 1, 5}
    const ons = h.midi.ons.map((e) => e.note % 12);
    // D (2) leaves, Db (1) enters
    expect(h.midi.offs.some((e) => e.note % 12 === 2)).toBe(true);
    expect(ons).toContain(1);
  });

  it('setChordQuality with a diatonic chord is a no-op', () => {
    const h = harness();
    h.seq.setPartConfig('pad', { portId: 'p', channel: 1 });
    h.seq.togglePart('pad');
    h.seq.toggleGlobalPlay();
    h.setTime(0);
    h.midi.clear();

    // alteration is 0 → quality override is ignored
    h.seq.setChordQuality('minor');
    expect(h.midi.events).toHaveLength(0);
    expect(h.seq.getMusic().chordQuality).toBe('auto');
  });
});
