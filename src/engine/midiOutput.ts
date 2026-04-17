/**
 * Web MIDI output layer for Sequeen.
 *
 * The four parts (Pad, Drone, Motif 1, Motif 2) each hold their own
 * `PartMidiConfig` — a (portId, channel) pair — so every part can route to
 * any open MIDI output at any of the 16 channels, independently from the
 * others. `MidiPortManager` owns the `MIDIAccess` handle and keeps every
 * output port open concurrently; `NoteTracker` remembers which notes each
 * part is currently holding so that re-voicings send exactly the diff
 * (NoteOff for dropped notes, NoteOn for added ones) and port/channel
 * reassignments cleanly release notes on the old destination before the new
 * one starts sounding.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PartName } from './transport';
import { ALL_PARTS } from './transport';

// ---------------------------------------------------------------------------
// Minimal Web MIDI type surface
// ---------------------------------------------------------------------------
// lib.dom.d.ts does not currently ship Web MIDI types in all TS versions, so
// we declare the small surface we use. `navigator.requestMIDIAccess` is cast
// via `unknown` at the call site.

export interface MIDIOutputLike {
  readonly id: string;
  readonly name?: string | null;
  readonly manufacturer?: string | null;
  readonly state: 'connected' | 'disconnected';
  readonly type?: 'output' | 'input';
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

interface MIDIAccessLike {
  readonly outputs: Map<string, MIDIOutputLike>;
  onstatechange: ((event: { port: MIDIOutputLike }) => void) | null;
}

type RequestMIDIAccessFn = (options?: { sysex?: boolean }) => Promise<MIDIAccessLike>;

// ---------------------------------------------------------------------------
// MIDI wire-format helpers
// ---------------------------------------------------------------------------

/** Convert a 1–16 musical channel to the 0–15 status-byte nibble. */
function channelNibble(channel: number): number {
  if (!Number.isInteger(channel) || channel < 1 || channel > 16) {
    throw new RangeError(`MIDI channel must be 1–16, got ${channel}`);
  }
  return channel - 1;
}

function clampNote(note: number): number {
  return Math.max(0, Math.min(127, note | 0));
}

function clampVelocity(vel: number): number {
  return Math.max(0, Math.min(127, vel | 0));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartMidiConfig {
  /** Web MIDI output port id. Empty string means "unassigned". */
  portId: string;
  /** 1-based MIDI channel (1–16). */
  channel: number;
}

export interface OutputInfo {
  id: string;
  name: string;
  state: 'connected' | 'disconnected';
}

export type MidiStatus = 'loading' | 'unsupported' | 'denied' | 'ready';

/**
 * Pluggable destination for NoteOn / NoteOff messages. `MidiPortManager`
 * implements this natively; tests pass a recording mock instead.
 */
export interface MidiSink {
  sendNoteOn(portId: string, channel: number, note: number, velocity: number): void;
  sendNoteOff(portId: string, channel: number, note: number): void;
}

// ---------------------------------------------------------------------------
// MidiPortManager
// ---------------------------------------------------------------------------

type OutputsListener = (outputs: OutputInfo[]) => void;

/**
 * Owns Web MIDI access and exposes a stable, observable list of available
 * output ports. All sends route through the lower-level `send*` methods so
 * the rest of the app never touches raw status bytes.
 */
export class MidiPortManager implements MidiSink {
  private access: MIDIAccessLike | null = null;
  private listeners = new Set<OutputsListener>();
  private _status: MidiStatus = 'loading';
  private _error: string | null = null;

  get status(): MidiStatus {
    return this._status;
  }
  get error(): string | null {
    return this._error;
  }

  /**
   * Request Web MIDI access and wire up live port-list updates. Idempotent:
   * calling twice returns the same promise result.
   */
  async init(): Promise<void> {
    if (this._status === 'ready' || this._status === 'unsupported' || this._status === 'denied') {
      return;
    }

    const req = (navigator as unknown as { requestMIDIAccess?: RequestMIDIAccessFn })
      .requestMIDIAccess;

    if (typeof req !== 'function') {
      this._status = 'unsupported';
      this._error =
        'Web MIDI is not supported in this browser. Use Chrome, Edge, or another Chromium-based browser.';
      return;
    }

    try {
      this.access = await req.call(navigator, { sysex: false });
    } catch (e) {
      this._status = 'denied';
      this._error =
        e instanceof Error ? `MIDI access denied: ${e.message}` : 'MIDI access denied.';
      return;
    }

    this.access.onstatechange = () => this.emitOutputs();
    this._status = 'ready';
    this.emitOutputs();
  }

  /** Return the current list of output ports, in stable id order. */
  getOutputs(): OutputInfo[] {
    if (!this.access) return [];
    const list: OutputInfo[] = [];
    for (const out of this.access.outputs.values()) {
      list.push({ id: out.id, name: out.name ?? out.id, state: out.state });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  /** Subscribe to live output-list updates. Returns an unsubscribe function. */
  onOutputsChanged(cb: OutputsListener): () => void {
    this.listeners.add(cb);
    cb(this.getOutputs());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emitOutputs(): void {
    const snapshot = this.getOutputs();
    for (const l of this.listeners) l(snapshot);
  }

  /** Get a raw output-port handle for a given id, or `null` if unavailable. */
  getPort(portId: string): MIDIOutputLike | null {
    if (!this.access || !portId) return null;
    return this.access.outputs.get(portId) ?? null;
  }

  // -- low-level sends ----------------------------------------------------

  sendNoteOn(portId: string, channel: number, note: number, velocity: number): void {
    const port = this.getPort(portId);
    if (!port || port.state !== 'connected') return;
    port.send([0x90 | channelNibble(channel), clampNote(note), clampVelocity(velocity)]);
  }

  sendNoteOff(portId: string, channel: number, note: number): void {
    const port = this.getPort(portId);
    if (!port || port.state !== 'connected') return;
    port.send([0x80 | channelNibble(channel), clampNote(note), 0]);
  }

  /** Send CC 123 (All Notes Off) on one (portId, channel). */
  sendAllNotesOff(portId: string, channel: number): void {
    const port = this.getPort(portId);
    if (!port || port.state !== 'connected') return;
    port.send([0xb0 | channelNibble(channel), 123, 0]);
  }

  /** Send All Notes Off on every connected output, every channel. */
  panic(): void {
    if (!this.access) return;
    for (const out of this.access.outputs.values()) {
      if (out.state !== 'connected') continue;
      for (let ch = 0; ch < 16; ch++) {
        out.send([0xb0 | ch, 123, 0]);
        out.send([0xb0 | ch, 120, 0]); // All Sound Off — belt and braces
      }
    }
  }
}

// ---------------------------------------------------------------------------
// NoteTracker
// ---------------------------------------------------------------------------

interface PartHeldNotes {
  portId: string;
  channel: number;
  /** Map note-number → last velocity (kept so re-voicings don't restrike). */
  notes: Map<number, number>;
}

export interface VoicingNote {
  note: number;
  velocity: number;
}

/**
 * Per-part note-holding bookkeeping. Each part's "currently sounding" set is
 * indexed by part name (not by channel) because two parts can legitimately
 * share the same (portId, channel) destination and must still be released
 * independently.
 *
 * All side effects go through the injected `MidiSink`, which makes this
 * class trivially unit-testable without Web MIDI.
 */
export class NoteTracker {
  private held = new Map<PartName, PartHeldNotes>();

  constructor(private sink: MidiSink) {}

  /**
   * Reconcile a part's voicing against the last-known state. Sends NoteOff
   * for notes that dropped out and NoteOn for new ones. If `portId` or
   * `channel` changed since the last call, every held note is first
   * released on the OLD destination and then the new voicing is sent fresh
   * to the new one.
   */
  updateNotes(
    partId: PartName,
    portId: string,
    channel: number,
    newNotes: VoicingNote[],
  ): void {
    const existing = this.held.get(partId);
    const targetNotes = new Map<number, number>();
    for (const { note, velocity } of newNotes) targetNotes.set(note, velocity);

    // Port/channel change → flush old destination first.
    if (existing && (existing.portId !== portId || existing.channel !== channel)) {
      for (const n of existing.notes.keys()) {
        this.sink.sendNoteOff(existing.portId, existing.channel, n);
      }
      this.held.delete(partId);
    }

    const prev = this.held.get(partId)?.notes ?? new Map<number, number>();

    // NoteOff for notes in prev \ target.
    for (const n of prev.keys()) {
      if (!targetNotes.has(n)) this.sink.sendNoteOff(portId, channel, n);
    }
    // NoteOn for notes in target \ prev.
    for (const [n, v] of targetNotes) {
      if (!prev.has(n)) this.sink.sendNoteOn(portId, channel, n, v);
    }

    if (targetNotes.size === 0) {
      this.held.delete(partId);
    } else {
      this.held.set(partId, { portId, channel, notes: targetNotes });
    }
  }

  /** Release every note held by a single part. */
  releasePart(partId: PartName): void {
    const entry = this.held.get(partId);
    if (!entry) return;
    for (const n of entry.notes.keys()) {
      this.sink.sendNoteOff(entry.portId, entry.channel, n);
    }
    this.held.delete(partId);
  }

  /** Release every note held by every part. */
  releaseAll(): void {
    for (const [, entry] of this.held) {
      for (const n of entry.notes.keys()) {
        this.sink.sendNoteOff(entry.portId, entry.channel, n);
      }
    }
    this.held.clear();
  }

  /**
   * A port vanished (disconnected). Drop tracking for every part routed to
   * it — no NoteOff is sent because the destination is gone. The caller is
   * expected to surface a "disconnected" UI state for the affected parts.
   */
  forgetPort(portId: string): PartName[] {
    const affected: PartName[] = [];
    for (const [part, entry] of this.held) {
      if (entry.portId === portId) {
        affected.push(part);
        this.held.delete(part);
      }
    }
    return affected;
  }

  /** Read-only view, useful for tests and UI display. */
  getHeldNotes(partId: PartName): ReadonlyMap<number, number> | null {
    const entry = this.held.get(partId);
    return entry ? entry.notes : null;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseMidiResult {
  status: MidiStatus;
  error: string | null;
  outputs: OutputInfo[];
  /** Current per-part routing. */
  partConfigs: Record<PartName, PartMidiConfig>;
  setPartConfig(part: PartName, config: PartMidiConfig): void;
  /** Send a test note (middle C for 500 ms) on a given part's destination. */
  testNote(part: PartName): void;
  /** Any (portId, channel) pairs currently used by more than one part. */
  collisions: Array<{ portId: string; channel: number; parts: PartName[] }>;
  manager: MidiPortManager;
  tracker: NoteTracker;
}

const DEFAULT_CONFIG: PartMidiConfig = { portId: '', channel: 1 };

function initialConfigs(): Record<PartName, PartMidiConfig> {
  return {
    pad: { ...DEFAULT_CONFIG, channel: 1 },
    drone: { ...DEFAULT_CONFIG, channel: 2 },
    motif1: { ...DEFAULT_CONFIG, channel: 3 },
    motif2: { ...DEFAULT_CONFIG, channel: 4 },
  };
}

function findCollisions(
  configs: Record<PartName, PartMidiConfig>,
): Array<{ portId: string; channel: number; parts: PartName[] }> {
  const groups = new Map<string, PartName[]>();
  for (const part of ALL_PARTS) {
    const c = configs[part];
    if (!c.portId) continue;
    const key = `${c.portId}::${c.channel}`;
    const list = groups.get(key);
    if (list) list.push(part);
    else groups.set(key, [part]);
  }
  const out: Array<{ portId: string; channel: number; parts: PartName[] }> = [];
  for (const [key, parts] of groups) {
    if (parts.length < 2) continue;
    const [portId, channelStr] = key.split('::');
    out.push({ portId, channel: Number(channelStr), parts });
  }
  return out;
}

/**
 * React hook: initialises Web MIDI, keeps the output list live, owns one
 * `MidiPortManager` + `NoteTracker` per component instance, and manages the
 * four `PartMidiConfig` routings.
 */
export function useMidi(): UseMidiResult {
  // Stable instances: one manager and tracker for the lifetime of the hook.
  const managerRef = useRef<MidiPortManager | null>(null);
  if (managerRef.current === null) managerRef.current = new MidiPortManager();
  const manager = managerRef.current;

  const trackerRef = useRef<NoteTracker | null>(null);
  if (trackerRef.current === null) trackerRef.current = new NoteTracker(manager);
  const tracker = trackerRef.current;

  const [status, setStatus] = useState<MidiStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputInfo[]>([]);
  const [partConfigs, setPartConfigs] = useState<Record<PartName, PartMidiConfig>>(
    initialConfigs,
  );

  // One-shot init + subscription to output-list changes.
  useEffect(() => {
    let cancelled = false;
    void manager.init().then(() => {
      if (cancelled) return;
      setStatus(manager.status);
      setError(manager.error);
    });
    const off = manager.onOutputsChanged((list) => {
      setOutputs(list);
      // If any tracked port vanished, release its notes in the tracker and
      // leave the config alone — the part will show as "disconnected" but
      // automatically resume if the port comes back.
      const liveIds = new Set(list.filter((o) => o.state === 'connected').map((o) => o.id));
      setPartConfigs((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const part of ALL_PARTS) {
          if (next[part].portId && !liveIds.has(next[part].portId)) {
            tracker.forgetPort(next[part].portId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    return () => {
      cancelled = true;
      off();
      tracker.releaseAll();
    };
  }, [manager, tracker]);

  const setPartConfig = useCallback(
    (part: PartName, config: PartMidiConfig) => {
      setPartConfigs((prev) => {
        const old = prev[part];
        // If the part is currently holding notes and we're rerouting, flush
        // them on the old destination via NoteTracker bookkeeping.
        if (old.portId && (old.portId !== config.portId || old.channel !== config.channel)) {
          tracker.releasePart(part);
        }
        return { ...prev, [part]: config };
      });
    },
    [tracker],
  );

  const testNote = useCallback(
    (part: PartName) => {
      setPartConfigs((prev) => {
        const cfg = prev[part];
        if (!cfg.portId) return prev;
        manager.sendNoteOn(cfg.portId, cfg.channel, 60, 100);
        window.setTimeout(() => {
          manager.sendNoteOff(cfg.portId, cfg.channel, 60);
        }, 500);
        return prev;
      });
    },
    [manager],
  );

  const collisions = useMemo(() => findCollisions(partConfigs), [partConfigs]);

  return {
    status,
    error,
    outputs,
    partConfigs,
    setPartConfig,
    testNote,
    collisions,
    manager,
    tracker,
  };
}

// ---------------------------------------------------------------------------
// Help text for UI when things aren't wired up yet
// ---------------------------------------------------------------------------

export const NO_OUTPUTS_HELP =
  'No MIDI outputs were found. On Mac: enable the IAC Driver in Audio MIDI Setup. ' +
  'On Windows: install loopMIDI from Tobias Erichsen.';

export const UNSUPPORTED_HELP =
  'This browser does not support the Web MIDI API. Use Chrome, Edge, or another ' +
  'Chromium-based browser, and make sure the page is served over HTTPS or from localhost.';
