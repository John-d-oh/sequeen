import { useMidi, NO_OUTPUTS_HELP, UNSUPPORTED_HELP } from '../engine/midiOutput';
import { ALL_PARTS, type PartName } from '../engine/transport';

const PART_LABELS: Record<PartName, string> = {
  pad: 'Pad',
  drone: 'Drone',
  motif1: 'Motif 1',
  motif2: 'Motif 2',
};

const CHANNELS = Array.from({ length: 16 }, (_, i) => i + 1);

const styles = {
  panel: {
    fontFamily: 'system-ui, sans-serif',
    padding: 24,
    maxWidth: 720,
  } as const,
  row: {
    display: 'grid',
    gridTemplateColumns: '90px 1fr 90px 120px',
    gap: 12,
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #eee',
  } as const,
  label: { fontWeight: 600 } as const,
  select: { padding: '4px 8px', fontSize: 14 } as const,
  button: {
    padding: '6px 12px',
    fontSize: 14,
    cursor: 'pointer',
  } as const,
  notice: {
    padding: 12,
    background: '#fff8e1',
    border: '1px solid #f0c36d',
    borderRadius: 4,
    margin: '12px 0',
  } as const,
  error: {
    padding: 12,
    background: '#fde2e2',
    border: '1px solid #e57373',
    borderRadius: 4,
    margin: '12px 0',
  } as const,
  collision: {
    padding: '8px 12px',
    background: '#fff3e0',
    border: '1px solid #ffb74d',
    borderRadius: 4,
    margin: '8px 0',
    fontSize: 13,
  } as const,
};

export function MidiPanel() {
  const midi = useMidi();
  const connectedOutputs = midi.outputs.filter((o) => o.state === 'connected');

  return (
    <div style={styles.panel}>
      <h2>MIDI Output Routing</h2>

      {midi.status === 'loading' && <p>Requesting MIDI access…</p>}
      {midi.status === 'unsupported' && <div style={styles.error}>{UNSUPPORTED_HELP}</div>}
      {midi.status === 'denied' && (
        <div style={styles.error}>{midi.error ?? 'MIDI access was denied.'}</div>
      )}
      {midi.status === 'ready' && connectedOutputs.length === 0 && (
        <div style={styles.notice}>{NO_OUTPUTS_HELP}</div>
      )}

      {midi.collisions.length > 0 && (
        <div style={styles.collision}>
          <strong>Heads up:</strong> more than one part is sharing a destination —
          {midi.collisions.map((c, i) => {
            const name =
              connectedOutputs.find((o) => o.id === c.portId)?.name ?? c.portId;
            return (
              <span key={i}>
                {' '}
                {c.parts.map((p) => PART_LABELS[p]).join(' + ')} on {name} ch {c.channel}
                {i < midi.collisions.length - 1 ? ';' : ''}
              </span>
            );
          })}
          . This is allowed but you'll hear both parts on the same channel.
        </div>
      )}

      <div style={styles.row}>
        <span style={styles.label}>Part</span>
        <span style={styles.label}>Output port</span>
        <span style={styles.label}>Channel</span>
        <span />
      </div>

      {ALL_PARTS.map((part) => {
        const cfg = midi.partConfigs[part];
        const selectedPort = connectedOutputs.find((o) => o.id === cfg.portId);
        const isPortMissing = !!cfg.portId && !selectedPort;
        return (
          <div key={part} style={styles.row}>
            <span style={styles.label}>{PART_LABELS[part]}</span>
            <select
              style={styles.select}
              value={cfg.portId}
              onChange={(e) =>
                midi.setPartConfig(part, { ...cfg, portId: e.target.value })
              }
              disabled={midi.status !== 'ready'}
            >
              <option value="">— unassigned —</option>
              {connectedOutputs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
              {isPortMissing && (
                <option value={cfg.portId}>{cfg.portId} (disconnected)</option>
              )}
            </select>
            <select
              style={styles.select}
              value={cfg.channel}
              onChange={(e) =>
                midi.setPartConfig(part, { ...cfg, channel: Number(e.target.value) })
              }
              disabled={midi.status !== 'ready'}
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  ch {ch}
                </option>
              ))}
            </select>
            <button
              style={styles.button}
              onClick={() => midi.testNote(part)}
              disabled={!cfg.portId || isPortMissing || midi.status !== 'ready'}
              title="Sends middle C (note 60) for 500 ms on this part's destination"
            >
              Test Note
            </button>
          </div>
        );
      })}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button style={styles.button} onClick={() => midi.manager.panic()}>
          Panic (All Notes Off)
        </button>
      </div>
    </div>
  );
}
