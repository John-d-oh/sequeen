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

/**
 * Sonority → accent hue. Cyan reads as "stable / consonant" for major,
 * fuchsia for minor adds energy without being aggressive, rose for
 * diminished signals tension. Borrowed chords break out with the warm
 * amber + sunset gradient on active.
 */
const SONORITY_ACCENT: Record<
  ReturnType<typeof getScaleDegreeChordSonority>,
  string
> = {
  major: '#00D9FF',       // cyan
  minor: '#FF2BD6',       // fuchsia
  diminished: '#FF4E6B',  // siren / rose
};
const BORROWED_ACCENT = '#FFB547'; // amber

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function labelFor(mode: string, degree: number, alteration: number, quality: ChordQuality): string {
  if (alteration === 0 && quality === 'auto') {
    return getDegreeRomanNumeral(mode, degree);
  }
  const base = (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const)[(degree - 1) % 7];
  const prefix = alteration === -1 ? '♭' : alteration === 1 ? '♯' : '';
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
  const accent = isBorrowed ? BORROWED_ACCENT : SONORITY_ACCENT[sonority];
  const label = labelFor(mode, degree, alteration, chordQuality);
  const rootPc = getChordRootPitchClass(key_, mode, degree, alteration, chordQuality);
  const root = rootName(rootPc, alteration);

  // Idle: subtle accent-tinted gradient with the accent as the text color.
  const idleStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${accent}1c 0%, ${accent}06 100%)`,
    borderColor: `${accent}55`,
    color: accent,
  };

  // Active diatonic: deep cyan-tinted gradient + accent border + glow.
  // Active borrowed: SAME pattern but with the sunset gradient as the
  // border (using the padding-box / border-box CSS trick) so borrowed
  // chords are visually unmistakable.
  const activeDiatonicStyle: React.CSSProperties = {
    background:
      `radial-gradient(80% 120% at 50% 0%, ${accent}38, transparent 60%), linear-gradient(180deg, #12203A 0%, #0A0816 100%)`,
    borderColor: accent,
    color: '#E9E4FF',
    boxShadow: `0 0 22px -4px ${accent}aa, inset 0 1px 0 rgba(255,255,255,0.08)`,
  };

  const activeBorrowedStyle: React.CSSProperties = {
    background:
      `linear-gradient(180deg, rgba(26,22,49,0.92), rgba(10,8,22,0.92)) padding-box, var(--g-sunset) border-box`,
    border: '2px solid transparent',
    color: '#FFB547',
    boxShadow: `0 0 24px -4px ${accent}cc, inset 0 1px 0 rgba(255,255,255,0.1)`,
  };

  const style = !isActive
    ? idleStyle
    : isBorrowed
      ? activeBorrowedStyle
      : activeDiatonicStyle;

  const title = isBorrowed
    ? `Borrowed ${label} — root ${root}`
    : `Degree ${degree} — ${sonority}`;

  return (
    <button
      onClick={onClick}
      className="px-3.5 py-2 min-w-[60px] rounded-2xl border-2 font-semibold flex flex-col items-center leading-tight hover:brightness-110 active:scale-[0.97] transition-[filter,transform,box-shadow] duration-120 ease-ui"
      style={style}
      title={title}
    >
      <span className="font-display text-[18px] tracking-tight">{label}</span>
      <span
        className={`text-[10px] font-mono mt-0.5 ${isActive ? 'opacity-75' : 'opacity-80'}`}
      >
        {root}
      </span>
    </button>
  );
}
