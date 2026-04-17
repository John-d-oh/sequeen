/**
 * Transport state management for Sequeen.
 *
 * Sequeen has four independent parts — a sustained pad, a drone, and two
 * motif sequencers — each of which can be stopped, armed (waiting for the
 * next downbeat to enter), or playing. A global play/pause toggles all four
 * at once and resynchronises both motifs to their first beat so the phrase
 * always starts from the top.
 *
 * This module is UI-agnostic. The `Transport` class is a plain observable
 * store; `useTransport` adapts it to React via `useSyncExternalStore`.
 */

import { useSyncExternalStore } from 'react';

export type PartName = 'pad' | 'drone' | 'motif1' | 'motif2';

/**
 * Per-part lifecycle:
 *   stopped → (user toggles it on) → armed → (next downbeat) → playing
 *   playing → (user toggles it off) → stopped
 */
export type PartStatus = 'stopped' | 'armed' | 'playing';

export const ALL_PARTS: readonly PartName[] = ['pad', 'drone', 'motif1', 'motif2'] as const;

export interface TransportState {
  /** Global play/pause — true means at least one part may be sounding. */
  globalPlaying: boolean;
  /** Independent status for each of the four parts. */
  parts: Record<PartName, PartStatus>;
  /**
   * Current step position for each motif sequencer. Reset to 0 whenever
   * global play is (re)engaged, so phrases always start from the top.
   */
  motifPositions: { motif1: number; motif2: number };
}

type Listener = (state: TransportState) => void;

function initialState(): TransportState {
  return {
    globalPlaying: false,
    parts: { pad: 'stopped', drone: 'stopped', motif1: 'stopped', motif2: 'stopped' },
    motifPositions: { motif1: 0, motif2: 0 },
  };
}

/**
 * Observable transport store. Mutations replace `state` with a new object so
 * React's `useSyncExternalStore` sees a stable identity until something
 * actually changes.
 */
export class Transport {
  private state: TransportState = initialState();
  private listeners = new Set<Listener>();

  getState(): TransportState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(next: TransportState): void {
    if (next === this.state) return;
    this.state = next;
    for (const l of this.listeners) l(this.state);
  }

  // -- per-part controls ---------------------------------------------------

  /**
   * Toggle a single part on or off. Turning on arms it (it will start at the
   * next downbeat); turning off stops it immediately.
   */
  togglePart(name: PartName): void {
    const current = this.state.parts[name];
    const next: PartStatus = current === 'stopped' ? 'armed' : 'stopped';
    this.setPartStatus(name, next);
  }

  /** Set an explicit status for one part. */
  setPartStatus(name: PartName, status: PartStatus): void {
    if (this.state.parts[name] === status) return;
    this.commit({
      ...this.state,
      parts: { ...this.state.parts, [name]: status },
    });
  }

  /**
   * Promote any currently-armed parts to `playing`. Intended to be called by
   * the clock on each downbeat (beat 1, pulse 0).
   */
  promoteArmedParts(): void {
    let changed = false;
    const parts = { ...this.state.parts };
    for (const name of ALL_PARTS) {
      if (parts[name] === 'armed') {
        parts[name] = 'playing';
        changed = true;
      }
    }
    if (!changed) return;
    this.commit({ ...this.state, parts });
  }

  // -- global controls -----------------------------------------------------

  /**
   * Toggle global play/pause. Turning on arms all four parts and resets both
   * motif step positions to 0 (resync). Turning off stops all parts (motif
   * positions are preserved so they could be inspected afterwards).
   */
  toggleGlobalPlay(): void {
    this.setGlobalPlay(!this.state.globalPlaying);
  }

  /** Set global play/pause to an explicit value. */
  setGlobalPlay(playing: boolean): void {
    if (this.state.globalPlaying === playing) return;

    if (playing) {
      // Arm all parts and resync both motifs to their first beat.
      this.commit({
        globalPlaying: true,
        parts: {
          pad: 'armed',
          drone: 'armed',
          motif1: 'armed',
          motif2: 'armed',
        },
        motifPositions: { motif1: 0, motif2: 0 },
      });
    } else {
      // Everyone goes silent immediately.
      this.commit({
        ...this.state,
        globalPlaying: false,
        parts: {
          pad: 'stopped',
          drone: 'stopped',
          motif1: 'stopped',
          motif2: 'stopped',
        },
      });
    }
  }

  // -- motif position tracking --------------------------------------------

  /** Update the current step position of a motif sequencer. */
  setMotifPosition(name: 'motif1' | 'motif2', position: number): void {
    if (this.state.motifPositions[name] === position) return;
    this.commit({
      ...this.state,
      motifPositions: { ...this.state.motifPositions, [name]: position },
    });
  }
}

// ---------------------------------------------------------------------------
// React binding
// ---------------------------------------------------------------------------

/**
 * React hook that subscribes a component to a `Transport` store. Uses
 * `useSyncExternalStore` so updates are concurrent-mode-safe and re-renders
 * only happen when state identity changes.
 *
 * @example
 *   const transport = useMemo(() => new Transport(), []);
 *   const state = useTransport(transport);
 */
export function useTransport(transport: Transport): TransportState {
  return useSyncExternalStore(
    (cb) => transport.subscribe(cb),
    () => transport.getState(),
    () => transport.getState(),
  );
}
