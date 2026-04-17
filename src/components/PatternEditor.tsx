import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore, USER_PRESET_SLOTS } from '../store';
import { Modal } from './Modal';
import { PRESET_PATTERNS, type MotifPatternPreset } from '../data/presetPatterns';
import type { MotifPatternType } from '../engine/parts/motif';

/**
 * Visual cap for the vertical pattern bars. Pattern values are 1-based
 * indices into the current note pool; at 16 the column height gives enough
 * headroom for most musically useful values without shrinking bars to
 * illegibility. Users can still set higher values via the number input.
 */
const BAR_MAX = 16;
const COLUMN_HEIGHT = 180;

export interface PatternEditorProps {
  partId: 'motif1' | 'motif2';
  onClose: () => void;
}

export function PatternEditor({ partId, onClose }: PatternEditorProps) {
  const motif = useStore((s) => (partId === 'motif1' ? s.motif1 : s.motif2));
  const setParam = useStore((s) =>
    partId === 'motif1' ? s.setMotif1Param : s.setMotif2Param,
  );
  const userPatterns = useStore((s) => s.userPatterns);
  const saveUserPattern = useStore((s) => s.saveUserPattern);

  const [selected, setSelected] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [saveSlot, setSaveSlot] = useState(0);

  const accent = partId === 'motif1' ? '#22c55e' : '#f59e0b';

  const updateStep = useCallback(
    (idx: number, value: number) => {
      const clamped = Math.max(1, Math.min(99, Math.round(value)));
      if (motif.pattern[idx] === clamped) return;
      const next = [...motif.pattern];
      next[idx] = clamped;
      setParam('pattern', next);
    },
    [motif.pattern, setParam],
  );

  const loadPreset = useCallback(
    (preset: MotifPatternPreset | null) => {
      if (!preset) return;
      setParam('pattern', [...preset.pattern]);
      setParam('patternLength', preset.length);
    },
    [setParam],
  );

  const onSave = useCallback(() => {
    const name = saveName.trim() || `User ${saveSlot + 1}`;
    saveUserPattern(saveSlot, {
      name,
      pattern: [...motif.pattern],
      length: motif.patternLength,
    });
    setSaveName('');
  }, [saveName, saveSlot, saveUserPattern, motif.pattern, motif.patternLength]);

  const ratio = `${motif.patternLength}:${motif.rhythmLength}`;

  return (
    <Modal
      title={`Pattern Editor — Motif ${partId === 'motif1' ? '1' : '2'}`}
      accent={accent}
      onClose={onClose}
    >
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="text-slate-400">
          Pattern : Rhythm ratio{' '}
          <span className="font-mono text-slate-100 text-sm ml-2">{ratio}</span>
        </div>
        <div className="text-slate-500">
          Pattern values are 1-based indices into the current note pool
        </div>
      </div>

      <PatternBars
        pattern={motif.pattern}
        patternLength={motif.patternLength}
        selected={selected}
        accent={accent}
        onSelect={setSelected}
        onValueSet={updateStep}
      />

      {/* Per-step value editor + length slider */}
      <div className="grid grid-cols-2 gap-6 mt-5">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Selected step
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected((s) => Math.max(0, s - 1))}
              className="px-2 py-1 bg-bg-700 hover:bg-bg-600 rounded text-slate-200 text-xs"
            >
              ◀
            </button>
            <span className="font-mono text-sm text-slate-200 w-12 text-center">
              {selected + 1} / 16
            </span>
            <button
              onClick={() => setSelected((s) => Math.min(15, s + 1))}
              className="px-2 py-1 bg-bg-700 hover:bg-bg-600 rounded text-slate-200 text-xs"
            >
              ▶
            </button>
            <input
              type="number"
              min={1}
              max={99}
              value={motif.pattern[selected]}
              onChange={(e) => updateStep(selected, Number(e.target.value) || 1)}
              className="ml-4 w-16 bg-bg-900 border border-slate-700 rounded px-2 py-1 text-sm font-mono text-center"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Pattern length — {motif.patternLength}
          </label>
          <input
            type="range"
            min={1}
            max={16}
            value={motif.patternLength}
            onChange={(e) => setParam('patternLength', Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Pattern type</label>
          <div className="inline-flex rounded border border-slate-700 overflow-hidden">
            {(['chord', 'scale', 'chromatic'] as MotifPatternType[]).map((t) => (
              <button
                key={t}
                onClick={() => setParam('patternType', t)}
                className={`px-4 py-1.5 text-xs ${
                  motif.patternType === t
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Load / Save presets */}
      <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-700/50">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Load preset</label>
          <select
            className="bg-bg-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
            defaultValue=""
            onChange={(e) => {
              const [kind, idxStr] = e.target.value.split(':');
              const idx = Number(idxStr);
              if (kind === 'factory') loadPreset(PRESET_PATTERNS[idx]);
              else if (kind === 'user') loadPreset(userPatterns[idx]);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Select preset…
            </option>
            <optgroup label="Factory (1–20)">
              {PRESET_PATTERNS.map((p, i) => (
                <option key={`f${i}`} value={`factory:${i}`}>
                  {i + 1}. {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={`User (21–${20 + USER_PRESET_SLOTS})`}>
              {userPatterns.map((p, i) => (
                <option key={`u${i}`} value={`user:${i}`} disabled={!p}>
                  {21 + i}. {p ? p.name : '— empty —'}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Save to user slot
          </label>
          <div className="flex gap-1">
            <select
              value={saveSlot}
              onChange={(e) => setSaveSlot(Number(e.target.value))}
              className="bg-bg-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
            >
              {Array.from({ length: USER_PRESET_SLOTS }, (_, i) => (
                <option key={i} value={i}>
                  {21 + i}
                  {userPatterns[i] ? ` (${userPatterns[i]!.name})` : ' (empty)'}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="flex-1 min-w-0 bg-bg-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
            />
            <button
              onClick={onSave}
              className="px-3 py-1.5 bg-slate-200 hover:bg-white text-slate-900 rounded text-xs font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PatternBars — the 16-column visual
// ---------------------------------------------------------------------------

interface PatternBarsProps {
  pattern: number[];
  patternLength: number;
  selected: number;
  accent: string;
  onSelect: (idx: number) => void;
  onValueSet: (idx: number, value: number) => void;
}

function PatternBars({
  pattern,
  patternLength,
  selected,
  accent,
  onSelect,
  onValueSet,
}: PatternBarsProps) {
  return (
    <div
      className="flex gap-1 items-end p-3 bg-bg-900 border border-slate-700 rounded"
      style={{ height: COLUMN_HEIGHT + 32 }}
    >
      {pattern.map((value, idx) => (
        <PatternBar
          key={idx}
          index={idx}
          value={value}
          isSelected={idx === selected}
          isActive={idx < patternLength}
          accent={accent}
          onSelect={onSelect}
          onValueSet={onValueSet}
        />
      ))}
    </div>
  );
}

interface PatternBarProps {
  index: number;
  value: number;
  isSelected: boolean;
  isActive: boolean;
  accent: string;
  onSelect: (idx: number) => void;
  onValueSet: (idx: number, value: number) => void;
}

function PatternBar({
  index,
  value,
  isSelected,
  isActive,
  accent,
  onSelect,
  onValueSet,
}: PatternBarProps) {
  const colRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const rect = (colRef.current ?? e.currentTarget).getBoundingClientRect();
    onSelect(index);

    const setFromY = (clientY: number) => {
      const relY = clientY - rect.top;
      const pct = 1 - Math.max(0, Math.min(1, relY / rect.height));
      const v = Math.max(1, Math.min(BAR_MAX, Math.round(pct * BAR_MAX)));
      onValueSet(index, v);
    };
    setFromY(e.clientY);

    const onMove = (ev: PointerEvent) => setFromY(ev.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Cap the visual fill at BAR_MAX; values above are displayed but the
  // column renders full-height (with the numeric label as the source of truth).
  const visualValue = Math.min(value, BAR_MAX);
  const fillHeight = (visualValue / BAR_MAX) * COLUMN_HEIGHT;

  const fillColor = isSelected ? '#facc15' : isActive ? accent : '#475569';
  const opacity = isActive ? 1 : 0.35;

  return (
    <div
      ref={colRef}
      onPointerDown={onPointerDown}
      className="relative flex-1 min-w-[22px] cursor-ns-resize"
      style={{
        height: COLUMN_HEIGHT,
        background: '#0f172a',
        border: isSelected
          ? '1px solid #fde047'
          : '1px solid rgba(148,163,184,0.15)',
        borderRadius: 3,
      }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 transition-[height] pointer-events-none"
        style={{
          height: fillHeight,
          background: fillColor,
          opacity,
        }}
      />
      <span
        className="absolute top-1 left-0 right-0 text-center text-[10px] font-mono pointer-events-none"
        style={{ color: isSelected ? '#fde047' : '#94a3b8' }}
      >
        {value}
      </span>
      <span className="absolute bottom-0.5 left-0 right-0 text-center text-[9px] font-mono text-slate-600 pointer-events-none">
        {index + 1}
      </span>
    </div>
  );
}

// Silence the unused import lint if useMemo isn't applied elsewhere.
void useMemo;
