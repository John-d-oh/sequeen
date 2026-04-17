/**
 * React / Zustand binding for the master SequeenEngine.
 *
 * All engine logic lives in `SequeenEngine.ts`. This module instantiates a
 * single engine for the lifetime of the page, wires it to the production
 * `MidiPortManager`, and mirrors:
 *
 *   Zustand store  →  SequeenEngine  (user edits drive engine state)
 *   SequeenEngine     →  Zustand store  (transport/beat state drive the UI)
 *
 * Subscriptions are set up once in `initAppEngines()` and never torn down;
 * call it once at mount time.
 */

import { MidiPortManager } from './midiOutput';
import { SequeenEngine } from './SequeenEngine';
import { ALL_PARTS } from './transport';
import { useStore, transportBridge, type SequeenStore } from '../store';

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

export const midiPortManager = new MidiPortManager();

export const sequeenEngine = new SequeenEngine({
  midiManager: midiPortManager,
});

// Convenience re-exports for components that imported from this module before.
export const clock = sequeenEngine.clock;
export const transport = sequeenEngine.transport;
export const noteTracker = sequeenEngine.noteTracker;
export const padEngine = sequeenEngine.padEngine;
export const droneEngine = sequeenEngine.droneEngine;
export const motif1Engine = sequeenEngine.motif1Engine;
export const motif2Engine = sequeenEngine.motif2Engine;
export const progressionEngine = sequeenEngine.progressionEngine;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

let initialised = false;

export async function initAppEngines(): Promise<void> {
  if (initialised) return;
  initialised = true;

  await midiPortManager.init();

  // Push transport state → store so the UI reflects armed / playing states.
  transport.subscribe((tState) => {
    useStore.getState()._setTransport({
      globalPlaying: tState.globalPlaying,
      parts: tState.parts,
      currentBeat: 1,
    });
  });

  // Late-bound actions so store-level callers don't need to import the engine.
  transportBridge.togglePart = (part) => sequeenEngine.togglePart(part);
  transportBridge.toggleGlobal = () => sequeenEngine.toggleGlobalPlay();
  transportBridge.panic = () => sequeenEngine.panic();

  // Route progression step advances through the Zustand store, which
  // fans out to the engines via the existing chord-change bridge. This
  // keeps UI (store-subscribed) and engine state in lock-step.
  sequeenEngine.setProgressionStepHandler((step) => {
    useStore.getState().setChord({
      degree: step.degree,
      alteration: step.alteration,
      quality: step.quality,
      chordType: step.chordType as never,
    });
  });

  // Beat indicator: update the store once per downbeat.
  let lastBeat = 0;
  clock.onPulse((pulseInBeat, beat) => {
    if (pulseInBeat === 0 && beat !== lastBeat) {
      useStore.getState()._setCurrentBeat(beat);
      lastBeat = beat;
    }
  });

  // Mirror store slices → engine setters. Each slice comparison is cheap
  // (reference equality after an immutable update).
  useStore.subscribe((state, prev) => {
    if (state.music !== prev.music) applyMusic(state, prev);
    if (state.pad !== prev.pad) applyPart('pad', state.pad, prev.pad);
    if (state.drone !== prev.drone) applyPart('drone', state.drone, prev.drone);
    if (state.motif1 !== prev.motif1) applyPart('motif1', state.motif1, prev.motif1);
    if (state.motif2 !== prev.motif2) applyPart('motif2', state.motif2, prev.motif2);
    if (state.midiConfigs !== prev.midiConfigs) applyMidiRouting(state.midiConfigs);
  });

  // Seed the engine with the current store state. This covers two cases at
  // once:
  //   1. localStorage hydration — persist middleware restores music/part
  //      state synchronously during store creation, before the engine's
  //      subscribers are wired, so those restored values need an explicit
  //      push into the engine instances.
  //   2. HMR / test scenarios where the engine was re-instantiated but the
  //      store kept its state.
  seedEngineFromStore();
}

/**
 * One-shot: push every relevant slice of the current store into the
 * corresponding engine method. Idempotent — each setter no-ops if the value
 * hasn't actually changed.
 */
function seedEngineFromStore(): void {
  const s = useStore.getState();

  // Music
  sequeenEngine.setKey(s.music.key);
  sequeenEngine.setMode(s.music.mode);
  sequeenEngine.setChordType(s.music.chordType);
  sequeenEngine.setDegree(s.music.degree);
  sequeenEngine.setAlteration(s.music.alteration);
  sequeenEngine.setChordQuality(s.music.chordQuality);
  sequeenEngine.setBpm(s.music.bpm);

  // MIDI routing
  applyMidiRouting(s.midiConfigs);

  // Part parameters
  for (const key of Object.keys(s.pad) as Array<keyof typeof s.pad>) {
    if (key === 'isPlaying') continue;
    sequeenEngine.setPadParam(key as never, s.pad[key] as never);
  }
  for (const key of Object.keys(s.drone) as Array<keyof typeof s.drone>) {
    if (key === 'isPlaying') continue;
    sequeenEngine.setDroneParam(key as never, s.drone[key] as never);
  }
  for (const key of Object.keys(s.motif1) as Array<keyof typeof s.motif1>) {
    if (key === 'isPlaying') continue;
    sequeenEngine.setMotif1Param(key as never, s.motif1[key] as never);
  }
  for (const key of Object.keys(s.motif2) as Array<keyof typeof s.motif2>) {
    if (key === 'isPlaying') continue;
    sequeenEngine.setMotif2Param(key as never, s.motif2[key] as never);
  }
}

// ---------------------------------------------------------------------------
// Store → engine sync helpers
// ---------------------------------------------------------------------------

function applyMusic(next: SequeenStore, prev: SequeenStore): void {
  const m = next.music;
  const p = prev.music;
  if (m.bpm !== p.bpm) sequeenEngine.setBpm(m.bpm);
  if (m.key !== p.key) sequeenEngine.setKey(m.key);
  if (m.mode !== p.mode) sequeenEngine.setMode(m.mode);

  // Collapse all four chord fields into one atomic update. This is both
  // a perf win (one propagate call instead of up to four) and a correctness
  // fix: when the progression engine pushes a multi-field chord change
  // (e.g. degree AND alteration AND quality in one store.setChord call),
  // individual setters would propagate transient intermediate states to
  // the pad / drone / motifs.
  const chordDiff =
    m.degree !== p.degree ||
    m.alteration !== p.alteration ||
    m.chordQuality !== p.chordQuality ||
    m.chordType !== p.chordType;
  if (chordDiff) {
    sequeenEngine.setChord({
      degree: m.degree,
      alteration: m.alteration,
      quality: m.chordQuality,
      chordType: m.chordType,
    });
  }
}

type PartSlice = 'pad' | 'drone' | 'motif1' | 'motif2';

function applyPart<S extends SequeenStore[PartSlice]>(
  part: PartSlice,
  next: S,
  prev: S,
): void {
  for (const key of Object.keys(next) as Array<keyof S>) {
    if (key === 'isPlaying') continue; // owned by transport
    if (next[key] === prev[key]) continue;
    switch (part) {
      case 'pad':
        sequeenEngine.setPadParam(key as never, next[key] as never);
        break;
      case 'drone':
        sequeenEngine.setDroneParam(key as never, next[key] as never);
        break;
      case 'motif1':
        sequeenEngine.setMotif1Param(key as never, next[key] as never);
        break;
      case 'motif2':
        sequeenEngine.setMotif2Param(key as never, next[key] as never);
        break;
    }
  }
}

function applyMidiRouting(configs: SequeenStore['midiConfigs']): void {
  for (const part of ALL_PARTS) {
    sequeenEngine.setPartConfig(part, configs[part]);
  }
}
