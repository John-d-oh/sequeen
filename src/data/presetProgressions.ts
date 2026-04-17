/**
 * Factory preset progressions for Sequeen.
 *
 * 66 progressions across 8 electronic-music / classical genres. Every
 * progression totals 7 or 8 bars — short enough to stay musical, long
 * enough to avoid monotony — and uses at most 8 steps.
 *
 * Helper shorthand:
 *   d(degree, bars?, chordType?)              — diatonic (follows the mode's scale)
 *   q(degree, quality, bars?, chordType?)     — diatonic position, forced quality
 *   b(degree, bars?, chordType?, quality?)    — flat altered (borrowed; default major)
 *   s(degree, bars?, chordType?, quality?)    — sharp altered (borrowed; default major)
 *
 * Every step defaults to 1 bar and 'Triad' chord type unless otherwise noted.
 */

import type {
  ChordProgression,
  ChordProgressionStep,
  ChordProgressionChordType,
} from '../engine/chordProgression';
import type { ChordQuality } from '../engine/musicTheory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function d(
  degree: number,
  bars = 1,
  chordType: ChordProgressionChordType = 'Triad',
): ChordProgressionStep {
  return { degree, alteration: 0, quality: 'auto', chordType, bars };
}

function q(
  degree: number,
  quality: ChordQuality,
  bars = 1,
  chordType: ChordProgressionChordType = 'Triad',
): ChordProgressionStep {
  return { degree, alteration: 0, quality, chordType, bars };
}

function b(
  degree: number,
  bars = 1,
  chordType: ChordProgressionChordType = 'Triad',
  quality: ChordQuality = 'major',
): ChordProgressionStep {
  return { degree, alteration: -1, quality, chordType, bars };
}

// Sharp helper kept for completeness — none of the current presets use
// raised chromatic chords (#IV, #V) but the helper is exported for
// custom user progressions and future preset additions.
export function sharp(
  degree: number,
  bars = 1,
  chordType: ChordProgressionChordType = 'Triad',
  quality: ChordQuality = 'major',
): ChordProgressionStep {
  return { degree, alteration: 1, quality, chordType, bars };
}

function prog(
  id: string,
  name: string,
  genre: string,
  degrees: ChordProgressionStep[],
  description: string,
  suggestedMode?: string,
): ChordProgression {
  return { id, name, genre, degrees, description, suggestedMode };
}

// ---------------------------------------------------------------------------
// House (15)
// ---------------------------------------------------------------------------

const HOUSE: ChordProgression[] = [
  // Deep House (5)
  prog(
    'deep-house-soul',
    'Deep House Soul',
    'House',
    [d(1, 2), d(4, 2), d(5, 2), d(4, 2)],
    'Classic soulful deep house groove. Long breathing chords',
    'Major',
  ),
  prog(
    'deep-house-jazz',
    'Deep House Jazz',
    'House',
    [d(2, 2, '7th'), d(5, 2, '7th'), d(1, 2, '7th'), d(6, 2, '7th')],
    'Jazz-influenced deep house. Larry Heard vibes',
    'Major',
  ),
  prog(
    'deep-house-minor',
    'Deep House Minor',
    'House',
    [d(1, 2), d(4), b(7), b(6, 2), b(7)],
    'Moody minor deep house with asymmetric phrasing',
    'Minor',
  ),
  prog(
    'deep-dusk',
    'Deep Dusk',
    'House',
    [d(1, 2), b(6), b(3, 2), b(7), b(6), d(1)],
    'Warm, contemplative deep house. Extended journey',
    'Minor',
  ),
  prog(
    'soulful-garage',
    'Soulful Garage',
    'House',
    [d(1, 2), d(6), d(2, 2), d(5), d(6), d(4)],
    'UK garage / soulful house with passing chords',
    'Major',
  ),

  // Tech House (3)
  prog(
    'tech-house-minimal',
    'Tech House Minimal',
    'House',
    [d(1, 4), b(7, 4)],
    'Hypnotic 2-chord tech house vamp. Let it breathe',
    'Minor',
  ),
  prog(
    'tech-house-groove',
    'Tech House Groove',
    'House',
    [d(1, 2), d(4, 2), d(5), d(4), d(1, 2)],
    'Dark rolling tech house',
    'Minor',
  ),
  prog(
    'tech-funk',
    'Tech Funk',
    'House',
    [d(1, 2), q(4, 'major', 2), d(1, 2), b(7, 2)],
    'Dorian-flavored tech house funk',
    'Dorian',
  ),

  // Progressive House (4)
  prog(
    'progressive-sunrise',
    'Progressive Sunrise',
    'House',
    [d(6, 2), d(4, 2), d(1, 2), d(5, 2)],
    'Classic progressive house build. Deadmau5 territory',
    'Major',
  ),
  prog(
    'progressive-emotional',
    'Progressive Emotional',
    'House',
    [d(1, 2), d(3), d(6, 2), d(4, 2), d(5)],
    'Emotional progressive house arc',
    'Major',
  ),
  prog(
    'progressive-journey',
    'Progressive Journey',
    'House',
    [d(1, 2), b(3), b(7, 2), q(4, 'major'), b(6), d(1)],
    'Long-form progressive movement with borrowed chords',
    'Minor',
  ),
  prog(
    'progressive-anthem',
    'Progressive Anthem',
    'House',
    [d(1), d(5), d(6, 2), d(4, 2), d(1), d(5)],
    'Festival progressive house. Lingering on the minor',
    'Major',
  ),

  // Afro House (3)
  prog(
    'afro-house-pulse',
    'Afro House Pulse',
    'House',
    [d(1, 2), d(4, 2), b(7, 2), d(1, 2)],
    'Percussive afro house feel. Black Coffee vibes',
    'Minor',
  ),
  prog(
    'afro-deep',
    'Afro Deep',
    'House',
    [d(1, 2), d(4), d(5), d(4, 2), d(1), d(5)],
    'Uplifting afro-deep house',
    'Major',
  ),
  prog(
    'tribal-house',
    'Tribal House',
    'House',
    [d(1, 2), b(7), b(6, 2), b(7), d(1, 2)],
    'Tribal/organic house rhythm',
    'Minor',
  ),
];

// ---------------------------------------------------------------------------
// Techno (12)
// ---------------------------------------------------------------------------

const TECHNO: ChordProgression[] = [
  // Melodic Techno (5)
  prog(
    'melodic-techno-dark',
    'Melodic Techno Dark',
    'Techno',
    [d(1, 2), b(6), b(3, 2), b(7), b(6), d(1)],
    'Afterlife / Tale of Us territory',
    'Minor',
  ),
  prog(
    'melodic-techno-hopeful',
    'Melodic Techno Hopeful',
    'Techno',
    [d(1, 2), b(7, 2), b(6, 2), d(5, 2)],
    'Dark to light melodic techno arc',
    'Minor',
  ),
  prog(
    'melodic-techno-driving',
    'Melodic Techno Driving',
    'Techno',
    [d(1, 2), d(4), b(6, 2), d(5), d(4), d(1)],
    'Driving melodic techno. Stephan Bodzin vibes',
    'Minor',
  ),
  prog(
    'berlin-minimal',
    'Berlin Minimal',
    'Techno',
    [d(1, 4), b(2, 2), d(1, 2)],
    'Phrygian minimal techno. Long root then tension',
    'Phrygian',
  ),
  prog(
    'melodic-peak-time',
    'Melodic Peak Time',
    'Techno',
    [d(1), b(3, 2), b(7, 2), b(6, 2), d(5)],
    'Peak-time melodic techno release',
    'Minor',
  ),

  // Dark / Industrial (3)
  prog(
    'industrial-grind',
    'Industrial Grind',
    'Techno',
    [d(1, 4), b(2, 2), d(1, 2)],
    'Harsh industrial techno. Oppressive root with stabs',
    'Phrygian',
  ),
  prog(
    'dark-warehouse',
    'Dark Warehouse',
    'Techno',
    [d(1, 2), b(6, 2), b(7, 2), d(1, 2)],
    'Oppressive warehouse techno',
    'Minor',
  ),
  prog(
    'acid-techno',
    'Acid Techno',
    'Techno',
    [d(1, 2), d(4, 2), d(1, 2), d(5, 2)],
    'Acid-tinged techno movement',
    'Minor',
  ),

  // Dub Techno (4)
  prog(
    'dub-techno-wash',
    'Dub Techno Wash',
    'Techno',
    [d(1, 4), d(4, 2), d(1, 2)],
    'Minimal dub techno. Basic Channel vibes',
    'Major',
  ),
  prog(
    'dub-chord-drift',
    'Dub Chord Drift',
    'Techno',
    [d(1, 2), b(7, 2), d(1, 2), b(6, 2)],
    'Slow-moving dub techno chords',
    'Minor',
  ),
  prog(
    'deep-dub',
    'Deep Dub',
    'Techno',
    [d(1, 2), d(4, 2), b(7, 2), d(4, 2)],
    'Deep dubby techno',
    'Minor',
  ),
  prog(
    'dub-space',
    'Dub Space',
    'Techno',
    [d(1, 3), d(4), d(1, 3), d(5)],
    'Spacious dub techno with late movement',
    'Major',
  ),
];

// ---------------------------------------------------------------------------
// Trance (10)
// ---------------------------------------------------------------------------

const TRANCE: ChordProgression[] = [
  // Uplifting (4)
  prog(
    'uplifting-classic',
    'Uplifting Classic',
    'Trance',
    [d(1, 2), d(4, 2), d(5, 2), d(1, 2)],
    'Classic uplifting trance resolution',
    'Major',
  ),
  prog(
    'uplifting-anthem',
    'Uplifting Anthem',
    'Trance',
    [d(1), d(5), d(6, 2), d(4, 2), d(1), d(5)],
    'Festival anthem trance. Lingers on the emotional minor',
    'Major',
  ),
  prog(
    'uplifting-emotional',
    'Uplifting Emotional',
    'Trance',
    [d(6, 2), d(4), d(1), d(5, 2), d(6), d(4)],
    'Emotional breakdown into uplifting drop',
    'Major',
  ),
  prog(
    'above-and-beyond',
    'Above & Beyond',
    'Trance',
    [d(1, 2), d(5), d(2, 2), d(4, 2), d(5)],
    'A&B-style emotional trance',
    'Major',
  ),

  // Progressive Trance (2)
  prog(
    'progressive-trance-build',
    'Progressive Trance Build',
    'Trance',
    [d(1, 2), b(7, 2), b(6, 2), b(7, 2)],
    'Slow-building progressive trance',
    'Minor',
  ),
  prog(
    'prog-trance-flow',
    'Prog Trance Flow',
    'Trance',
    [d(1, 2), b(3, 2), b(7, 2), d(1, 2)],
    'Flowing progressive trance movement',
    'Minor',
  ),

  // Psytrance (4)
  prog(
    'psytrance-dark',
    'Psytrance Dark',
    'Trance',
    [d(1, 4), b(2, 4)],
    'Dark phrygian psytrance. Long hypnotic 2-chord cycle',
    'Phrygian',
  ),
  prog(
    'goa-trance',
    'Goa Trance',
    'Trance',
    [d(1, 2), b(7), b(6, 2), d(5, 2), d(1)],
    'Classic Goa trance harmonic minor feel',
    'Harmonic Minor',
  ),
  prog(
    'full-on-psy',
    'Full On Psy',
    'Trance',
    [d(1, 3), q(4, 'major'), d(1, 3), q(4, 'major')],
    'Driving full-on psytrance. Dorian. Late chord hits',
    'Dorian',
  ),
  prog(
    'dark-psy',
    'Dark Psy',
    'Trance',
    [d(1, 2), b(2, 2), b(7, 2), d(1, 2)],
    'Sinister dark psytrance',
    'Phrygian',
  ),
];

// ---------------------------------------------------------------------------
// Drum & Bass (6)
// ---------------------------------------------------------------------------

const DNB: ChordProgression[] = [
  prog(
    'liquid-dnb',
    'Liquid DnB',
    'DnB',
    [d(1, 2), d(6), d(4, 2), d(5, 2), d(6)],
    'Smooth liquid drum & bass',
    'Major',
  ),
  prog(
    'liquid-soul',
    'Liquid Soul',
    'DnB',
    [d(2, 2, '7th'), d(5, 2, '7th'), d(1, 2, '7th'), d(6, 2)],
    'Jazz-influenced liquid DnB',
    'Major',
  ),
  prog(
    'neurofunk-dark',
    'Neurofunk Dark',
    'DnB',
    [d(1, 2), b(6, 2), b(7, 2), d(1, 2)],
    'Dark neurofunk DnB',
    'Minor',
  ),
  prog(
    'dnb-roller',
    'DnB Roller',
    'DnB',
    [d(1, 2), d(4), b(7, 2), b(6), d(4), d(1)],
    'Rolling minimal DnB with passing motion',
    'Minor',
  ),
  prog(
    'jump-up',
    'Jump Up',
    'DnB',
    [d(1, 2), b(6), b(7, 2), d(5, 2), d(1)],
    'Energetic jump-up DnB',
    'Minor',
  ),
  prog(
    'atmospheric-dnb',
    'Atmospheric DnB',
    'DnB',
    [d(1, 2), b(3, 2), b(7, 2), d(4, 2)],
    'Atmospheric / intelligent DnB. Long pads',
    'Minor',
  ),
];

// ---------------------------------------------------------------------------
// Dubstep & Bass Music (5)
// ---------------------------------------------------------------------------

const DUBSTEP: ChordProgression[] = [
  prog(
    'melodic-dubstep',
    'Melodic Dubstep',
    'Dubstep',
    [d(1, 2), b(6), b(3, 2), b(7, 2), b(6)],
    'Melodic dubstep. Seven Lions territory',
    'Minor',
  ),
  prog(
    'future-bass-drop',
    'Future Bass Drop',
    'Dubstep',
    [d(4, 2), d(5), d(6, 2), d(1, 2), d(5)],
    'Future bass chord hit pattern',
    'Major',
  ),
  prog(
    'riddim',
    'Riddim',
    'Dubstep',
    [d(1, 4), b(6, 2), b(7, 2)],
    'Riddim dubstep. Long root then movement',
    'Minor',
  ),
  prog(
    'color-bass',
    'Color Bass',
    'Dubstep',
    [d(1, 2), b(7), d(6, 2), d(4, 2), b(7)],
    'Chromatic color bass movement',
    'Major',
  ),
  prog(
    'tearout',
    'Tearout',
    'Dubstep',
    [d(1, 3), b(2), d(1, 3), d(5)],
    'Heavy tearout dubstep. Asymmetric phrasing',
    'Phrygian',
  ),
];

// ---------------------------------------------------------------------------
// Synthwave & Retro (6)
// ---------------------------------------------------------------------------

const SYNTHWAVE: ChordProgression[] = [
  prog(
    'synthwave-classic',
    'Synthwave Classic',
    'Synthwave',
    [d(1, 2), d(6), d(4, 2), d(5, 2), d(6)],
    'Classic 80s synthwave with extended IV',
    'Major',
  ),
  prog(
    'outrun-chase',
    'Outrun Chase',
    'Synthwave',
    [d(1, 2), b(7), b(6, 2), d(5, 2), b(6)],
    'Driving outrun / retrowave',
    'Minor',
  ),
  prog(
    'darksynth',
    'Darksynth',
    'Synthwave',
    [d(1, 2), b(6, 2), b(7, 2), d(1, 2)],
    'Dark synthwave. Carpenter Brut vibes',
    'Minor',
  ),
  prog(
    'retrowave-sunset',
    'Retrowave Sunset',
    'Synthwave',
    [d(1, 2), d(3), d(6, 2), d(4, 2), d(5)],
    'Nostalgic retrowave',
    'Major',
  ),
  prog(
    'cyberpunk',
    'Cyberpunk',
    'Synthwave',
    [d(1, 2), b(2), b(7, 2), b(6, 2), b(7)],
    'Dystopian cyberpunk synth',
    'Minor',
  ),
  prog(
    'italo-disco',
    'Italo Disco',
    'Synthwave',
    [d(1, 2), d(4), d(5), d(4, 2), d(5), d(1)],
    'Classic italo disco bounce with return',
    'Major',
  ),
];

// ---------------------------------------------------------------------------
// Ambient & Downtempo (6)
// ---------------------------------------------------------------------------

const AMBIENT: ChordProgression[] = [
  prog(
    'ambient-drift',
    'Ambient Drift',
    'Ambient',
    [d(1, 4), d(4, 4)],
    'Slow 2-chord ambient drift. Maximum space',
    'Major',
  ),
  prog(
    'ambient-minor',
    'Ambient Minor',
    'Ambient',
    [d(1, 2), b(7, 2), b(6, 2), d(1, 2)],
    'Dark ambient wash',
    'Minor',
  ),
  prog(
    'downtempo-chill',
    'Downtempo Chill',
    'Ambient',
    [d(2, 2, '7th'), d(5, 2, '7th'), d(1, 2, '7th'), d(4, 2, '7th')],
    'Jazzy downtempo',
    'Major',
  ),
  prog(
    'ambient-drone-shift',
    'Ambient Drone Shift',
    'Ambient',
    [d(1, 6), d(4, 2)],
    'Mostly static with late subtle shift',
    'Major',
  ),
  prog(
    'boards-of-canada',
    'Boards of Canada',
    'Ambient',
    [d(1, 2), d(4, 2), b(7, 2), b(3, 2)],
    'Warp Records style ambient',
    'Minor',
  ),
  prog(
    'chillwave-dream',
    'Chillwave Dream',
    'Ambient',
    [d(1, 2), d(3, 2), d(6, 2), d(1, 2)],
    'Dreamy chillwave',
    'Major',
  ),
];

// ---------------------------------------------------------------------------
// Bach & Baroque (6)
// ---------------------------------------------------------------------------

const BAROQUE: ChordProgression[] = [
  prog(
    'bach-circle-of-fifths',
    'Bach Circle of Fifths',
    'Bach',
    [d(1), d(4), d(7), d(3), d(6), d(2), d(5), d(1)],
    'Complete circle of 5ths. Bach Minuet style',
    'Major',
  ),
  prog(
    'bach-cadence',
    'Bach Cadence',
    'Bach',
    [d(1, 2), d(4, 2), d(5, 2), d(1, 2)],
    'Classical cadence with weight on each chord',
    'Major',
  ),
  prog(
    'bach-descending',
    'Bach Descending',
    'Bach',
    [d(1), d(5), d(6), d(3), d(4), d(1), d(2), d(5)],
    'Baroque descending bass line. Pachelbel Canon',
    'Major',
  ),
  prog(
    'bach-minor',
    'Bach Minor',
    'Bach',
    [d(1, 2), d(4), d(5), d(1, 2), d(4), d(5)],
    'Bach minor cadence with repeated resolution',
    'Harmonic Minor',
  ),
  prog(
    'baroque-passacaglia',
    'Baroque Passacaglia',
    'Bach',
    [d(1), b(7), b(6), d(5), d(1), b(7), b(6), d(5)],
    'Descending baroque sequence. Dramatic',
    'Harmonic Minor',
  ),
  prog(
    'bach-chorale',
    'Bach Chorale',
    'Bach',
    [d(1), d(6), d(2), d(5), d(1), d(4), d(5), d(1)],
    'Chorale-style voice leading. Full 8-bar phrase',
    'Major',
  ),
];

// ---------------------------------------------------------------------------
// Aggregated
// ---------------------------------------------------------------------------

export const PRESET_PROGRESSIONS: ChordProgression[] = [
  ...HOUSE,
  ...TECHNO,
  ...TRANCE,
  ...DNB,
  ...DUBSTEP,
  ...SYNTHWAVE,
  ...AMBIENT,
  ...BAROQUE,
];

/** Stable order for the genre tab strip in the editor UI. */
export const PROGRESSION_GENRES = [
  'House',
  'Techno',
  'Trance',
  'DnB',
  'Dubstep',
  'Synthwave',
  'Ambient',
  'Bach',
] as const;

export type ProgressionGenre = (typeof PROGRESSION_GENRES)[number];

/** Group presets by genre for fast lookup in the UI. */
export function presetsByGenre(): Record<ProgressionGenre, ChordProgression[]> {
  const out: Record<string, ChordProgression[]> = {};
  for (const g of PROGRESSION_GENRES) out[g] = [];
  for (const p of PRESET_PROGRESSIONS) {
    (out[p.genre] ??= []).push(p);
  }
  return out as Record<ProgressionGenre, ChordProgression[]>;
}
