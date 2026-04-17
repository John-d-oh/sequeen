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

const ACCENT: Record<PartName, string> = {
  pad: '#38bdf8',
  drone: '#a855f7',
  motif1: '#22c55e',
  motif2: '#f59e0b',
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
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-bg-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-widest">SEQUEEN</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <StatusDot status={status} />
          <span className="text-slate-400">
            {status === 'ready'
              ? `${connectedCount} MIDI output${connectedCount === 1 ? '' : 's'} available`
              : status === 'loading'
                ? 'Initialising MIDI…'
                : error ?? 'MIDI unavailable'}
          </span>
        </div>
      </div>

      {/* ERROR BANNER (only when MIDI isn't usable) */}
      <ErrorBanner status={status} error={error} outputCount={connectedCount} />

      {/* HEADER */}
      <div className="px-6 py-4 border-b border-slate-800 bg-bg-800/60">
        <div className="flex flex-wrap items-end gap-6">
          <Field label="Key">
            <select
              value={music.key}
              onChange={(e) => setKey(e.target.value)}
              className="bg-bg-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-sm"
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
              className="bg-bg-900 border border-slate-700 text-slate-100 rounded px-2 py-1 text-sm"
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
                className="bg-slate-700 hover:bg-slate-600 rounded w-6 h-6 text-xs"
              >
                −
              </button>
              <input
                type="number"
                min={10}
                max={300}
                value={music.bpm}
                onChange={(e) => setBpm(Number(e.target.value) || music.bpm)}
                className="w-16 bg-bg-900 border border-slate-700 text-center rounded py-1 text-sm font-mono"
              />
              <button
                onClick={() => setBpm(music.bpm + 1)}
                className="bg-slate-700 hover:bg-slate-600 rounded w-6 h-6 text-xs"
              >
                +
              </button>
            </div>
          </Field>
          <Field label="Current Chord">
            <div
              className="font-mono text-lg"
              style={{ color: isBorrowed ? '#fbbf24' : '#7dd3fc' }}
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
      <div className="px-6 py-4 border-b border-slate-800 bg-bg-800/40 flex flex-col items-center gap-3">
        {/* Alteration modifiers + degree buttons */}
        <div className="flex flex-wrap gap-2 justify-center items-stretch">
          {/* b / natural / # sticky modifier pills */}
          <div className="inline-flex rounded-md border-2 border-slate-700 overflow-hidden self-center">
            <button
              onClick={() => setAlteration(-1)}
              className={`px-3 py-2 font-semibold text-lg min-w-[40px] ${
                music.alteration === -1
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
              }`}
              title="Flat modifier — flattens the next chord root (bII, bIII, bVI, bVII)"
            >
              ♭
            </button>
            <button
              onClick={() => setAlteration(0)}
              className={`px-3 py-2 font-semibold text-xs min-w-[40px] ${
                music.alteration === 0
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
              }`}
              title="Natural — diatonic chord"
            >
              ♮
            </button>
            <button
              onClick={() => setAlteration(1)}
              className={`px-3 py-2 font-semibold text-lg min-w-[40px] ${
                music.alteration === 1
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
              }`}
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
              className={`px-3 py-1 rounded border ${
                music.chordType === ct
                  ? 'bg-slate-200 text-slate-900 border-slate-100'
                  : 'bg-bg-900 border-slate-700 text-slate-300 hover:bg-bg-700'
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

      {/* PART GRID */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        <PartPanel
          title={PART_TITLE.pad}
          color="sky"
          accentHex={ACCENT.pad}
          status={transport.parts.pad}
          onToggle={() => togglePart('pad')}
        >
          <PadPanelBody ports={ports} />
        </PartPanel>

        <PartPanel
          title={PART_TITLE.motif1}
          color="green"
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
          title={PART_TITLE.drone}
          color="violet"
          accentHex={ACCENT.drone}
          status={transport.parts.drone}
          onToggle={() => togglePart('drone')}
        >
          <DronePanelBody ports={ports} />
        </PartPanel>

        <PartPanel
          title={PART_TITLE.motif2}
          color="amber"
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
      </main>

      {/* TRANSPORT BAR */}
      <div className="px-6 py-3 border-t border-slate-800 bg-bg-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGlobalPlay}
            className={`px-4 py-2 rounded font-semibold text-sm transition-colors ${
              transport.globalPlaying
                ? 'bg-rose-500 hover:bg-rose-600 text-slate-900'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-900'
            }`}
          >
            {transport.globalPlaying ? '■ STOP ALL' : '▶ PLAY ALL'}
          </button>
          <button
            onClick={() => sequeenEngine.panic()}
            className="px-3 py-2 rounded text-xs font-semibold bg-red-900 hover:bg-red-800 text-red-100 border border-red-700"
            title="All notes off, all channels, all ports"
          >
            PANIC
          </button>
        </div>

        <div className="flex items-center gap-3">
          {PART_LIST.map((p) => (
            <div key={p} className="flex items-center gap-1 text-[11px] uppercase">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background:
                    transport.parts[p] === 'playing'
                      ? ACCENT[p]
                      : transport.parts[p] === 'armed'
                        ? '#f59e0b'
                        : '#334155',
                  boxShadow: transport.parts[p] === 'playing' ? `0 0 6px ${ACCENT[p]}` : 'none',
                }}
              />
              <span className="text-slate-400">{PART_TITLE[p]}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <BeatIndicator currentBeat={transport.currentBeat} isPlaying={transport.globalPlaying} />
          <div className="font-mono text-sm text-slate-300">{music.bpm} BPM</div>
        </div>
      </div>

      {/* Editor modals */}
      {editor?.kind === 'pattern' && (
        <PatternEditor partId={editor.partId} onClose={closeEditor} />
      )}
      {editor?.kind === 'rhythm' && (
        <RhythmEditor partId={editor.partId} onClose={closeEditor} />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ready' ? '#22c55e' : status === 'loading' ? '#f59e0b' : '#ef4444';
  return (
    <span
      className="w-2 h-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
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
