import {
  getDegreeRomanNumeral,
  getScaleDegreeChordSonority,
  getChordRootPitchClass,
  type ChordQuality,
} from '../engine/musicTheory';

export interface ChordButtonProps {
  key_: string;
  mode: string;
  degree: number;
  alteration: number;
  chordQuality: ChordQuality;
  isActive: boolean;
  onClick: () => void;
}

const SONORITY_BG: Record<ReturnType<typeof getScaleDegreeChordSonority>, string> = {
  major: 'bg-sky-900/40 hover:bg-sky-800/60 border-sky-700',
  minor: 'bg-violet-900/40 hover:bg-violet-800/60 border-violet-700',
  diminished: 'bg-rose-900/40 hover:bg-rose-800/60 border-rose-700',
};

const SONORITY_ACTIVE: Record<ReturnType<typeof getScaleDegreeChordSonority>, string> = {
  major: 'bg-sky-500 text-slate-900 border-sky-300',
  minor: 'bg-violet-500 text-slate-900 border-violet-300',
  diminished: 'bg-rose-500 text-slate-900 border-rose-300',
};

// Borrowed-chord styling: amber-on-amber to stand out from the diatonic buttons.
const BORROWED_BG = 'bg-amber-900/40 hover:bg-amber-800/60 border-amber-600';
const BORROWED_ACTIVE = 'bg-amber-500 text-slate-900 border-amber-300';

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Produce a display label for a chord button given the current alteration.
 * Examples: `I`, `ii`, `vii°`, `bVII`, `#iv°`, `bII` (Neapolitan).
 */
function labelFor(mode: string, degree: number, alteration: number, quality: ChordQuality): string {
  if (alteration === 0 && quality === 'auto') {
    return getDegreeRomanNumeral(mode, degree);
  }
  const base = (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const)[(degree - 1) % 7];
  const prefix = alteration === -1 ? 'b' : alteration === 1 ? '#' : '';
  switch (quality) {
    case 'minor':
      return `${prefix}${base.toLowerCase()}`;
    case 'diminished':
      return `${prefix}${base.toLowerCase()}°`;
    case 'augmented':
      return `${prefix}${base}+`;
    default:
      return `${prefix}${base}`;
  }
}

/** Pitch-class → display name, using flat spellings when alteration is flat. */
function rootName(pc: number, alteration: number): string {
  return (alteration === -1 ? FLAT_PC_NAMES : PC_NAMES)[pc];
}

export function ChordButton({
  key_,
  mode,
  degree,
  alteration,
  chordQuality,
  isActive,
  onClick,
}: ChordButtonProps) {
  const isBorrowed = alteration !== 0 || chordQuality !== 'auto';
  const sonority = getScaleDegreeChordSonority(mode, degree);
  const label = labelFor(mode, degree, alteration, chordQuality);
  const rootPc = getChordRootPitchClass(key_, mode, degree, alteration, chordQuality);
  const root = rootName(rootPc, alteration);

  const classes = isBorrowed
    ? isActive
      ? BORROWED_ACTIVE
      : BORROWED_BG
    : isActive
      ? SONORITY_ACTIVE[sonority]
      : SONORITY_BG[sonority];

  const title = isBorrowed
    ? `Borrowed ${label} — root ${root}`
    : `Degree ${degree} — ${sonority}`;

  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 min-w-[56px] rounded-md border-2 font-semibold transition-all flex flex-col items-center leading-tight ${classes}`}
      title={title}
    >
      <span className="text-lg">{label}</span>
      <span className="text-[10px] opacity-80 font-mono">{root}</span>
    </button>
  );
}
