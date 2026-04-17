/**
 * Global Zustand store for Sequeen.
 *
 * The store is the source of truth for all UI-visible state. Engines are
 * driven as side effects in `engine/appEngines.ts` via a `subscribe` that
 * reacts to specific slices.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import { KEYS, MODES, type ChordQuality } from './engine/musicTheory';
import type { PartName, PartStatus } from './engine/transport';
import { ALL_PARTS } from './engine/transport';
import type { PadState } from './engine/parts/pad';
import { DEFAULT_PAD_STATE } from './engine/parts/pad';
import type { DroneState } from './engine/parts/drone';
import { DEFAULT_DRONE_STATE } from './engine/parts/drone';
import type { MotifState } from './engine/parts/motif';
import { DEFAULT_MOTIF_STATE } from './engine/parts/motif';
import type { PartMidiConfig } from './engine/midiOutput';
import type { MotifPatternPreset } from './data/presetPatterns';
import type { MotifRhythmPreset } from './data/presetRhythms';
import type { ChordProgression } from './engine/chordProgression';

/** Number of user-saved preset slots for patterns and rhythms each (slots 21–40). */
export const USER_PRESET_SLOTS = 20;

export const CHORD_TYPES_UI = ['Triad', '7th', 'sus2', 'sus4', '6th', 'alt1', 'alt2'] as const;
export type ChordTypeName = (typeof CHORD_TYPES_UI)[number];

export interface GlobalMusicState {
  key: string;
  mode: string;
  degree: number;
  /** Chromatic offset for borrowed chords: -1 flat, 0 natural, +1 sharp. */
  alteration: number;
  /** Quality override for borrowed chords; `'auto'` for diatonic. */
  chordQuality: ChordQuality;
  chordType: ChordTypeName;
  bpm: number;
}

export interface TransportStoreState {
  globalPlaying: boolean;
  parts: Record<PartName, PartStatus>;
  currentBeat: number; // 1..4
}

export interface SequeenStore {
  // ---- music state ----
  music: GlobalMusicState;
  setKey(key: string): void;
  setMode(mode: string): void;
  setDegree(degree: number): void;
  setAlteration(alteration: number): void;
  setChordQuality(quality: ChordQuality): void;
  setChordType(chordType: ChordTypeName): void;
  /** Atomic multi-field chord update (used by the progression engine). */
  setChord(chord: {
    degree: number;
    alteration: number;
    quality: ChordQuality;
    chordType: ChordTypeName;
  }): void;
  setBpm(bpm: number): void;

  // ---- part state ----
  pad: PadState;
  drone: DroneState;
  motif1: MotifState;
  motif2: MotifState;
  setPadParam<K extends keyof PadState>(param: K, value: PadState[K]): void;
  setDroneParam<K extends keyof DroneState>(param: K, value: DroneState[K]): void;
  setMotif1Param<K extends keyof MotifState>(param: K, value: MotifState[K]): void;
  setMotif2Param<K extends keyof MotifState>(param: K, value: MotifState[K]): void;

  // ---- MIDI routing ----
  midiConfigs: Record<PartName, PartMidiConfig>;
  setMidiConfig(part: PartName, config: PartMidiConfig): void;

  // ---- user preset slots ----
  /** 20 slots (indices 0..19, UI labels 21..40). `null` = empty. */
  userPatterns: (MotifPatternPreset | null)[];
  userRhythms: (MotifRhythmPreset | null)[];
  saveUserPattern(slot: number, preset: MotifPatternPreset): void;
  saveUserRhythm(slot: number, preset: MotifRhythmPreset): void;

  // ---- chord progression user library (unbounded list) ----
  customProgressions: ChordProgression[];
  saveCustomProgression(progression: ChordProgression): void;
  deleteCustomProgression(id: string): void;

  // ---- transport ----
  transport: TransportStoreState;
  togglePart(part: PartName): void;
  toggleGlobalPlay(): void;
  /** Internal: pushed from the Transport class subscription. */
  _setTransport(state: TransportStoreState): void;
  /** Internal: pushed from the Clock on each beat. */
  _setCurrentBeat(beat: number): void;
}

function initialMusic(): GlobalMusicState {
  return {
    key: KEYS[0],
    mode: 'Major',
    degree: 1,
    alteration: 0,
    chordQuality: 'auto',
    chordType: 'Triad',
    bpm: 120,
  };
}

function initialTransport(): TransportStoreState {
  return {
    globalPlaying: false,
    parts: { pad: 'stopped', drone: 'stopped', motif1: 'stopped', motif2: 'stopped' },
    currentBeat: 1,
  };
}

function initialMidiConfigs(): Record<PartName, PartMidiConfig> {
  return {
    pad: { portId: '', channel: 1 },
    drone: { portId: '', channel: 2 },
    motif1: { portId: '', channel: 3 },
    motif2: { portId: '', channel: 4 },
  };
}

// In tests (Node) there's no localStorage; fall back to a noop shim so the
// persist middleware can still initialise without crashing on import.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const persistOptions: PersistOptions<SequeenStore, Partial<SequeenStore>> = {
  name: 'sequeen-store-v1',
  version: 3,
  storage: createJSONStorage(() =>
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage
      : noopStorage,
  ),
  // Only persist user-authored state — transport is runtime, functions can't
  // be serialised, and the `isPlaying` bits are owned by the transport class.
  partialize: (state) => ({
    music: state.music,
    pad: state.pad,
    drone: state.drone,
    motif1: state.motif1,
    motif2: state.motif2,
    midiConfigs: state.midiConfigs,
    userPatterns: state.userPatterns,
    userRhythms: state.userRhythms,
    customProgressions: state.customProgressions,
  }),
  // Migration history:
  //   v1 → v2: added `music.alteration` + `music.chordQuality`
  //   v2 → v3: added `customProgressions` (empty array by default)
  // Each step preserves all other state so user settings survive upgrades.
  migrate: (state, version) => {
    if (!state) return state as SequeenStore;
    const s = state as Partial<SequeenStore> & { music?: GlobalMusicState };
    if (version < 2 && s.music && typeof (s.music as GlobalMusicState).alteration === 'undefined') {
      s.music = { ...s.music, alteration: 0, chordQuality: 'auto' };
    }
    if (version < 3 && !s.customProgressions) {
      s.customProgressions = [];
    }
    return s as SequeenStore;
  },
};

export const useStore = create<SequeenStore>()(
  persist(
    (set) => ({
  music: initialMusic(),
  setKey: (key) => {
    if (!KEYS.includes(key as (typeof KEYS)[number])) return;
    set((s) => ({ music: { ...s.music, key } }));
  },
  setMode: (mode) => {
    if (!(mode in MODES)) return;
    set((s) => ({ music: { ...s.music, mode } }));
  },
  setDegree: (degree) => set((s) => ({ music: { ...s.music, degree } })),
  setAlteration: (alteration) =>
    set((s) => {
      const clamped = Math.max(-1, Math.min(1, Math.round(alteration)));
      // Stepping back to natural forces chordQuality → 'auto' since
      // only diatonic chords inherit from the scale.
      const nextQuality: ChordQuality =
        clamped === 0
          ? 'auto'
          : s.music.chordQuality === 'auto'
            ? 'major'
            : s.music.chordQuality;
      return { music: { ...s.music, alteration: clamped, chordQuality: nextQuality } };
    }),
  setChordQuality: (quality) =>
    set((s) => {
      // Diatonic chords ignore explicit quality overrides.
      if (s.music.alteration === 0 && quality !== 'auto') return s;
      return { music: { ...s.music, chordQuality: quality } };
    }),
  setChordType: (chordType) => set((s) => ({ music: { ...s.music, chordType } })),
  setChord: (chord) =>
    set((s) => ({
      music: {
        ...s.music,
        degree: chord.degree,
        alteration: chord.alteration,
        chordQuality: chord.quality,
        chordType: chord.chordType,
      },
    })),
  setBpm: (bpm) => set((s) => ({ music: { ...s.music, bpm: Math.max(10, Math.min(300, bpm)) } })),

  pad: { ...DEFAULT_PAD_STATE, isPlaying: false },
  drone: { ...DEFAULT_DRONE_STATE, isPlaying: false },
  motif1: { ...DEFAULT_MOTIF_STATE, isPlaying: false, midiChannel: 3 },
  motif2: { ...DEFAULT_MOTIF_STATE, isPlaying: false, midiChannel: 4 },

  setPadParam: (param, value) => set((s) => ({ pad: { ...s.pad, [param]: value } })),
  setDroneParam: (param, value) => set((s) => ({ drone: { ...s.drone, [param]: value } })),
  setMotif1Param: (param, value) => set((s) => ({ motif1: { ...s.motif1, [param]: value } })),
  setMotif2Param: (param, value) => set((s) => ({ motif2: { ...s.motif2, [param]: value } })),

  midiConfigs: initialMidiConfigs(),
  setMidiConfig: (part, config) =>
    set((s) => ({ midiConfigs: { ...s.midiConfigs, [part]: config } })),

  userPatterns: Array.from({ length: USER_PRESET_SLOTS }, () => null),
  userRhythms: Array.from({ length: USER_PRESET_SLOTS }, () => null),
  saveUserPattern: (slot, preset) =>
    set((s) => {
      if (slot < 0 || slot >= USER_PRESET_SLOTS) return s;
      const next = [...s.userPatterns];
      next[slot] = preset;
      return { userPatterns: next };
    }),
  saveUserRhythm: (slot, preset) =>
    set((s) => {
      if (slot < 0 || slot >= USER_PRESET_SLOTS) return s;
      const next = [...s.userRhythms];
      next[slot] = preset;
      return { userRhythms: next };
    }),

  customProgressions: [],
  saveCustomProgression: (progression) =>
    set((s) => {
      // Replace existing by id, otherwise append. Keep user progressions
      // in insertion order; the UI can sort separately.
      const existingIdx = s.customProgressions.findIndex((p) => p.id === progression.id);
      if (existingIdx >= 0) {
        const next = [...s.customProgressions];
        next[existingIdx] = progression;
        return { customProgressions: next };
      }
      return { customProgressions: [...s.customProgressions, progression] };
    }),
  deleteCustomProgression: (id) =>
    set((s) => ({ customProgressions: s.customProgressions.filter((p) => p.id !== id) })),

  transport: initialTransport(),
  togglePart: (part) => {
    // Routed through engine; the engine's subscriber calls _setTransport.
    transportBridge.togglePart(part);
  },
  toggleGlobalPlay: () => {
    transportBridge.toggleGlobal();
  },
  _setTransport: (state) =>
    set(() => ({
      transport: {
        globalPlaying: state.globalPlaying,
        parts: state.parts,
        currentBeat: 1, // reset on transport changes
      },
    })),
  _setCurrentBeat: (beat) => set((s) => ({ transport: { ...s.transport, currentBeat: beat } })),
    }),
    persistOptions,
  ),
);

/**
 * Late-bound transport bridge — populated in appEngines.ts once the engine
 * singletons exist. Using a module-level object avoids circular imports.
 */
export const transportBridge = {
  togglePart: (_part: PartName): void => {
    void _part;
  },
  toggleGlobal: (): void => {},
  panic: (): void => {},
};

/** Convenience selector for the 4 parts (used by UI loops). */
export const PART_LIST: readonly PartName[] = ALL_PARTS;
