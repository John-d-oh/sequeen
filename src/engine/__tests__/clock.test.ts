import { describe, it, expect, beforeEach } from 'vitest';
import { Clock, PPQ, type Scheduler } from '../clock';

/**
 * Test harness: a fake time source + fake scheduler that lets us drive the
 * clock deterministically from test code.
 *
 * `advance(ms)` moves the virtual clock forward and fires one tick, which is
 * how any real frame scheduler would behave — a tick observes the latest
 * time and catches up by firing all due pulses in one pass.
 */
function makeHarness(bpm = 120) {
  let currentTime = 0;
  let tick: (() => void) | null = null;

  const scheduler: Scheduler = {
    start(cb) {
      tick = cb;
    },
    stop() {
      tick = null;
    },
  };

  const clock = new Clock({ bpm, now: () => currentTime, scheduler });
  const fired: Array<{ pulse: number; beat: number; time: number }> = [];
  clock.onPulse((pulse, beat, time) => fired.push({ pulse, beat, time }));

  return {
    clock,
    fired,
    /** Advance virtual time by `ms` milliseconds and run one tick. */
    advance(ms: number) {
      currentTime += ms;
      tick?.();
    },
    /** Set virtual time to an absolute value and run one tick. */
    setTime(t: number) {
      currentTime = t;
      tick?.();
    },
    getTime: () => currentTime,
  };
}

describe('Clock — timing basics', () => {
  it('generates 24 pulses per beat at 120 BPM', () => {
    const h = makeHarness(120);
    h.clock.play();
    // pulse 0 fires immediately at t=0 during play()'s first tick
    h.advance(0);
    // Fire all pulses for a full beat: 24 pulses at indices 0..23, inclusive.
    // Pulse 24 would be the first of beat 2; we stop *just* before it.
    const pulseDur = h.clock.pulseDurationMs; // 500/24 ≈ 20.833ms
    // Advance to the time of pulse 23 (inclusive) but not pulse 24.
    h.setTime(23 * pulseDur);

    expect(h.fired).toHaveLength(24);
    expect(h.fired.every((f) => f.beat === 1)).toBe(true);
    expect(h.fired.map((f) => f.pulse)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
  });

  it('pulse 0 is the downbeat of beat 1', () => {
    const h = makeHarness(120);
    h.clock.play();
    h.advance(0);
    expect(h.fired[0]).toEqual({ pulse: 0, beat: 1, time: 0 });
  });

  it('beat rolls 1→2→3→4→1 across bars', () => {
    const h = makeHarness(120);
    h.clock.play();
    // Advance 4 full beats = 2000 ms at 120 BPM, stopping just before bar 2.
    const pulseDur = h.clock.pulseDurationMs;
    h.setTime(95 * pulseDur); // pulses 0..95 = 4 beats × 24 pulses

    // Check the first pulse of each beat: 0, 24, 48, 72
    const firstOfBeat = (idx: number) => h.fired.find((f) => f.time >= idx * 24 * pulseDur - 0.0001 && f.pulse === 0);
    expect(h.fired.find((f) => f.pulse === 0 && f.beat === 1)).toBeDefined();
    expect(h.fired.find((f) => f.pulse === 0 && f.beat === 2)).toBeDefined();
    expect(h.fired.find((f) => f.pulse === 0 && f.beat === 3)).toBeDefined();
    expect(h.fired.find((f) => f.pulse === 0 && f.beat === 4)).toBeDefined();
    // Silence the unused helper lint
    void firstOfBeat;

    // Cross bar boundary: advance one more pulse to index 96 — back to beat 1
    h.setTime(96 * pulseDur);
    const last = h.fired[h.fired.length - 1];
    expect(last).toEqual({ pulse: 0, beat: 1, time: 96 * pulseDur });
  });

  it('PPQ constant matches MIDI clock standard', () => {
    expect(PPQ).toBe(24);
  });
});

describe('Clock — tempo changes', () => {
  it('setBpm takes effect immediately', () => {
    const h = makeHarness(120);
    h.clock.play();
    h.advance(0);

    // Run 12 pulses at 120 BPM (half a beat = 250 ms).
    const dur120 = h.clock.pulseDurationMs; // ~20.833 ms
    h.setTime(11 * dur120); // pulses 0..11 — 12 pulses
    expect(h.fired).toHaveLength(12);

    // Halve the tempo — pulses now last twice as long.
    h.clock.setBpm(60);
    expect(h.clock.pulseDurationMs).toBeCloseTo(2 * dur120, 10);

    // Advance one NEW pulse duration — should fire exactly one more pulse.
    // New startTime is anchored so pulseIndex=11 sits at current time, so the
    // next pulse (index 12) is one new-pulseDur away.
    const newDur = h.clock.pulseDurationMs;
    h.advance(newDur);
    expect(h.fired).toHaveLength(13);
    expect(h.fired[12].pulse).toBe(12);
  });

  it('clamps BPM to [10, 300]', () => {
    const c = new Clock({ bpm: 120 });
    c.setBpm(5);
    expect(c.bpm).toBe(10);
    c.setBpm(9999);
    expect(c.bpm).toBe(300);
  });
});

describe('Clock — pause / resume / stop', () => {
  it('pause preserves position; resume continues from it', () => {
    const h = makeHarness(120);
    h.clock.play();
    h.advance(0);

    const pulseDur = h.clock.pulseDurationMs;
    // Run to pulse 9 (still within beat 1)
    h.setTime(9 * pulseDur);
    expect(h.fired).toHaveLength(10);
    expect(h.clock.pulseIndex).toBe(9);

    h.clock.pause();
    expect(h.clock.state).toBe('paused');

    // Simulate real-world pause duration — no pulses should fire.
    h.advance(5_000);
    expect(h.fired).toHaveLength(10);
    expect(h.clock.pulseIndex).toBe(9);

    // Resume — next pulse fires one pulseDur after resume time.
    h.clock.play();
    expect(h.clock.state).toBe('playing');
    h.advance(pulseDur);
    expect(h.fired).toHaveLength(11);
    expect(h.fired[10].pulse).toBe(10);
    expect(h.clock.pulseIndex).toBe(10);
  });

  it('stop resets to before beat 1', () => {
    const h = makeHarness(120);
    h.clock.play();
    h.advance(0);
    h.setTime(50 * h.clock.pulseDurationMs);
    expect(h.clock.pulseIndex).toBe(50);

    h.clock.stop();
    expect(h.clock.state).toBe('stopped');
    expect(h.clock.pulseIndex).toBe(-1);
    expect(h.clock.beat).toBe(1);
    expect(h.clock.pulseInBeat).toBe(0);

    // Play again — pulse 0 fires immediately.
    h.fired.length = 0;
    h.clock.play();
    h.advance(0);
    expect(h.fired[0]).toMatchObject({ pulse: 0, beat: 1 });
  });
});

describe('Clock — subscription', () => {
  let h: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    h = makeHarness(120);
  });

  it('onPulse returns an unsubscribe function', () => {
    const calls: number[] = [];
    const unsub = h.clock.onPulse((p) => calls.push(p));
    h.clock.play();
    h.advance(0);
    expect(calls.length).toBeGreaterThan(0);

    const before = calls.length;
    unsub();
    h.advance(h.clock.pulseDurationMs);
    expect(calls.length).toBe(before); // no new calls after unsubscribe
  });

  it('isDownbeat flag is true at the start of a bar', () => {
    h.clock.play();
    h.advance(0);
    expect(h.clock.isDownbeat).toBe(true);

    // Move into the middle of beat 1 — no longer downbeat.
    h.setTime(5 * h.clock.pulseDurationMs);
    expect(h.clock.isDownbeat).toBe(false);
  });
});
