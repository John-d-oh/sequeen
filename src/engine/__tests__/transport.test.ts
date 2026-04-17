import { describe, it, expect } from 'vitest';
import { Transport, ALL_PARTS } from '../transport';

describe('Transport — initial state', () => {
  it('starts with everything stopped and motifs at 0', () => {
    const t = new Transport();
    const s = t.getState();
    expect(s.globalPlaying).toBe(false);
    for (const part of ALL_PARTS) {
      expect(s.parts[part]).toBe('stopped');
    }
    expect(s.motifPositions).toEqual({ motif1: 0, motif2: 0 });
  });
});

describe('Transport — per-part toggling', () => {
  it('togglePart arms a stopped part', () => {
    const t = new Transport();
    t.togglePart('pad');
    expect(t.getState().parts.pad).toBe('armed');
  });

  it('togglePart stops an armed or playing part', () => {
    const t = new Transport();
    t.setPartStatus('motif1', 'playing');
    t.togglePart('motif1');
    expect(t.getState().parts.motif1).toBe('stopped');

    t.setPartStatus('motif1', 'armed');
    t.togglePart('motif1');
    expect(t.getState().parts.motif1).toBe('stopped');
  });

  it('promoteArmedParts turns armed → playing without touching others', () => {
    const t = new Transport();
    t.setPartStatus('pad', 'armed');
    t.setPartStatus('drone', 'stopped');
    t.setPartStatus('motif1', 'playing');
    t.promoteArmedParts();

    const s = t.getState();
    expect(s.parts.pad).toBe('playing');
    expect(s.parts.drone).toBe('stopped');
    expect(s.parts.motif1).toBe('playing');
  });

  it('promoteArmedParts is a no-op if nothing is armed', () => {
    const t = new Transport();
    const before = t.getState();
    t.promoteArmedParts();
    expect(t.getState()).toBe(before); // same object reference
  });
});

describe('Transport — global play/pause', () => {
  it('global play arms all four parts and resets motif positions', () => {
    const t = new Transport();
    // Give motifs some non-zero position first
    t.setMotifPosition('motif1', 7);
    t.setMotifPosition('motif2', 13);
    expect(t.getState().motifPositions).toEqual({ motif1: 7, motif2: 13 });

    t.toggleGlobalPlay();
    const s = t.getState();
    expect(s.globalPlaying).toBe(true);
    for (const part of ALL_PARTS) {
      expect(s.parts[part]).toBe('armed');
    }
    expect(s.motifPositions).toEqual({ motif1: 0, motif2: 0 });
  });

  it('global pause stops every part', () => {
    const t = new Transport();
    t.toggleGlobalPlay();              // on → all armed
    t.promoteArmedParts();             // → all playing
    expect(Object.values(t.getState().parts).every((p) => p === 'playing')).toBe(true);

    t.toggleGlobalPlay();              // off
    const s = t.getState();
    expect(s.globalPlaying).toBe(false);
    for (const part of ALL_PARTS) {
      expect(s.parts[part]).toBe('stopped');
    }
  });

  it('re-engaging global play resyncs motif positions even after running', () => {
    const t = new Transport();
    t.toggleGlobalPlay();              // on
    t.setMotifPosition('motif1', 5);
    t.setMotifPosition('motif2', 11);
    t.toggleGlobalPlay();              // off (positions retained)
    expect(t.getState().motifPositions).toEqual({ motif1: 5, motif2: 11 });

    t.toggleGlobalPlay();              // on again — should resync
    expect(t.getState().motifPositions).toEqual({ motif1: 0, motif2: 0 });
  });
});

describe('Transport — subscription', () => {
  it('notifies subscribers on every state change', () => {
    const t = new Transport();
    const snapshots: number[] = [];
    t.subscribe((s) => snapshots.push(Object.values(s.parts).filter((p) => p !== 'stopped').length));

    t.togglePart('pad');       // 1 non-stopped
    t.togglePart('drone');     // 2 non-stopped
    t.togglePart('pad');       // 1 non-stopped
    expect(snapshots).toEqual([1, 2, 1]);
  });

  it('unsubscribe stops delivery', () => {
    const t = new Transport();
    let calls = 0;
    const off = t.subscribe(() => {
      calls++;
    });
    t.togglePart('pad');
    expect(calls).toBe(1);
    off();
    t.togglePart('drone');
    expect(calls).toBe(1);
  });

  it('getState returns the same reference when nothing changes', () => {
    const t = new Transport();
    const a = t.getState();
    t.setPartStatus('pad', 'stopped'); // no-op
    expect(t.getState()).toBe(a);
  });
});
