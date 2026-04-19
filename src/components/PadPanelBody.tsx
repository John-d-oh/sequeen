import { Knob } from './Knob';
import { MidiOutputSelector } from './MidiOutputSelector';
import { MiniKeyboard } from './MiniKeyboard';
import { useStore } from '../store';
import { padEngine } from '../engine/appEngines';
import type { OutputInfo } from '../engine/midiOutput';
import type { PadTriggerMode } from '../engine/parts/pad';
import { SPREAD_NAMES, SPREAD_SHORT } from '../engine/parts/pad';
import { useRafPolled } from '../hooks/useRafPolled';

const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(n: number): string {
  const octave = Math.floor(n / 12) - 1;
  return `${MIDI_NOTE_NAMES[n % 12]}${octave}`;
}

const ACCENT = '#00D9FF'; // synthwave cyan

/**
 * Compact 2-column layout — knobs left, MIDI routing + voicing on the right.
 * The Spread knob now drives the actual voicing transformation (closed,
 * open, drop-2, drop-3, octaves, wide). The Trigger segmented control
 * switches between sustain ("hold") and per-bar restrike ("bar").
 */
export function PadPanelBody({ ports }: { ports: OutputInfo[] }) {
  const pad = useStore((s) => s.pad);
  const setParam = useStore((s) => s.setPadParam);
  const midi = useStore((s) => s.midiConfigs.pad);
  const setMidi = useStore((s) => s.setMidiConfig);
  const voicing = useRafPolled(() => padEngine.getCurrentVoicing());
  const triggerMode: PadTriggerMode = (pad.triggerMode ?? 'hold') as PadTriggerMode;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 items-start">
      {/* Left column: knobs + trigger toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 flex-wrap items-end">
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
            format={(v) => SPREAD_SHORT[v - 1] ?? `${v}`}
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

        {/* Long-form spread name + trigger mode segmented control */}
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-lbl">Spread</span>
            <span
              className="font-mono text-[12px] tracking-wide"
              style={{ color: ACCENT }}
            >
              {SPREAD_NAMES[pad.spread - 1] ?? '—'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-lbl">Trigger</label>
            <div className="chip inline-flex p-0.5 gap-0.5">
              {(['hold', 'bar'] as PadTriggerMode[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setParam('triggerMode', t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium ${
                    triggerMode === t
                      ? 'text-ink'
                      : 'text-fg-mute hover:text-fg'
                  }`}
                  style={
                    triggerMode === t
                      ? {
                          background:
                            'linear-gradient(180deg, #00D9FF 0%, #0891b2 100%)',
                          boxShadow: '0 0 12px -2px rgba(0,217,255,0.6)',
                        }
                      : undefined
                  }
                  title={
                    t === 'hold'
                      ? 'Sustain — only re-voice on chord change'
                      : 'Re-strike at the start of every bar'
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right column: MIDI routing + live voicing readout */}
      <div className="flex flex-col gap-2 min-w-0">
        <MidiOutputSelector ports={ports} value={midi} onChange={(v) => setMidi('pad', v)} />
        <div className="sunken p-2 flex flex-col gap-1.5">
          <div className="text-lbl">Voicing</div>
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
