import { Knob } from './Knob';
import { MidiOutputSelector } from './MidiOutputSelector';
import { MiniKeyboard } from './MiniKeyboard';
import { useStore } from '../store';
import { padEngine } from '../engine/appEngines';
import type { OutputInfo } from '../engine/midiOutput';
import { useRafPolled } from '../hooks/useRafPolled';

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(n: number): string {
  const octave = Math.floor(n / 12) - 1;
  return `${MIDI_NOTE_NAMES[n % 12]}${octave}`;
}

export function PadPanelBody({ ports }: { ports: OutputInfo[] }) {
  const pad = useStore((s) => s.pad);
  const setParam = useStore((s) => s.setPadParam);
  const midi = useStore((s) => s.midiConfigs.pad);
  const setMidi = useStore((s) => s.setMidiConfig);
  const voicing = useRafPolled(() => padEngine.getCurrentVoicing());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 flex-wrap">
        <Knob
          label="Position"
          value={pad.position}
          onChange={(v) => setParam('position', v)}
          min={24}
          max={96}
          accent="#38bdf8"
          format={(v) => midiName(v)}
        />
        <Knob
          label="Range"
          value={pad.range}
          onChange={(v) => setParam('range', v)}
          min={1}
          max={22}
          accent="#38bdf8"
        />
        <Knob
          label="Spread"
          value={pad.spread}
          onChange={(v) => setParam('spread', v)}
          min={1}
          max={6}
          accent="#38bdf8"
        />
        <Knob
          label="Strum"
          value={pad.strum}
          onChange={(v) => setParam('strum', v)}
          min={1}
          max={7}
          accent="#38bdf8"
        />
        <Knob
          label="Velocity"
          value={pad.velocity}
          onChange={(v) => setParam('velocity', v)}
          min={0}
          max={127}
          accent="#38bdf8"
        />
      </div>

      <MidiOutputSelector ports={ports} value={midi} onChange={(v) => setMidi('pad', v)} />

      <div className="p-2 bg-bg-900 rounded border border-slate-700/50 flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Voicing</div>
        <MiniKeyboard notes={voicing} accent="#38bdf8" />
        <div className="font-mono text-xs text-sky-300 leading-none">
          {voicing.length === 0 ? '—' : voicing.map(midiName).join('  ')}
        </div>
      </div>
    </div>
  );
}
