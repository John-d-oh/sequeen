/**
 * Chord progression editor — the "sequencer for chord changes."
 *
 * Layout:
 *   - Header: title + total-bars readout + loop toggle + Play/Pause/Stop
 *   - Preset browser: genre tabs + searchable select, plus user presets
 *   - Timeline: one block per step, width ∝ bar count, current step glowing
 *   - Selected-step inline editor: degree / alteration / quality / chordType / bars
 *   - Bottom row: Add step / Save as custom
 *
 * Real-time: every edit goes through `progressionEngine.updateStep(...)` which
 * mutates the active progression in place. Changes take effect on the next
 * cycle for steps that haven't played yet, or on the next loop for steps
 * already advanced past.
 */

import { useCallback, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useChordProgression } from '../hooks/useChordProgression';
import {
  PRESET_PROGRESSIONS,
  PROGRESSION_GENRES,
  presetsByGenre,
  type ProgressionGenre,
} from '../data/presetProgressions';
import {
  totalBars,
  type ChordProgression,
  type ChordProgressionChordType,
  type ChordProgressionStep,
} from '../engine/chordProgression';
import type { ChordQuality } from '../engine/musicTheory';

const CHORD_TYPES: ChordProgressionChordType[] = [
  'Triad',
  '7th',
  'sus2',
  'sus4',
  '6th',
  'alt1',
  'alt2',
];

const QUALITIES: ChordQuality[] = ['auto', 'major', 'minor', 'diminished', 'augmented'];

/** Roman numeral for display only — case indicates quality intent. */
const BASE_ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

function labelForStep(step: ChordProgressionStep): string {
  const base = BASE_ROMANS[(step.degree - 1) % 7];
  const prefix = step.alteration === -1 ? '♭' : step.alteration === 1 ? '♯' : '';
  const lower = step.quality === 'minor' || step.quality === 'diminished';
  const suffix =
    step.quality === 'diminished' ? '°' : step.quality === 'augmented' ? '+' : '';
  const cased = lower ? base.toLowerCase() : base;
  return `${prefix}${cased}${suffix}`;
}

function isBorrowed(step: ChordProgressionStep): boolean {
  return step.alteration !== 0 || step.quality !== 'auto';
}

export interface ChordProgressionEditorProps {
  /** Collapsed by default — caller controls visibility. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ChordProgressionEditor({
  collapsed,
  onToggleCollapsed,
}: ChordProgressionEditorProps) {
  const { snapshot, load, play, pause, stop, setLoop, updateStep, addStep, removeStep } =
    useChordProgression();
  const customProgressions = useStore((s) => s.customProgressions);
  const saveCustomProgression = useStore((s) => s.saveCustomProgression);
  const bpm = useStore((s) => s.music.bpm);

  const [activeGenre, setActiveGenre] = useState<ProgressionGenre | 'User'>('House');
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');

  const grouped = useMemo(() => presetsByGenre(), []);
  const visiblePresets: ChordProgression[] = useMemo(() => {
    if (activeGenre === 'User') return customProgressions;
    return grouped[activeGenre] ?? [];
  }, [activeGenre, grouped, customProgressions]);

  const total = snapshot.progression ? totalBars(snapshot.progression) : 0;
  // 4 beats per bar, 60 seconds / bpm per beat.
  const estimatedSeconds = total ? (total * 4 * 60) / bpm : 0;

  const onLoadPreset = useCallback(
    (p: ChordProgression) => {
      load(p);
      setSelectedStepIdx(null);
    },
    [load],
  );

  const onSaveAsCustom = useCallback(() => {
    if (!snapshot.progression) return;
    const name = customName.trim() || `Custom ${customProgressions.length + 1}`;
    const id = `user-${Date.now()}`;
    saveCustomProgression({
      ...snapshot.progression,
      id,
      name,
      genre: 'User',
    });
    setCustomName('');
    setActiveGenre('User');
  }, [snapshot.progression, customName, customProgressions.length, saveCustomProgression]);

  // Collapsed mode: just a header bar
  if (collapsed) {
    return (
      <div className="border-t border-b border-slate-800 bg-bg-800/60 px-6 py-2 flex items-center justify-between">
        <button
          onClick={onToggleCollapsed}
          className="text-xs uppercase tracking-wider text-slate-400 hover:text-slate-200 flex items-center gap-2"
        >
          <span>▸</span> Chord Progression
          {snapshot.progression && (
            <span className="text-slate-500 normal-case tracking-normal">
              — {snapshot.progression.name}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 text-xs">
          {snapshot.isPlaying && (
            <span className="text-emerald-400">
              ● step {snapshot.currentStepIdx + 1} / {snapshot.progression?.degrees.length ?? 0}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-b border-slate-800 bg-bg-800/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onToggleCollapsed}
          className="text-sm font-semibold uppercase tracking-wider text-slate-200 hover:text-white flex items-center gap-2"
        >
          <span>▾</span> Chord Progression
          {snapshot.progression && (
            <span className="text-slate-400 font-normal normal-case tracking-normal text-xs">
              — {snapshot.progression.name}
            </span>
          )}
        </button>
        <div className="flex items-center gap-3">
          {snapshot.progression && (
            <span className="text-xs text-slate-400 font-mono">
              {total} bar{total === 1 ? '' : 's'} · ~{estimatedSeconds.toFixed(1)}s @ {bpm} BPM
            </span>
          )}
          <button
            onClick={() => setLoop(!snapshot.loop)}
            className={`text-xs px-3 py-1 rounded border ${
              snapshot.loop
                ? 'bg-sky-600 border-sky-400 text-slate-50'
                : 'bg-bg-900 border-slate-700 text-slate-400 hover:bg-bg-700'
            }`}
            title={snapshot.loop ? 'Loop mode — cycles back to step 1' : 'One-shot mode — stops on last step'}
          >
            {snapshot.loop ? '🔁 loop' : '→ once'}
          </button>
          {snapshot.isPlaying ? (
            <button
              onClick={pause}
              className="text-xs px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
            >
              ❚❚ Pause
            </button>
          ) : (
            <button
              onClick={play}
              disabled={!snapshot.progression}
              className="text-xs px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ▶ Play
            </button>
          )}
          <button
            onClick={stop}
            className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            ■ Stop
          </button>
        </div>
      </div>

      {/* Genre tabs */}
      <div className="flex flex-wrap gap-1 mb-2">
        {PROGRESSION_GENRES.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGenre(g)}
            className={`px-3 py-1 text-xs rounded ${
              activeGenre === g
                ? 'bg-slate-200 text-slate-900'
                : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
            }`}
          >
            {g} ({grouped[g]?.length ?? 0})
          </button>
        ))}
        <button
          onClick={() => setActiveGenre('User')}
          className={`px-3 py-1 text-xs rounded ${
            activeGenre === 'User'
              ? 'bg-amber-500 text-slate-900'
              : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
          }`}
        >
          User ({customProgressions.length})
        </button>
      </div>

      {/* Preset dropdown for the current genre */}
      <div className="mb-3">
        <select
          className="bg-bg-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs w-full"
          value={snapshot.progression?.id ?? ''}
          onChange={(e) => {
            const all = [...PRESET_PROGRESSIONS, ...customProgressions];
            const picked = all.find((p) => p.id === e.target.value);
            if (picked) onLoadPreset(picked);
          }}
        >
          <option value="" disabled>
            Select a preset…
          </option>
          {visiblePresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.description}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      {snapshot.progression && (
        <div className="text-xs text-slate-500 mb-3">{snapshot.progression.description}</div>
      )}

      {/* Timeline */}
      {snapshot.progression && (
        <Timeline
          progression={snapshot.progression}
          currentStepIdx={snapshot.isPlaying ? snapshot.currentStepIdx : -1}
          barInStep={snapshot.barInStep}
          selectedStepIdx={selectedStepIdx}
          onSelectStep={setSelectedStepIdx}
          onRemoveStep={(idx) => {
            removeStep(idx);
            if (selectedStepIdx === idx) setSelectedStepIdx(null);
          }}
        />
      )}

      {/* Current step progress */}
      {snapshot.isPlaying && snapshot.progression && (
        <div className="text-xs text-slate-400 mt-2 font-mono">
          step {snapshot.currentStepIdx + 1} / {snapshot.progression.degrees.length} · bar{' '}
          {snapshot.barInStep} of {snapshot.totalBarsInStep}
        </div>
      )}

      {/* Inline step editor */}
      {snapshot.progression && selectedStepIdx !== null && selectedStepIdx < snapshot.progression.degrees.length && (
        <StepEditor
          step={snapshot.progression.degrees[selectedStepIdx]}
          index={selectedStepIdx}
          onChange={(patch) => updateStep(selectedStepIdx, patch)}
        />
      )}

      {/* Add / save */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={addStep}
          disabled={
            !snapshot.progression || snapshot.progression.degrees.length >= 8
          }
          className="px-3 py-1.5 text-xs bg-bg-700 hover:bg-bg-600 text-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add step
        </button>
        <input
          type="text"
          placeholder="custom name"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          className="flex-1 min-w-0 bg-bg-900 border border-slate-700 rounded px-2 py-1 text-xs"
        />
        <button
          onClick={onSaveAsCustom}
          disabled={!snapshot.progression}
          className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-white text-slate-900 rounded font-semibold disabled:opacity-40"
        >
          Save as custom
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

interface TimelineProps {
  progression: ChordProgression;
  currentStepIdx: number;
  barInStep: number;
  selectedStepIdx: number | null;
  onSelectStep: (idx: number) => void;
  onRemoveStep: (idx: number) => void;
}

function Timeline({
  progression,
  currentStepIdx,
  barInStep,
  selectedStepIdx,
  onSelectStep,
  onRemoveStep,
}: TimelineProps) {
  return (
    <div className="flex gap-0.5 bg-bg-900 border border-slate-700 rounded p-1 h-14">
      {progression.degrees.map((step, idx) => {
        // Proportional width so a 2-bar chord is twice as wide as a 1-bar chord.
        const flex = step.bars;
        const isCurrent = idx === currentStepIdx;
        const isSelected = idx === selectedStepIdx;
        const borrowed = isBorrowed(step);
        const baseColor = borrowed ? '#d97706' : '#0ea5e9'; // amber vs sky
        const bg = isSelected
          ? '#facc15'
          : isCurrent
            ? baseColor
            : `${baseColor}55`;
        const border = isSelected
          ? '#fde047'
          : isCurrent
            ? baseColor
            : `${baseColor}80`;
        const glow = isCurrent ? `0 0 10px ${baseColor}` : 'none';
        return (
          <button
            key={idx}
            onClick={() => onSelectStep(idx)}
            className="relative flex items-center justify-center rounded transition-all min-w-0"
            style={{
              flex,
              background: bg,
              border: `2px solid ${border}`,
              boxShadow: glow,
            }}
            title={`Step ${idx + 1}: ${labelForStep(step)} (${step.bars} bar${step.bars === 1 ? '' : 's'})`}
          >
            <div className="flex flex-col items-center leading-tight">
              <span className="font-semibold text-sm text-slate-100">
                {labelForStep(step)}
              </span>
              <span className="text-[9px] font-mono opacity-75 text-slate-100">
                {step.bars}b
              </span>
            </div>
            {/* Playhead progress bar within the current step */}
            {isCurrent && step.bars > 1 && (
              <div
                className="absolute bottom-0 left-0 h-0.5 bg-slate-100"
                style={{ width: `${(barInStep / step.bars) * 100}%` }}
              />
            )}
            {/* Remove button */}
            {progression.degrees.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveStep(idx);
                }}
                className="absolute top-0.5 right-0.5 text-slate-900/70 hover:text-slate-900 text-xs font-bold w-4 h-4 leading-none flex items-center justify-center rounded-full bg-slate-100/40 hover:bg-slate-100/80 cursor-pointer"
                role="button"
                aria-label="Remove step"
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step editor
// ---------------------------------------------------------------------------

interface StepEditorProps {
  step: ChordProgressionStep;
  index: number;
  onChange: (patch: Partial<ChordProgressionStep>) => void;
}

function StepEditor({ step, index, onChange }: StepEditorProps) {
  return (
    <div className="mt-3 p-3 bg-bg-900 border border-slate-700 rounded">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
        Editing step {index + 1}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-xs">
        {/* Alteration */}
        <span className="text-slate-500">Alteration</span>
        <div className="inline-flex rounded border border-slate-700 overflow-hidden">
          {[
            { v: -1, label: '♭' },
            { v: 0, label: '♮' },
            { v: 1, label: '♯' },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() =>
                onChange({
                  alteration: v,
                  // When returning to natural, coerce quality back to auto.
                  quality: v === 0 ? 'auto' : step.quality === 'auto' ? 'major' : step.quality,
                })
              }
              className={`px-2 py-1 ${
                step.alteration === v
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Degree */}
        <span className="text-slate-500">Degree</span>
        <div className="flex gap-1 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              onClick={() => onChange({ degree: d })}
              className={`px-2 py-1 rounded min-w-[34px] font-semibold ${
                step.degree === d
                  ? 'bg-sky-500 text-slate-900'
                  : 'bg-bg-900 border border-slate-700 text-slate-300 hover:bg-bg-700'
              }`}
            >
              {BASE_ROMANS[d - 1]}
            </button>
          ))}
        </div>

        {/* Quality (only meaningful for altered chords) */}
        {step.alteration !== 0 && (
          <>
            <span className="text-slate-500">Quality</span>
            <select
              value={step.quality}
              onChange={(e) => onChange({ quality: e.target.value as ChordQuality })}
              className="bg-bg-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
            >
              {QUALITIES.filter((q) => q !== 'auto').map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </>
        )}

        {/* Chord type */}
        <span className="text-slate-500">Chord type</span>
        <select
          value={step.chordType}
          onChange={(e) =>
            onChange({ chordType: e.target.value as ChordProgressionChordType })
          }
          className="bg-bg-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
        >
          {CHORD_TYPES.map((ct) => (
            <option key={ct} value={ct}>
              {ct}
            </option>
          ))}
        </select>

        {/* Bars */}
        <span className="text-slate-500">Bars</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={8}
            value={step.bars}
            onChange={(e) => onChange({ bars: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="font-mono text-slate-200 w-6 text-right">{step.bars}</span>
        </div>
      </div>
    </div>
  );
}
