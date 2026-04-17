import { describe, it, expect, beforeEach } from 'vitest';
import { NoteTracker, type MidiSink, type VoicingNote } from '../midiOutput';

/**
 * Recording sink that captures every call to `sendNoteOn` / `sendNoteOff`
 * so tests can assert on the exact message stream the tracker would have
 * produced.
 */
class RecordingSink implements MidiSink {
  events: Array<
    | { kind: 'on'; portId: string; channel: number; note: number; velocity: number }
    | { kind: 'off'; portId: string; channel: number; note: number }
  > = [];

  sendNoteOn(portId: string, channel: number, note: number, velocity: number): void {
    this.events.push({ kind: 'on', portId, channel, note, velocity });
  }
  sendNoteOff(portId: string, channel: number, note: number): void {
    this.events.push({ kind: 'off', portId, channel, note });
  }

  clear(): void {
    this.events = [];
  }
}

const v = (notes: Array<[number, number]>): VoicingNote[] =>
  notes.map(([note, velocity]) => ({ note, velocity }));

describe('NoteTracker — voicing diffs', () => {
  let sink: RecordingSink;
  let tracker: NoteTracker;

  beforeEach(() => {
    sink = new RecordingSink();
    tracker = new NoteTracker(sink);
  });

  it('first voicing triggers NoteOn for every note', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100], [67, 100]]));
    expect(sink.events).toEqual([
      { kind: 'on', portId: 'port-a', channel: 1, note: 60, velocity: 100 },
      { kind: 'on', portId: 'port-a', channel: 1, note: 64, velocity: 100 },
      { kind: 'on', portId: 'port-a', channel: 1, note: 67, velocity: 100 },
    ]);
  });

  it('adding a note only triggers NoteOn for the new note', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    expect(sink.events).toEqual([
      { kind: 'on', portId: 'port-a', channel: 1, note: 64, velocity: 100 },
    ]);
  });

  it('removing a note only triggers NoteOff for the removed note', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100]]));
    expect(sink.events).toEqual([{ kind: 'off', portId: 'port-a', channel: 1, note: 64 }]);
  });

  it('same notes as before produces no messages (no restrike)', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    expect(sink.events).toEqual([]);
  });

  it('full swap: old notes off, new notes on', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100], [67, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-a', 1, v([[62, 100], [65, 100], [69, 100]]));
    const offs = sink.events.filter((e) => e.kind === 'off').map((e) => e.note).sort();
    const ons = sink.events.filter((e) => e.kind === 'on').map((e) => e.note).sort();
    expect(offs).toEqual([60, 64, 67]);
    expect(ons).toEqual([62, 65, 69]);
  });
});

describe('NoteTracker — port / channel reassignment', () => {
  let sink: RecordingSink;
  let tracker: NoteTracker;

  beforeEach(() => {
    sink = new RecordingSink();
    tracker = new NoteTracker(sink);
  });

  it('changing portId releases notes on the OLD port before sending on the new one', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-b', 1, v([[60, 100], [64, 100]]));

    // Old destination: both notes released
    const onA = sink.events.filter((e) => e.portId === 'port-a');
    expect(onA.every((e) => e.kind === 'off')).toBe(true);
    expect(onA.map((e) => e.note).sort()).toEqual([60, 64]);

    // New destination: both notes freshly struck
    const onB = sink.events.filter((e) => e.portId === 'port-b');
    expect(onB.every((e) => e.kind === 'on')).toBe(true);
    expect(onB.map((e) => e.note).sort()).toEqual([60, 64]);

    // All offs happen before all ons (so a listener hears the old tail
    // die out before the new chord sounds).
    const firstOnIdx = sink.events.findIndex((e) => e.kind === 'on');
    const lastOffIdx = sink.events.map((e) => e.kind).lastIndexOf('off');
    expect(lastOffIdx).toBeLessThan(firstOnIdx);
  });

  it('changing channel on the same port is treated the same as port change', () => {
    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-a', 5, v([[60, 100]]));
    expect(sink.events).toEqual([
      { kind: 'off', portId: 'port-a', channel: 1, note: 60 },
      { kind: 'on', portId: 'port-a', channel: 5, note: 60, velocity: 100 },
    ]);
  });
});

describe('NoteTracker — multi-part isolation', () => {
  it('two parts on the same port+channel release independently', () => {
    const sink = new RecordingSink();
    const tracker = new NoteTracker(sink);

    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100]]));
    tracker.updateNotes('drone', 'port-a', 1, v([[48, 80]]));
    sink.clear();

    tracker.releasePart('pad');
    expect(sink.events).toEqual([{ kind: 'off', portId: 'port-a', channel: 1, note: 60 }]);
    expect(tracker.getHeldNotes('drone')?.has(48)).toBe(true);
  });

  it('releaseAll empties every part', () => {
    const sink = new RecordingSink();
    const tracker = new NoteTracker(sink);

    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    tracker.updateNotes('motif1', 'port-b', 3, v([[72, 100]]));
    sink.clear();

    tracker.releaseAll();
    const offs = sink.events.filter((e) => e.kind === 'off');
    expect(offs).toHaveLength(3);
    expect(tracker.getHeldNotes('pad')).toBeNull();
    expect(tracker.getHeldNotes('motif1')).toBeNull();
  });
});

describe('NoteTracker — disconnected port', () => {
  it('forgetPort drops tracking without sending NoteOff', () => {
    const sink = new RecordingSink();
    const tracker = new NoteTracker(sink);

    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100]]));
    tracker.updateNotes('drone', 'port-b', 1, v([[48, 80]]));
    sink.clear();

    const affected = tracker.forgetPort('port-a');
    expect(affected).toEqual(['pad']);
    expect(sink.events).toEqual([]); // no MIDI sent — the port is gone
    expect(tracker.getHeldNotes('pad')).toBeNull();
    expect(tracker.getHeldNotes('drone')?.has(48)).toBe(true);
  });
});

describe('NoteTracker — empty voicing is a release', () => {
  it('updating to an empty voicing releases all notes and clears the part', () => {
    const sink = new RecordingSink();
    const tracker = new NoteTracker(sink);

    tracker.updateNotes('pad', 'port-a', 1, v([[60, 100], [64, 100]]));
    sink.clear();
    tracker.updateNotes('pad', 'port-a', 1, []);

    const offs = sink.events.filter((e) => e.kind === 'off').map((e) => e.note).sort();
    expect(offs).toEqual([60, 64]);
    expect(tracker.getHeldNotes('pad')).toBeNull();
  });
});
