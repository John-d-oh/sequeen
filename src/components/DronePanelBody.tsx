import { Knob } from './Knob';
import { MidiOutputSelector } from './MidiOutputSelector';
import { MiniKeyboard } from './MiniKeyboard';
import { useStore } from '../store';
import { droneEngine } from '../engine/appEngines';
import type { OutputInfo } from '../engine/midiOutput';
import type { DroneNoteSetting, DroneTriggerMode } from '../engine/parts/drone';
import { useRafPolled } from '../hooks/useRafPolled';

const NOTE_SETTINGS: DroneNoteSetting[] = ['root', 'root+oct', 'root+5th', 'root+5th+oct'];
const CADENCE_LABELS: Record<number, string> = {
  0: 'sustain',
  1: 'on 1',
  2: 'on 1 & 2',
  3: 'on 1 & 3',
  4: 'on 2 & 4',
  5: 'every beat',
  6: '1 of 3 bars',
  7: '1 of 5 bars',
};

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (n: number) => `${MIDI_NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;

export function DronePanelBody({ ports }: { ports: OutputInfo[] }) {
  const drone = useStore((s) => s.drone);
  const setParam = useStore((s) => s.setDroneParam);
  const midi = useStore((s) => s.midiConfigs.drone);
  const setMidi = useStore((s) => s.setMidiConfig);
  const notes = useRafPolled(() => droneEngine.getCurrentNotes());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-start flex-wrap">
        <Knob
          label="Position"
          value={drone.position}
          onChange={(v) => setParam('position', v)}
          min={0}
          max={4}
          accent="#a855f7"
          format={(v) => `oct ${v}`}
        />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Notes</label>
          <select
            value={drone.notes}
            onChange={(e) => setParam('notes', e.target.value as DroneNoteSetting)}
            className="bg-bg-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs"
          >
            {NOTE_SETTINGS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Trigger</label>
          <div className="inline-flex rounded border border-slate-700 overflow-hidden text-xs">
            {(['root', 'chord'] as DroneTriggerMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setParam('triggerMode', t)}
                className={`px-3 py-1 ${
                  drone.triggerMode === t
                    ? 'bg-violet-600 text-slate-50'
                    : 'bg-bg-900 text-slate-400 hover:bg-bg-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-slate-400">Cadence</label>
          <select
            value={drone.cadence}
            onChange={(e) => setParam('cadence', Number(e.target.value))}
            className="bg-bg-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs"
          >
            {Object.entries(CADENCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {k} — {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <MidiOutputSelector ports={ports} value={midi} onChange={(v) => setMidi('drone', v)} />

      <div className="p-2 bg-bg-900 rounded border border-slate-700/50 flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Notes</div>
        <MiniKeyboard notes={notes} accent="#a855f7" startMidi={12} endMidi={72} />
        <div className="font-mono text-xs text-violet-300 leading-none">
          {notes.length === 0 ? '—' : notes.map(midiName).join('  ')}
        </div>
      </div>
    </div>
  );
}
