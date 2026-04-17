import { Knob } from './Knob';
import { MidiOutputSelector } from './MidiOutputSelector';
import { MiniKeyboard } from './MiniKeyboard';
import { MotifStepIndicator } from './MotifStepIndicator';
import { useStore } from '../store';
import { motif1Engine, motif2Engine } from '../engine/appEngines';
import type { OutputInfo } from '../engine/midiOutput';
import type {
  MotifAccent,
  MotifClockDivide,
  MotifPatternType,
  MotifState,
  MotifVariation,
} from '../engine/parts/motif';
import { PRESET_PATTERNS } from '../data/presetPatterns';
import { PRESET_RHYTHMS } from '../data/presetRhythms';
import { useRafPolled } from '../hooks/useRafPolled';

const VARIATIONS: MotifVariation[] = [
  'forward',
  'backward',
  'pingpong',
  'pingpong_repeat',
  'odd_even',
  'random',
];
const PATTERN_TYPES: MotifPatternType[] = ['chord', 'scale', 'chromatic'];
const DIVIDES: MotifClockDivide[] = ['1/1', '1/2', '1/4', '1/8', '1/4T', '1/8T'];
const ACCENTS: MotifAccent[] = ['rhythm', 'motif', 'humanized'];

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (n: number) => `${MIDI_NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

interface MotifPanelProps {
  partId: 'motif1' | 'motif2';
  accent: string;
  ports: OutputInfo[];
  onEditPattern: (partId: 'motif1' | 'motif2') => void;
  onEditRhythm: (partId: 'motif1' | 'motif2') => void;
}

export function MotifPanelBody({ partId, accent, ports, onEditPattern, onEditRhythm }: MotifPanelProps) {
  const engine = partId === 'motif1' ? motif1Engine : motif2Engine;
  const motif = useStore((s) => (partId === 'motif1' ? s.motif1 : s.motif2));
  const setParam = useStore((s) =>
    partId === 'motif1' ? s.setMotif1Param : s.setMotif2Param,
  ) as <K extends keyof MotifState>(p: K, v: MotifState[K]) => void;
  const midi = useStore((s) => s.midiConfigs[partId]);
  const setMidi = useStore((s) => s.setMidiConfig);
  const currentNote = useRafPolled(() => engine.getCurrentNote());
  const currentStep = useRafPolled(() => engine.getCurrentStep());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap">
        <Knob
          label="Position"
          value={motif.position}
          onChange={(v) => setParam('position', v)}
          min={0}
          max={48}
          accent={accent}
          format={(v) => `idx ${v}`}
        />
        <Knob
          label="Pat Len"
          value={motif.patternLength}
          onChange={(v) => setParam('patternLength', v)}
          min={1}
          max={16}
          accent={accent}
        />
        <Knob
          label="Rhy Len"
          value={motif.rhythmLength}
          onChange={(v) => setParam('rhythmLength', v)}
          min={4}
          max={32}
          accent={accent}
        />
        <Knob
          label="Velocity"
          value={motif.velocity}
          onChange={(v) => setParam('velocity', v)}
          min={0}
          max={127}
          accent={accent}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SelectRow label="Variation">
          <select
            value={motif.variation}
            onChange={(e) => setParam('variation', e.target.value as MotifVariation)}
            className={selectCls}
          >
            {VARIATIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </SelectRow>
        <SelectRow label="Pat Type">
          <select
            value={motif.patternType}
            onChange={(e) => setParam('patternType', e.target.value as MotifPatternType)}
            className={selectCls}
          >
            {PATTERN_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </SelectRow>
        <SelectRow label="Divide">
          <select
            value={motif.clockDivide}
            onChange={(e) => setParam('clockDivide', e.target.value as MotifClockDivide)}
            className={selectCls}
          >
            {DIVIDES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </SelectRow>
        <SelectRow label="Accent">
          <select
            value={motif.accent}
            onChange={(e) => setParam('accent', e.target.value as MotifAccent)}
            className={selectCls}
          >
            {ACCENTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </SelectRow>

        <SelectRow label="Pattern">
          <select
            onChange={(e) => {
              const p = PRESET_PATTERNS[Number(e.target.value)];
              if (p) {
                setParam('pattern', p.pattern);
                setParam('patternLength', p.length);
              }
            }}
            className={selectCls}
            defaultValue=""
          >
            <option value="" disabled>
              Load preset…
            </option>
            {PRESET_PATTERNS.map((p, i) => (
              <option key={p.name} value={i}>
                {i + 1}. {p.name}
              </option>
            ))}
          </select>
        </SelectRow>
        <SelectRow label="Rhythm">
          <select
            onChange={(e) => {
              const r = PRESET_RHYTHMS[Number(e.target.value)];
              if (r) {
                setParam('rhythm', r.rhythm);
                setParam('rhythmLength', r.length);
                setParam('clockDivide', r.suggestedDivide);
              }
            }}
            className={selectCls}
            defaultValue=""
          >
            <option value="" disabled>
              Load preset…
            </option>
            {PRESET_RHYTHMS.map((r, i) => (
              <option key={r.name} value={i}>
                {i + 1}. {r.name}
              </option>
            ))}
          </select>
        </SelectRow>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onEditPattern(partId)}
          className="flex-1 px-3 py-1.5 bg-bg-700 hover:bg-bg-600 text-slate-200 text-xs rounded border border-slate-700"
          style={{ borderLeft: `3px solid ${accent}` }}
        >
          Edit Pattern
        </button>
        <button
          onClick={() => onEditRhythm(partId)}
          className="flex-1 px-3 py-1.5 bg-bg-700 hover:bg-bg-600 text-slate-200 text-xs rounded border border-slate-700"
          style={{ borderLeft: `3px solid ${accent}` }}
        >
          Edit Rhythm
        </button>
      </div>

      <MidiOutputSelector ports={ports} value={midi} onChange={(v) => setMidi(partId, v)} />

      <div className="p-2 bg-bg-900 rounded border border-slate-700/50 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Step</div>
          <MotifStepIndicator
            currentStep={currentStep}
            patternLength={motif.patternLength}
            accent={accent}
          />
        </div>
        <MiniKeyboard notes={currentNote === null ? [] : [currentNote]} accent={accent} />
        <div className="font-mono text-xs leading-none" style={{ color: accent }}>
          {currentNote === null ? '—' : midiName(currentNote)}
        </div>
      </div>
    </div>
  );
}

const selectCls =
  'bg-bg-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs w-full';

function SelectRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-wider text-slate-400">{label}</label>
      {children}
    </div>
  );
}
