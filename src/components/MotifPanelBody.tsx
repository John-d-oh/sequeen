import { Knob } from './Knob';
import { MidiOutputSelector } from './MidiOutputSelector';
import { MotifStepIndicator } from './MotifStepIndicator';
import { VariationButton } from './VariationButton';
import { PatternPresetButton, patternMatchesPreset } from './PatternPresetButton';
import { RhythmPresetButton, rhythmMatchesPreset } from './RhythmPresetButton';
import { LengthIndicator } from './LengthIndicator';
import { MotifPatternPreview } from './MotifPatternPreview';
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
  const music = useStore((s) => s.music);
  const currentNote = useRafPolled(() => engine.getCurrentNote());
  const currentStep = useRafPolled(() => engine.getCurrentStep());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap items-end">
        <Knob
          label="Position"
          value={motif.position}
          onChange={(v) => setParam('position', v)}
          min={0}
          max={48}
          accent={accent}
          format={(v) => `idx ${v}`}
        />
        <div className="flex flex-col items-center gap-1">
          <Knob
            label="Pat Len"
            value={motif.patternLength}
            onChange={(v) => setParam('patternLength', v)}
            min={1}
            max={16}
            accent={accent}
          />
          <LengthIndicator active={motif.patternLength} total={16} accent={accent} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Knob
            label="Rhy Len"
            value={motif.rhythmLength}
            onChange={(v) => setParam('rhythmLength', v)}
            min={4}
            max={32}
            accent={accent}
          />
          <LengthIndicator
            active={motif.rhythmLength}
            total={32}
            accent={accent}
            dotSize={3}
          />
        </div>
        <Knob
          label="Velocity"
          value={motif.velocity}
          onChange={(v) => setParam('velocity', v)}
          min={0}
          max={127}
          accent={accent}
        />
      </div>

      {/* Live preview keyboard — makes Position / patternLength / patternType
          concrete by showing the actual MIDI notes the motif will play. */}
      <div className="p-2 bg-bg-900 rounded border border-slate-700/50">
        <MotifPatternPreview
          partId={partId}
          pattern={motif.pattern}
          patternLength={motif.patternLength}
          position={motif.position}
          patternType={motif.patternType}
          music={music}
          accent={accent}
        />
      </div>

      {/* Variation: 6 iconographic buttons, each showing the motion curve */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Variation</div>
        <div className="grid grid-cols-3 gap-1">
          {VARIATIONS.map((v) => (
            <VariationButton
              key={v}
              variation={v}
              isActive={motif.variation === v}
              accent={accent}
              onClick={() => setParam('variation', v)}
            />
          ))}
        </div>
      </div>

      {/* Pattern-type / clock-divide / accent kept as compact selects */}
      <div className="grid grid-cols-3 gap-2">
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
      </div>

      {/* Pattern presets as visual bar-chart buttons */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Pattern</div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PRESET_PATTERNS.map((p) => (
            <PatternPresetButton
              key={p.name}
              preset={p}
              isActive={patternMatchesPreset(motif.pattern, motif.patternLength, p)}
              accent={accent}
              onClick={() => {
                setParam('pattern', p.pattern);
                setParam('patternLength', p.length);
              }}
            />
          ))}
        </div>
      </div>

      {/* Rhythm presets split into Melodic + Bass rows so the bass-oriented
          rhythms (Bass — Whole Notes, On 1, Reggae Offbeat, etc.) are easy
          to find without hunting through a single 15-item dropdown. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Rhythm — Melodic
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PRESET_RHYTHMS.filter((r) => !r.name.startsWith('Bass')).map((r) => (
            <RhythmPresetButton
              key={r.name}
              preset={r}
              isActive={rhythmMatchesPreset(motif.rhythm, motif.rhythmLength, r)}
              accent={accent}
              onClick={() => {
                setParam('rhythm', r.rhythm);
                setParam('rhythmLength', r.length);
                setParam('clockDivide', r.suggestedDivide);
              }}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Rhythm — Bass
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {PRESET_RHYTHMS.filter((r) => r.name.startsWith('Bass')).map((r) => (
            <RhythmPresetButton
              key={r.name}
              preset={r}
              isActive={rhythmMatchesPreset(motif.rhythm, motif.rhythmLength, r)}
              accent={accent}
              onClick={() => {
                setParam('rhythm', r.rhythm);
                setParam('rhythmLength', r.length);
                setParam('clockDivide', r.suggestedDivide);
              }}
            />
          ))}
        </div>
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

      {/* Step + current note readout. The preview keyboard above already
          highlights the currently-playing key, so this row only shows the
          pattern-step position + note name. */}
      <div className="p-2 bg-bg-900 rounded border border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Step</span>
          <MotifStepIndicator
            currentStep={currentStep}
            patternLength={motif.patternLength}
            accent={accent}
          />
        </div>
        <span className="font-mono text-xs" style={{ color: accent }}>
          {currentNote === null ? '—' : midiName(currentNote)}
        </span>
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
