import { useCallback, useEffect, useState } from 'react';
import { KEYS, MODES, getDegreeRomanNumeral, getChordRootPitchClass } from './engine/musicTheory';
import { useStore, CHORD_TYPES_UI, PART_LIST, type ChordTypeName } from './store';
import {
  initAppEngines,
  midiPortManager,
  sequeenEngine,
} from './engine/appEngines';
import type { OutputInfo } from './engine/midiOutput';
import type { PartName } from './engine/transport';

import { PartPanel } from './components/PartPanel';
import { ChordButton } from './components/ChordButton';
import { BeatIndicator } from './components/BeatIndicator';
import { PadPanelBody } from './components/PadPanelBody';
import { DronePanelBody } from './components/DronePanelBody';
import { MotifPanelBody } from './components/MotifPanelBody';
import { PatternEditor } from './components/PatternEditor';
import { RhythmEditor } from './components/RhythmEditor';
import { ErrorBanner } from './components/ErrorBanner';
import { ChordProgressionEditor } from './components/ChordProgressionEditor';
import { HelpOverlay } from './components/HelpOverlay';

// Synthwave palette — cyan / magenta / violet / amber.
// Roles per the design spec: Pad = cyan (sustained chords),
// Drone = magenta (low pedal tones), Motif 1 = violet (upper arpeggio),
// Motif 2 = amber (bassline). Hexes match the `--cy`, `--mag`, `--vi`,
// `--am` CSS variables in index.css so inline styles + CSS stay in sync.
const ACCENT: Record<PartName, string> = {
  pad: '#00D9FF',
  drone: '#FF2BD6',
  motif1: '#B56BFF',
  motif2: '#FFB547',
};

const PART_TITLE: Record<PartName, string> = {
  pad: 'PAD',
  drone: 'DRONE',
  motif1: 'MOTIF 1',
  motif2: 'MOTIF 2',
};

/** Live MIDI status + output list, polled from the singleton manager. */
function useMidiSnapshot() {
  const [ports, setPorts] = useState<OutputInfo[]>([]);
  const [status, setStatus] = useState(midiPortManager.status);
  const [error, setError] = useState(midiPortManager.error);

  useEffect(() => {
    let cancelled = false;
    void initAppEngines().then(() => {
      if (cancelled) return;
      setStatus(midiPortManager.status);
      setError(midiPortManager.error);
    });
    const off = midiPortManager.onOutputsChanged((p) => setPorts(p));
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return { ports, status, error };
}

export default function App() {
  const music = useStore((s) => s.music);
  const setKey = useStore((s) => s.setKey);
  const setMode = useStore((s) => s.setMode);
  const setDegree = useStore((s) => s.setDegree);
  const setAlteration = useStore((s) => s.setAlteration);
  const setChordQuality = useStore((s) => s.setChordQuality);
  const setChordType = useStore((s) => s.setChordType);
  const setBpm = useStore((s) => s.setBpm);
  const transport = useStore((s) => s.transport);
  const togglePart = useStore((s) => s.togglePart);
  const toggleGlobalPlay = useStore((s) => s.toggleGlobalPlay);

  const { ports, status, error } = useMidiSnapshot();
  const connectedCount = ports.filter((p) => p.state === 'connected').length;

  // Display label for the current chord — includes alteration prefix for borrowed chords.
  const isBorrowed = music.alteration !== 0 || music.chordQuality !== 'auto';
  const roman = (() => {
    if (!isBorrowed) return getDegreeRomanNumeral(music.mode, music.degree);
    const base = (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const)[(music.degree - 1) % 7];
    const prefix = music.alteration === -1 ? '♭' : music.alteration === 1 ? '♯' : '';
    const lower = music.chordQuality === 'minor' || music.chordQuality === 'diminished';
    const suffix = music.chordQuality === 'diminished' ? '°' : music.chordQuality === 'augmented' ? '+' : '';
    return `${prefix}${lower ? base.toLowerCase() : base}${suffix}`;
  })();
  // Root note name so the header shows "bVII Bb Triad" clearly.
  const chordRootPc = getChordRootPitchClass(
    music.key,
    music.mode,
    music.degree,
    music.alteration,
    music.chordQuality,
  );
  const chordRootName = (music.alteration === -1
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])[chordRootPc];

  // Chord progression editor collapse state.
  const [progressionCollapsed, setProgressionCollapsed] = useState(true);

  // Help overlay. `?` opens it anywhere (unless a text input has focus).
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Respect text-input focus so typing `?` in a search field doesn't hijack.
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Pattern/Rhythm editor modal state.
  const [editor, setEditor] = useState<
    | { kind: 'pattern' | 'rhythm'; partId: 'motif1' | 'motif2' }
    | null
  >(null);
  const openPatternEditor = useCallback(
    (partId: 'motif1' | 'motif2') => setEditor({ kind: 'pattern', partId }),
    [],
  );
  const openRhythmEditor = useCallback(
    (partId: 'motif1' | 'motif2') => setEditor({ kind: 'rhythm', partId }),
    [],
  );
  const closeEditor = useCallback(() => setEditor(null), []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore while typing into inputs, textareas, or selects.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (target?.isContentEditable) return;

      // Space → toggle global play/pause.
      if (e.code === 'Space') {
        e.preventDefault();
        toggleGlobalPlay();
        return;
      }
      // 1–7 → chord degrees I–VII.
      if (/^[1-7]$/.test(e.key)) {
        setDegree(Number(e.key));
        return;
      }
      // P → panic.
      if (e.key.toLowerCase() === 'p') {
        sequeenEngine.panic();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleGlobalPlay, setDegree]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-900 text-slate-200">
      {/* TOP BAR — brand, permanent "now playing" readout, MIDI status, help */}
      <div className="glass flex items-center justify-between gap-6 px-5 py-3 sticky top-0 z-30">
        {/* Brand mark — conic-gradient badge + Space Grotesk italic wordmark
            with chrome gradient. Restraint is what makes it read as
            designed rather than nostalgic. */}
        <a
          href="#top"
          className="flex items-center gap-3 shrink-0 group focus:outline-none"
          onClick={(e) => e.preventDefault()}
          aria-label="Sequeen"
        >
          <SequeenLogo />
          <span
            className="font-display italic font-bold text-[26px] leading-none tracking-[-0.02em] select-none"
            style={{
              backgroundImage:
                'linear-gradient(180deg, #F6EEFF 0%, #CFC3F0 32%, #6A5FA0 64%, #1A1631 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              textShadow: '0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            Sequeen
          </span>
        </a>

        {/* Now-playing readout — always visible so you know key / chord / tempo
            without looking at the transport bar or the header. Monospace
            numerals keep it from dancing when values change. */}
        <div className="flex items-center gap-5 flex-1 min-w-0 justify-center">
          <NowPlayingReadout
            label="Key"
            value={`${music.key} ${music.mode}`}
          />
          <div className="w-px h-5 bg-slate-700" />
          <NowPlayingReadout
            label="Chord"
            value={`${roman} ${chordRootName}`}
            accent={isBorrowed ? '#FFB547' : '#5CE8FF'}
          />
          <div className="w-px h-5 bg-slate-700" />
          <NowPlayingReadout label="Tempo" value={`${music.bpm} BPM`} />
        </div>

        {/* MIDI status + help */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <StatusDot status={status} />
            <span className="type-label text-slate-400 hidden md:inline">
              {status === 'ready'
                ? `${connectedCount} out${connectedCount === 1 ? '' : 's'}`
                : status === 'loading'
                  ? 'MIDI…'
                  : 'MIDI off'}
            </span>
          </div>
          <button
            onClick={() => setHelpOpen(true)}
            className="w-7 h-7 rounded-full border border-slate-600 text-slate-400 hover:text-slate-100 hover:border-slate-400 hover:bg-bg-700 flex items-center justify-center text-sm font-semibold"
            aria-label="Open keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>
        </div>
      </div>

      {/* ERROR BANNER (only when MIDI isn't usable) */}
      <ErrorBanner status={status} error={error} outputCount={connectedCount} />

      {/* HEADER */}
      <div className="px-6 py-4 border-b border-edge-subtle">
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Key">
            <select
              value={music.key}
              onChange={(e) => setKey(e.target.value)}
              className="sunken text-slate-100 px-2.5 py-1.5 text-sm focus:outline-none"
            >
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mode">
            <select
              value={music.mode}
              onChange={(e) => setMode(e.target.value)}
              className="sunken text-slate-100 px-2.5 py-1.5 text-sm focus:outline-none"
            >
              {Object.keys(MODES).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="BPM">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBpm(music.bpm - 1)}
                className="chip rounded-md w-7 h-7 text-sm leading-none hover:brightness-110"
              >
                −
              </button>
              <input
                type="number"
                min={10}
                max={300}
                value={music.bpm}
                onChange={(e) => setBpm(Number(e.target.value) || music.bpm)}
                className="sunken w-16 text-center py-1.5 text-sm font-mono text-slate-100 focus:outline-none"
              />
              <button
                onClick={() => setBpm(music.bpm + 1)}
                className="chip rounded-md w-7 h-7 text-sm leading-none hover:brightness-110"
              >
                +
              </button>
            </div>
          </Field>
          <Field label="Current Chord">
            <div
              className="font-mono text-lg"
              style={{ color: isBorrowed ? '#FFB547' : '#5CE8FF' }}
            >
              {roman}{' '}
              <span className="text-slate-300">{chordRootName}</span>{' '}
              <span className="text-slate-500 text-xs uppercase">{music.chordType}</span>
              {isBorrowed && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-400">
                  borrowed
                </span>
              )}
            </div>
          </Field>
        </div>
      </div>

      {/* CHORD BUTTONS */}
      <div className="px-6 py-5 border-b border-edge-subtle flex flex-col items-center gap-3">
        {/* Alteration modifiers + degree buttons */}
        <div className="flex flex-wrap gap-2 justify-center items-stretch">
          {/* b / natural / # sticky modifier pills */}
          <div className="inline-flex rounded-xl chip p-0.5 self-center gap-0.5">
            <button
              onClick={() => setAlteration(-1)}
              className={`px-2.5 py-2 font-semibold text-lg min-w-[34px] rounded-lg ${
                music.alteration === -1
                  ? 'text-slate-900'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              style={
                music.alteration === -1
                  ? {
                      background:
                        'linear-gradient(180deg, #fb923c 0%, #f97316 100%)',
                      boxShadow: '0 0 10px -2px #fb923c99',
                    }
                  : undefined
              }
              title="Flat modifier — flattens the next chord root (bII, bIII, bVI, bVII)"
            >
              ♭
            </button>
            <button
              onClick={() => setAlteration(0)}
              className={`px-2.5 py-2 font-semibold text-sm min-w-[34px] rounded-lg ${
                music.alteration === 0
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              title="Natural — diatonic chord"
            >
              ♮
            </button>
            <button
              onClick={() => setAlteration(1)}
              className={`px-2.5 py-2 font-semibold text-lg min-w-[34px] rounded-lg ${
                music.alteration === 1
                  ? 'text-slate-900'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              style={
                music.alteration === 1
                  ? {
                      background:
                        'linear-gradient(180deg, #fb923c 0%, #f97316 100%)',
                      boxShadow: '0 0 10px -2px #fb923c99',
                    }
                  : undefined
              }
              title="Sharp modifier — raises the next chord root (#IV, #V)"
            >
              ♯
            </button>
          </div>

          {[1, 2, 3, 4, 5, 6, 7].map((deg) => (
            <ChordButton
              key={deg}
              key_={music.key}
              mode={music.mode}
              degree={deg}
              alteration={music.alteration}
              chordQuality={music.chordQuality}
              isActive={music.degree === deg}
              onClick={() => setDegree(deg)}
            />
          ))}
        </div>

        {/* Chord type row */}
        <div className="flex gap-1 text-xs">
          {CHORD_TYPES_UI.map((ct) => (
            <button
              key={ct}
              onClick={() => setChordType(ct as ChordTypeName)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wide ${
                music.chordType === ct
                  ? 'bg-slate-100 text-slate-900'
                  : 'chip text-slate-300 hover:text-slate-100 hover:brightness-110'
              }`}
            >
              {ct}
            </button>
          ))}
        </div>

        {/* Quality override row — only visible for borrowed chords */}
        {music.alteration !== 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-amber-400">
              Borrowed quality
            </span>
            <div className="inline-flex rounded border border-amber-600 overflow-hidden">
              {(['major', 'minor', 'diminished', 'augmented'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setChordQuality(q)}
                  className={`px-3 py-1 ${
                    music.chordQuality === q
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-bg-900 text-slate-300 hover:bg-bg-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CHORD PROGRESSION EDITOR */}
      <ChordProgressionEditor
        collapsed={progressionCollapsed}
        onToggleCollapsed={() => setProgressionCollapsed((v) => !v)}
      />

      {/* PART GRID
          Two rows: Pad + Drone on top (compact, side-by-side), Motif 1 +
          Motif 2 below (full size). Pad and Drone have far fewer controls
          than the motifs so a horizontal-internal-layout works for them
          and they end up significantly shorter than the motif panels. */}
      <main className="flex-1 p-6 flex flex-col gap-6 min-h-0">
        {/* Compact row — Pad + Drone */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PartPanel
            partId="pad"
            title={PART_TITLE.pad}
            accentHex={ACCENT.pad}
            status={transport.parts.pad}
            onToggle={() => togglePart('pad')}
          >
            <PadPanelBody ports={ports} />
          </PartPanel>

          <PartPanel
            partId="drone"
            title={PART_TITLE.drone}
            accentHex={ACCENT.drone}
            status={transport.parts.drone}
            onToggle={() => togglePart('drone')}
          >
            <DronePanelBody ports={ports} />
          </PartPanel>
        </div>

        {/* Full row — Motif 1 + Motif 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PartPanel
            partId="motif1"
            title={PART_TITLE.motif1}
            accentHex={ACCENT.motif1}
            status={transport.parts.motif1}
            onToggle={() => togglePart('motif1')}
          >
            <MotifPanelBody
              partId="motif1"
              accent={ACCENT.motif1}
              ports={ports}
              onEditPattern={openPatternEditor}
              onEditRhythm={openRhythmEditor}
            />
          </PartPanel>

          <PartPanel
            partId="motif2"
            title={PART_TITLE.motif2}
            accentHex={ACCENT.motif2}
            status={transport.parts.motif2}
            onToggle={() => togglePart('motif2')}
          >
            <MotifPanelBody
              partId="motif2"
              accent={ACCENT.motif2}
              ports={ports}
              onEditPattern={openPatternEditor}
              onEditRhythm={openRhythmEditor}
            />
          </PartPanel>
        </div>
      </main>

      {/* TRANSPORT BAR — synthwave finish:
            - PLAY ALL  : mint --g-play gradient + ok-tinted glow
            - STOP ALL  : siren red gradient + siren glow
            - PANIC     : siren-coloured chip
            - Activity  : per-part dots with scale-pulse keyframe + accent glow
            - BPM       : large mono value with the warn-orange "REC" cue
                          when global play is on. */}
      <div
        className="glass px-6 py-3 flex items-center justify-between sticky bottom-0 z-30"
        style={{ borderTop: '1px solid var(--edge)', borderBottom: 'none' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGlobalPlay}
            className="px-5 py-2 rounded-xl font-semibold text-sm tracking-wide active:scale-[0.97] transition-[filter,transform,box-shadow] duration-120 ease-ui hover:brightness-110"
            style={
              transport.globalPlaying
                ? {
                    background:
                      'linear-gradient(180deg, #FF4E6B 0%, #c91839 100%)',
                    color: '#1a0205',
                    boxShadow:
                      '0 0 22px -2px rgba(255,78,107,0.55), inset 0 1px 0 rgba(255,255,255,0.28)',
                  }
                : {
                    background: 'var(--g-play)',
                    color: '#03130c',
                    boxShadow:
                      '0 0 22px -2px rgba(78,240,193,0.55), inset 0 1px 0 rgba(255,255,255,0.32)',
                  }
            }
          >
            {transport.globalPlaying ? '■ STOP ALL' : '▶ PLAY ALL'}
          </button>
          <button
            onClick={() => sequeenEngine.panic()}
            className="chip px-3 py-2 rounded-xl text-xs font-bold tracking-wide hover:brightness-110"
            style={{
              color: '#FF4E6B',
              borderColor: 'rgba(255,78,107,0.45)',
            }}
            title="All notes off, all channels, all ports (P)"
          >
            PANIC
          </button>
        </div>

        <div className="flex items-center gap-4">
          {PART_LIST.map((p) => {
            const status = transport.parts[p];
            const isPlaying = status === 'playing';
            const isArmed = status === 'armed';
            return (
              <div key={p} className="flex items-center gap-1.5 text-lbl">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isPlaying ? 'animate-pulse' : ''
                  }`}
                  style={{
                    background: isPlaying
                      ? ACCENT[p]
                      : isArmed
                        ? '#FFB547'
                        : 'transparent',
                    border:
                      status === 'stopped' ? '1px solid var(--edge-2)' : 'none',
                    boxShadow: isPlaying
                      ? `0 0 12px ${ACCENT[p]}, 0 0 4px ${ACCENT[p]}`
                      : isArmed
                        ? '0 0 8px rgba(255,181,71,0.7)'
                        : 'none',
                  }}
                />
                <span
                  className="font-mono"
                  style={{
                    color: isPlaying ? ACCENT[p] : 'var(--fg-mute)',
                    textShadow: isPlaying ? `0 0 8px ${ACCENT[p]}66` : undefined,
                  }}
                >
                  {PART_TITLE[p]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <BeatIndicator
            currentBeat={transport.currentBeat}
            isPlaying={transport.globalPlaying}
          />
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-mono font-semibold text-[20px] tabular-nums leading-none"
              style={{
                color: transport.globalPlaying ? '#5CE8FF' : 'var(--fg)',
                textShadow: transport.globalPlaying
                  ? '0 0 14px rgba(0,217,255,0.6)'
                  : undefined,
              }}
            >
              {music.bpm}
            </span>
            <span className="text-lbl text-fg-mute">BPM</span>
          </div>
        </div>
      </div>

      {/* Editor modals */}
      {editor?.kind === 'pattern' && (
        <PatternEditor partId={editor.partId} onClose={closeEditor} />
      )}
      {editor?.kind === 'rhythm' && (
        <RhythmEditor partId={editor.partId} onClose={closeEditor} />
      )}

      {/* Help overlay — opened by `?` or the help button in the top bar. */}
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/**
 * Brand badge — a conic-gradient ring (the synthwave palette spinning
 * around the circumference) framing four sequencer-step bars in dark ink.
 *
 * The conic ring is rendered as a circle with the `--g-brand-ring` gradient
 * as its background; an inner ink-colored circle "punches" the centre so
 * only the rim of the gradient remains visible. The four bars inside read
 * both as a waveform glyph and as the four Sequeen parts.
 */
function SequeenLogo() {
  return (
    <span
      className="relative inline-flex shrink-0"
      style={{ width: 32, height: 32 }}
      aria-hidden
    >
      {/* Conic-gradient ring */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: 'var(--g-brand-ring)',
          padding: 1.5,
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
        }}
      />
      {/* Inner glyph */}
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        className="relative"
      >
        <defs>
          <linearGradient id="seqGlyphFg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF2BD6" />
            <stop offset="50%" stopColor="#B56BFF" />
            <stop offset="100%" stopColor="#00D9FF" />
          </linearGradient>
        </defs>
        {/* Four bars — sequencer steps that also read as a waveform */}
        <rect x={8.5} y={18} width={2.4} height={7} rx={1} fill="url(#seqGlyphFg)" />
        <rect x={12.5} y={13} width={2.4} height={12} rx={1} fill="url(#seqGlyphFg)" />
        <rect x={16.5} y={9} width={2.4} height={16} rx={1} fill="url(#seqGlyphFg)" />
        <rect x={20.5} y={15} width={2.4} height={10} rx={1} fill="url(#seqGlyphFg)" />
      </svg>
    </span>
  );
}

/** Pill used in the top bar for the permanent now-playing readout. */
function NowPlayingReadout({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="type-label text-slate-500">{label}</span>
      <span
        className="type-value truncate"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ready' ? '#22c55e' : status === 'loading' ? '#f59e0b' : '#ef4444';
  return (
    <span
      className={`w-2 h-2 rounded-full ${status === 'ready' ? 'sequeen-pulse' : ''}`}
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      aria-label={`MIDI ${status}`}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-slate-500">{label}</label>
      {children}
    </div>
  );
}
