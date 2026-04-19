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

const ACCENT = '#FF2BD6'; // synthwave magenta

/**
 * Compact 2-column layout: position knob + selectors on the left, MIDI
 * routing + live notes readout on the right. Sits side-by-side with the
 * Pad in the top row of the part grid.
 */
export function DronePanelBody({ ports }: { ports: OutputInfo[] }) {
  const drone = useStore((s) => s.drone);
  const setParam = useStore((s) => s.setDroneParam);
  const midi = useStore((s) => s.midiConfigs.drone);
  const setMidi = useStore((s) => s.setMidiConfig);
  const notes = useRafPolled(() => droneEngine.getCurrentNotes());

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start">
      {/* Left: knob + selectors */}
      <div className="flex gap-3 items-start flex-wrap">
        <Knob
          label="Position"
          value={drone.position}
          onChange={(v) => setParam('position', v)}
          min={0}
          max={4}
          accent={ACCENT}
          format={(v) => `oct ${v}`}
        />
        <div className="flex flex-col gap-1">
          <label className="text-lbl">Notes</label>
          <select
            value={drone.notes}
            onChange={(e) => setParam('notes', e.target.value as DroneNoteSetting)}
            className="sunken px-2 py-1 text-xs"
          >
            {NOTE_SETTINGS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-lbl">Trigger</label>
          <div className="chip inline-flex overflow-hidden text-xs p-0.5 gap-0.5">
            {(['root', 'chord'] as DroneTriggerMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setParam('triggerMode', t)}
                className={`px-3 py-1 rounded-md font-medium ${
                  drone.triggerMode === t
                    ? 'text-ink'
                    : 'text-fg-mute hover:text-fg'
                }`}
                style={
                  drone.triggerMode === t
                    ? {
                        background:
                          'linear-gradient(180deg, #FF2BD6 0%, #c026d3 100%)',
                        boxShadow: '0 0 12px -2px rgba(255,43,214,0.6)',
                      }
                    : undefined
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-lbl">Cadence</label>
          <select
            value={drone.cadence}
            onChange={(e) => setParam('cadence', Number(e.target.value))}
            className="sunken px-2 py-1 text-xs"
          >
            {Object.entries(CADENCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {k} — {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: MIDI routing + live notes readout, stacked. */}
      <div className="flex flex-col gap-2 min-w-0">
        <MidiOutputSelector ports={ports} value={midi} onChange={(v) => setMidi('drone', v)} />
        <div className="sunken p-2 flex flex-col gap-1.5">
          <div className="text-lbl">Notes</div>
          <MiniKeyboard notes={notes} accent={ACCENT} startMidi={12} endMidi={72} />
          <div
            className="font-mono text-[11px] leading-none truncate"
            style={{ color: ACCENT }}
          >
            {notes.length === 0 ? '—' : notes.map(midiName).join('  ')}
          </div>
        </div>
      </div>
    </div>
  );
}
