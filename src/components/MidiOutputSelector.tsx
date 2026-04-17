import type { OutputInfo, PartMidiConfig } from '../engine/midiOutput';

export interface MidiOutputSelectorProps {
  ports: OutputInfo[];
  value: PartMidiConfig;
  onChange: (value: PartMidiConfig) => void;
  disabled?: boolean;
}

export function MidiOutputSelector({ ports, value, onChange, disabled }: MidiOutputSelectorProps) {
  const connected = ports.filter((p) => p.state === 'connected');
  const stale = !!value.portId && !connected.find((p) => p.id === value.portId);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-slate-400">MIDI Out</label>
      <div className="flex gap-2 items-center">
        <select
          value={value.portId}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, portId: e.target.value })}
          className="bg-bg-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs flex-1 min-w-0"
        >
          <option value="">— unassigned —</option>
          {connected.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {stale && (
            <option value={value.portId}>{value.portId.slice(0, 18)} (disconnected)</option>
          )}
        </select>
        <select
          value={value.channel}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, channel: Number(e.target.value) })}
          className="bg-bg-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs"
        >
          {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
            <option key={ch} value={ch}>
              ch {ch}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
