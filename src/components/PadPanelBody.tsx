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

const ACCENT = '#00D9FF'; // synthwave cyan

/**
 * Compact 2-column layout — knobs left, MIDI routing + voicing on the right.
 * This keeps the panel short enough to sit side-by-side with Drone in the
 * top row of the part grid without dominating the viewport.
 */
export function PadPanelBody({ ports }: { ports: OutputInfo[] }) {
  const pad = useStore((s) => s.pad);
  const setParam = useStore((s) => s.setPadParam);
  const midi = useStore((s) => s.midiConfigs.pad);
  const setMidi = useStore((s) => s.setMidiConfig);
  const voicing = useRafPolled(() => padEngine.getCurrentVoicing());

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start">
      {/* Left: knobs row */}
      <div className="flex gap-3 flex-wrap items-center">
        <Knob
          label="Position"
          value={pad.position}
          onChange={(v) => setParam('position', v)}
          min={24}
          max={96}
          accent={ACCENT}
          format={(v) => midiName(v)}
        />
        <Knob
          label="Range"
          value={pad.range}
          onChange={(v) => setParam('range', v)}
          min={1}
          max={22}
          accent={ACCENT}
        />
        <Knob
          label="Spread"
          value={pad.spread}
          onChange={(v) => setParam('spread', v)}
          min={1}
          max={6}
          accent={ACCENT}
        />
        <Knob
          label="Strum"
          value={pad.strum}
          onChange={(v) => setParam('strum', v)}
          min={1}
          max={7}
          accent={ACCENT}
        />
        <Knob
          label="Velocity"
          value={pad.velocity}
          onChange={(v) => setParam('velocity', v)}
          min={0}
          max={127}
          accent={ACCENT}
        />
      </div>

      {/* Right: MIDI routing + live voicing readout, stacked. */}
      <div className="flex flex-col gap-2 min-w-0">
        <MidiOutputSelector ports={ports} value={midi} onChange={(v) => setMidi('pad', v)} />
        <div className="sunken p-2 flex flex-col gap-1.5">
          <div className="text-lbl text-fg-mute">Voicing</div>
          <MiniKeyboard notes={voicing} accent={ACCENT} />
          <div
            className="font-mono text-[11px] leading-none truncate"
            style={{ color: ACCENT }}
          >
            {voicing.length === 0 ? '—' : voicing.map(midiName).join('  ')}
          </div>
        </div>
      </div>
    </div>
  );
}
