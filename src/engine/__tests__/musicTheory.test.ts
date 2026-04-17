import { describe, it, expect } from 'vitest';
import {
  KEYS,
  MODES,
  CHORD_TYPES,
  getScaleNotes,
  getChordNotes,
  getBorrowedChordNotes,
  getChordRootPitchClass,
  getScaleDegreeChordSonority,
  getDegreeRomanNumeral,
} from '../musicTheory';

/** Reduce a MIDI-note list to its unique pitch classes (0–11). */
const pcSet = (notes: number[]) => new Set(notes.map((n) => n % 12));

describe('KEYS', () => {
  it('is the 12 keys in circle-of-fifths order starting on C', () => {
    expect(KEYS).toEqual([
      'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F',
    ]);
    expect(KEYS).toHaveLength(12);
  });
});

describe('getScaleNotes', () => {
  it('C Major contains exactly C, D, E, F, G, A, B across octaves', () => {
    const notes = getScaleNotes('C', 'Major');

    // Every resulting MIDI number must belong to {C,D,E,F,G,A,B}.
    expect([...pcSet(notes)].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);

    // Spot-check specific notes: middle C (60), E4 (64), B4 (71), C5 (72).
    for (const midi of [60, 62, 64, 65, 67, 69, 71, 72]) {
      expect(notes).toContain(midi);
    }

    // Non-scale notes must be absent.
    for (const midi of [61, 63, 66, 68, 70]) {
      expect(notes).not.toContain(midi);
    }

    // Every MIDI slot (0–127) that matches one of the 7 PCs should be present.
    expect(notes).toHaveLength(
      Array.from({ length: 128 }, (_, n) => n).filter((n) =>
        [0, 2, 4, 5, 7, 9, 11].includes(n % 12),
      ).length,
    );
  });

  it('returns ascending MIDI notes', () => {
    const notes = getScaleNotes('G', 'Major');
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i]).toBeGreaterThan(notes[i - 1]);
    }
  });

  it('every listed mode produces exactly its unique pitch-class count', () => {
    for (const [name, intervals] of Object.entries(MODES)) {
      const notes = getScaleNotes('C', name);
      const pcs = pcSet(notes);
      expect(pcs.size, `mode ${name}`).toBe(new Set(intervals).size);
    }
  });
});

describe('getChordNotes — triads in C Major', () => {
  it('I = C-E-G (major)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 1, 'Triad'))).toEqual(new Set([0, 4, 7]));
    expect(getScaleDegreeChordSonority('Major', 1)).toBe('major');
  });

  it('II = D-F-A (minor)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 2, 'Triad'))).toEqual(new Set([2, 5, 9]));
    expect(getScaleDegreeChordSonority('Major', 2)).toBe('minor');
  });

  it('III = E-G-B (minor)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 3, 'Triad'))).toEqual(new Set([4, 7, 11]));
    expect(getScaleDegreeChordSonority('Major', 3)).toBe('minor');
  });

  it('IV = F-A-C (major)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 4, 'Triad'))).toEqual(new Set([5, 9, 0]));
    expect(getScaleDegreeChordSonority('Major', 4)).toBe('major');
  });

  it('V = G-B-D (major)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 5, 'Triad'))).toEqual(new Set([7, 11, 2]));
    expect(getScaleDegreeChordSonority('Major', 5)).toBe('major');
  });

  it('VI = A-C-E (minor)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 6, 'Triad'))).toEqual(new Set([9, 0, 4]));
    expect(getScaleDegreeChordSonority('Major', 6)).toBe('minor');
  });

  it('VII = B-D-F (diminished)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 7, 'Triad'))).toEqual(new Set([11, 2, 5]));
    expect(getScaleDegreeChordSonority('Major', 7)).toBe('diminished');
  });
});

describe('getChordNotes — 7ths add the correct 7th', () => {
  it('C Major I7 = C-E-G-B (maj7)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 1, '7th'))).toEqual(new Set([0, 4, 7, 11]));
  });

  it('C Major V7 = G-B-D-F (dom7)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 5, '7th'))).toEqual(new Set([7, 11, 2, 5]));
  });

  it('C Major ii7 = D-F-A-C (min7)', () => {
    expect(pcSet(getChordNotes('C', 'Major', 2, '7th'))).toEqual(new Set([2, 5, 9, 0]));
  });
});

describe('getChordNotes — sus2 / sus4 replace the 3rd', () => {
  it('sus2 on C Major I = C-D-G (no 3rd)', () => {
    const pcs = pcSet(getChordNotes('C', 'Major', 1, 'sus2'));
    expect(pcs).toEqual(new Set([0, 2, 7]));
    expect(pcs.has(4)).toBe(false); // no E
  });

  it('sus4 on C Major I = C-F-G (no 3rd)', () => {
    const pcs = pcSet(getChordNotes('C', 'Major', 1, 'sus4'));
    expect(pcs).toEqual(new Set([0, 5, 7]));
    expect(pcs.has(4)).toBe(false); // no E
  });
});

describe('getChordNotes — 6th chords', () => {
  it('C Major I6 = C-E-G-A', () => {
    expect(pcSet(getChordNotes('C', 'Major', 1, '6th'))).toEqual(new Set([0, 4, 7, 9]));
  });
});

describe('getChordNotes — per-degree recipes', () => {
  it('alt1: I → Triad, V → 7th, VII → 6th', () => {
    expect(pcSet(getChordNotes('C', 'Major', 1, 'alt1'))).toEqual(new Set([0, 4, 7]));
    expect(pcSet(getChordNotes('C', 'Major', 5, 'alt1'))).toEqual(new Set([7, 11, 2, 5]));
    // VII under alt1 = 6th → B D F G (B+2nd steps [0,2,4,5])
    const vii6 = pcSet(getChordNotes('C', 'Major', 7, 'alt1'));
    expect(vii6).toEqual(new Set([11, 2, 5, 7]));
  });

  it('alt2: I → 7th', () => {
    expect(pcSet(getChordNotes('C', 'Major', 1, 'alt2'))).toEqual(new Set([0, 4, 7, 11]));
  });
});

describe('getDegreeRomanNumeral', () => {
  it('labels major-mode degrees correctly', () => {
    expect(getDegreeRomanNumeral('Major', 1)).toBe('I');
    expect(getDegreeRomanNumeral('Major', 2)).toBe('ii');
    expect(getDegreeRomanNumeral('Major', 3)).toBe('iii');
    expect(getDegreeRomanNumeral('Major', 4)).toBe('IV');
    expect(getDegreeRomanNumeral('Major', 5)).toBe('V');
    expect(getDegreeRomanNumeral('Major', 6)).toBe('vi');
    expect(getDegreeRomanNumeral('Major', 7)).toBe('vii°');
  });

  it('labels natural-minor-mode degrees correctly', () => {
    // Natural minor: i, ii°, III, iv, v, VI, VII
    expect(getDegreeRomanNumeral('Minor', 1)).toBe('i');
    expect(getDegreeRomanNumeral('Minor', 2)).toBe('ii°');
    expect(getDegreeRomanNumeral('Minor', 3)).toBe('III');
    expect(getDegreeRomanNumeral('Minor', 4)).toBe('iv');
    expect(getDegreeRomanNumeral('Minor', 5)).toBe('v');
    expect(getDegreeRomanNumeral('Minor', 6)).toBe('VI');
    expect(getDegreeRomanNumeral('Minor', 7)).toBe('VII');
  });
});

describe('CHORD_TYPES registry', () => {
  it('contains all expected chord types', () => {
    for (const name of ['Triad', '7th', 'sus2', 'sus4', '6th', 'alt1', 'alt2']) {
      expect(CHORD_TYPES[name]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Borrowed chords
// ---------------------------------------------------------------------------

describe('getBorrowedChordNotes — the canonical test cases', () => {
  it('bVII in C Major = Bb-D-F (major triad)', () => {
    // Bb=10, D=2, F=5
    expect(pcSet(getBorrowedChordNotes('C', 7, -1, 'major', 'Triad'))).toEqual(
      new Set([10, 2, 5]),
    );
  });

  it('bIII in C Major = Eb-G-Bb (major triad)', () => {
    // Eb=3, G=7, Bb=10
    expect(pcSet(getBorrowedChordNotes('C', 3, -1, 'major', 'Triad'))).toEqual(
      new Set([3, 7, 10]),
    );
  });

  it('bII in C Major = Db-F-Ab (major triad, the Neapolitan)', () => {
    // Db=1, F=5, Ab=8
    expect(pcSet(getBorrowedChordNotes('C', 2, -1, 'major', 'Triad'))).toEqual(
      new Set([1, 5, 8]),
    );
  });

  it('bVI in C Major = Ab-C-Eb (major triad)', () => {
    // Ab=8, C=0, Eb=3
    expect(pcSet(getBorrowedChordNotes('C', 6, -1, 'major', 'Triad'))).toEqual(
      new Set([8, 0, 3]),
    );
  });

  it('bII in A Minor = Bb-D-F (major triad) — the key is A, not C', () => {
    // Neapolitan in A is Bb major — regardless of mode name, the borrowed
    // chord math is relative to the key tonic.
    expect(pcSet(getBorrowedChordNotes('A', 2, -1, 'major', 'Triad'))).toEqual(
      new Set([10, 2, 5]),
    );
  });

  it('#IV in C Major = F#-A#-C# (major triad)', () => {
    // F#=6, A#=10, C#=1
    expect(pcSet(getBorrowedChordNotes('C', 4, 1, 'major', 'Triad'))).toEqual(
      new Set([6, 10, 1]),
    );
  });

  it('#iv° in C Major = F#-A-C (diminished triad)', () => {
    // Raised 4 as a diminished triad, the classic secondary function chord.
    expect(pcSet(getBorrowedChordNotes('C', 4, 1, 'diminished', 'Triad'))).toEqual(
      new Set([6, 9, 0]),
    );
  });

  it('7th chord type → maj7 for `major` quality', () => {
    // bVII maj7 in C = Bb-D-F-A (10, 2, 5, 9)
    expect(pcSet(getBorrowedChordNotes('C', 7, -1, 'major', '7th'))).toEqual(
      new Set([10, 2, 5, 9]),
    );
  });

  it('7th chord type → min7 for `minor` quality', () => {
    // biii min7 in C = Eb-Gb-Bb-Db (3, 6, 10, 1)
    expect(pcSet(getBorrowedChordNotes('C', 3, -1, 'minor', '7th'))).toEqual(
      new Set([3, 6, 10, 1]),
    );
  });

  it('sus2 / sus4 ignore quality and still build from the altered root', () => {
    // bVII sus2 in C = Bb-C-F (10, 0, 5)
    expect(pcSet(getBorrowedChordNotes('C', 7, -1, 'major', 'sus2'))).toEqual(
      new Set([10, 0, 5]),
    );
    // bVII sus4 in C = Bb-Eb-F (10, 3, 5)
    expect(pcSet(getBorrowedChordNotes('C', 7, -1, 'major', 'sus4'))).toEqual(
      new Set([10, 3, 5]),
    );
  });
});

describe('getChordNotes — backwards compatibility', () => {
  it('diatonic calls return the same thing before and after the borrowed-chord feature', () => {
    // I in C Major → C-E-G (0, 4, 7)
    expect(pcSet(getChordNotes('C', 'Major', 1, 'Triad'))).toEqual(new Set([0, 4, 7]));
    // vii° in C Major → B-D-F (11, 2, 5)
    expect(pcSet(getChordNotes('C', 'Major', 7, 'Triad'))).toEqual(new Set([11, 2, 5]));
    // Degree type still accepts explicit defaults and produces the same output
    expect(
      pcSet(getChordNotes('C', 'Major', 1, 'Triad', 0, 'auto')),
    ).toEqual(new Set([0, 4, 7]));
  });

  it('delegates to borrowed path when alteration ≠ 0 or quality ≠ auto', () => {
    // bVII as a borrowed chord via getChordNotes
    expect(pcSet(getChordNotes('C', 'Major', 7, 'Triad', -1, 'major'))).toEqual(
      new Set([10, 2, 5]),
    );
    // Force quality on a diatonic degree: iii in C Major is normally E-G-B
    // (minor), but forcing major gives E-G#-B.
    expect(pcSet(getChordNotes('C', 'Major', 3, 'Triad', 0, 'major'))).toEqual(
      new Set([4, 8, 11]),
    );
  });
});

describe('getChordRootPitchClass', () => {
  it('matches the diatonic root for auto/natural chords', () => {
    // C Major I → C=0
    expect(getChordRootPitchClass('C', 'Major', 1)).toBe(0);
    // C Major V → G=7
    expect(getChordRootPitchClass('C', 'Major', 5)).toBe(7);
    // C Minor III → Eb=3 (the mode's native third)
    expect(getChordRootPitchClass('C', 'Minor', 3)).toBe(3);
  });

  it('uses major-scale math when alteration or quality is set', () => {
    // bVII in C is Bb=10 regardless of mode
    expect(getChordRootPitchClass('C', 'Major', 7, -1, 'major')).toBe(10);
    expect(getChordRootPitchClass('C', 'Dorian', 7, -1, 'major')).toBe(10);
    expect(getChordRootPitchClass('C', 'Harmonic Minor', 7, -1, 'major')).toBe(10);
    // #IV in C is F#=6
    expect(getChordRootPitchClass('C', 'Major', 4, 1, 'major')).toBe(6);
  });

  it('bII in A Minor resolves to Bb=10', () => {
    expect(getChordRootPitchClass('A', 'Minor', 2, -1, 'major')).toBe(10);
  });
});
