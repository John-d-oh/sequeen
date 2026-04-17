import { useCallback, useState } from 'react';
import { useStore, USER_PRESET_SLOTS } from '../store';
import { Modal } from './Modal';
import { PRESET_RHYTHMS, type MotifRhythmPreset } from '../data/presetRhythms';
import type { MotifRhythmBeat, MotifRhythmType } from '../engine/parts/motif';

const COLUMN_HEIGHT = 160;
const MAX_BEATS = 32;

export interface RhythmEditorProps {
  partId: 'motif1' | 'motif2';
  onClose: () => void;
}

export function RhythmEditor({ partId, onClose }: RhythmEditorProps) {
  const motif = useStore((s) => (partId === 'motif1' ? s.motif1 : s.motif2));
  const setParam = useStore((s) =>
    partId === 'motif1' ? s.setMotif1Param : s.setMotif2Param,
  );
  const userRhythms = useStore((s) => s.userRhythms);
  const saveUserRhythm = useStore((s) => s.saveUserRhythm);

  const [selected, setSelected] = useState(0);
  const [saveName, setSaveName] = useState('');
  const [saveSlot, setSaveSlot] = useState(0);

  const accent = partId === 'motif1' ? '#22c55e' : '#f59e0b';
  const selectedBeat = motif.rhythm[selected] ?? { type: 'rest' as MotifRhythmType, velocity: 0 };

  const updateBeat = useCallback(
    (idx: number, patch: Partial<MotifRhythmBeat>) => {
      const current = motif.rhythm[idx];
      if (!current) return;
      const merged: MotifRhythmBeat = { ...current, ...patch };
      // When switching to rest/tie, velocity becomes meaningless — zero it for
      // clarity. When switching back to note, start at a sensible default.
      if (patch.type === 'rest' || patch.type === 'tie') merged.velocity = 0;
      if (patch.type === 'note' && current.type !== 'note' && merged.velocity === 0) {
        merged.velocity = 100;
      }
      if (
        merged.type === current.type &&
        merged.velocity === current.velocity
      ) {
        return;
      }
      const next = [...motif.rhythm];
      next[idx] = merged;
      setParam('rhythm', next);
    },
    [motif.rhythm, setParam],
  );

  const loadPreset = useCallback(
    (preset: MotifRhythmPreset | null) => {
      if (!preset) return;
      setParam('rhythm', preset.rhythm.map((b) => ({ ...b })));
      setParam('rhythmLength', preset.length);
    },
    [setParam],
  );

  const onSave = useCallback(() => {
    const name = saveName.trim() || `User ${saveSlot + 1}`;
    saveUserRhythm(saveSlot, {
      name,
      rhythm: motif.rhythm.map((b) => ({ ...b })),
      length: motif.rhythmLength,
      suggestedDivide: motif.clockDivide,
    });
    setSaveName('');
  }, [
    saveName,
    saveSlot,
    saveUserRhythm,
    motif.rhythm,
    motif.rhythmLength,
    motif.clockDivide,
  ]);

  const ratio = `${motif.rhythmLength}:${motif.patternLength}`;

  return (
    <Modal
      title={`Rhythm Editor — Motif ${partId === 'motif1' ? '1' : '2'}`}
      accent={accent}
      onClose={onClose}
    >
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="text-slate-400">
          Rhythm : Pattern ratio{' '}
          <span className="font-mono text-slate-100 text-sm ml-2">{ratio}</span>
        </div>
        <div className="text-slate-500">
          <span className="inline-block w-3 h-0.5 bg-green-500 mr-1 align-middle" /> note
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full ml-3 mr-1 align-middle" />{' '}
          rest
          <span className="inline-block w-3 h-0.5 bg-yellow-500 mr-1 ml-3 align-middle" /> tie
        </div>
      </div>

      <RhythmBars
        rhythm={motif.rhythm}
        rhythmLength={motif.rhythmLength}
        selected={selected}
        onSelect={setSelected}
      />

      {/* Selected beat editor */}
      <div className="grid grid-cols-2 gap-6 mt-5">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Selected beat
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected((s) => Math.max(0, s - 1))}
              className="px-2 py-1 bg-bg-700 hover:bg-bg-600 rounded text-slate-200 text-xs"
            >
              ◀
            </button>
            <span className="font-mono text-sm text-slate-200 w-14 text-center">
              {selected + 1} / {MAX_BEATS}
            </span>
            <button
              onClick={() => setSelected((s) => Math.min(MAX_BEATS - 1, s + 1))}
              className="px-2 py-1 bg-bg-700 hover:bg-bg-600 rounded text-slate-200 text-xs"
            >
              ▶
            </button>
          </div>
          <div className="inline-flex rounded border border-slate-700 overflow-hidden">
            {(['note', 'rest', 'tie'] as MotifRhythmType[]).map((t) => (
              <button
                key={t}
                onClick={() => updateBeat(selected, { type: t })}
                className={`px-3 py-1 text-xs ${
                  selectedBeat.type === t
                    ? t === 'note'
                      ? 'bg-green-500 text-slate-900'
                      : t === 'rest'
                        ? 'bg-red-500 text-slate-900'
                        : 'bg-yellow-500 text-slate-900'
                    : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">
            Velocity — {selectedBeat.type === 'note' ? selectedBeat.velocity : '—'}
          </label>
          <input
            type="range"
            min={1}
            max={127}
            value={selectedBeat.type === 'note' ? selectedBeat.velocity : 100}
            disabled={selectedBeat.type !== 'note'}
            onChange={(e) => updateBeat(selected, { velocity: Number(e.target.value) })}
            className="w-full"
          />
          <label className="text-[10px] uppercase tracking-wider text-slate-400 mt-2">
            Rhythm length — {motif.rhythmLength}
          </label>
          <input
            type="range"
            min={4}
            max={32}
            value={motif.rhythmLength}
            onChange={(e) => setParam('rhythmLength', Number(e.target.value))}
            className="w-full"
          />
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
              if (kind === 'factory') loadPreset(PRESET_RHYTHMS[idx]);
              else if (kind === 'user') loadPreset(userRhythms[idx]);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Select preset…
            </option>
            <optgroup label="Factory (1–20)">
              {PRESET_RHYTHMS.map((p, i) => (
                <option key={`f${i}`} value={`factory:${i}`}>
                  {i + 1}. {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={`User (21–${20 + USER_PRESET_SLOTS})`}>
              {userRhythms.map((p, i) => (
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
                  {userRhythms[i] ? ` (${userRhythms[i]!.name})` : ' (empty)'}
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
// RhythmBars — 32-column visual
// ---------------------------------------------------------------------------

interface RhythmBarsProps {
  rhythm: MotifRhythmBeat[];
  rhythmLength: number;
  selected: number;
  onSelect: (idx: number) => void;
}

function RhythmBars({ rhythm, rhythmLength, selected, onSelect }: RhythmBarsProps) {
  return (
    <div
      className="flex gap-0.5 items-end p-3 bg-bg-900 border border-slate-700 rounded overflow-x-auto"
      style={{ height: COLUMN_HEIGHT + 32 }}
    >
      {rhythm.map((beat, idx) => (
        <RhythmBar
          key={idx}
          index={idx}
          beat={beat}
          isSelected={idx === selected}
          isActive={idx < rhythmLength}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

interface RhythmBarProps {
  index: number;
  beat: MotifRhythmBeat;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (idx: number) => void;
}

function RhythmBar({ index, beat, isSelected, isActive, onSelect }: RhythmBarProps) {
  const velocityHeight =
    beat.type === 'note' ? (beat.velocity / 127) * COLUMN_HEIGHT : 0;

  // Type → color mapping.
  const fillColor =
    beat.type === 'note' ? '#22c55e' : beat.type === 'tie' ? '#eab308' : '#1e293b';

  return (
    <div
      onClick={() => onSelect(index)}
      className="relative flex-1 min-w-[18px] cursor-pointer"
      style={{
        height: COLUMN_HEIGHT,
        background: '#0f172a',
        border: isSelected
          ? '1px solid #fde047'
          : '1px solid rgba(148,163,184,0.12)',
        borderRadius: 2,
        opacity: isActive ? 1 : 0.35,
      }}
    >
      {/* Velocity fill (note) or tie band */}
      {beat.type === 'note' && (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: velocityHeight, background: fillColor }}
        />
      )}
      {beat.type === 'tie' && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top: '45%',
            height: 6,
            background: '#eab308',
          }}
        />
      )}
      {beat.type === 'rest' && (
        <div
          className="absolute left-1/2 bottom-3 w-2.5 h-2.5 rounded-full pointer-events-none"
          style={{ background: '#ef4444', transform: 'translateX(-50%)' }}
        />
      )}
      <span
        className="absolute top-0.5 left-0 right-0 text-center text-[9px] font-mono pointer-events-none"
        style={{ color: isSelected ? '#fde047' : '#64748b' }}
      >
        {beat.type[0].toUpperCase()}
      </span>
      <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-mono text-slate-700 pointer-events-none">
        {index + 1}
      </span>
    </div>
  );
}
