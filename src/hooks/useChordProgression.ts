import { useSyncExternalStore, useCallback } from 'react';
import { sequeenEngine, progressionEngine } from '../engine/appEngines';
import type {
  ChordProgression,
  ChordProgressionSnapshot,
  ChordProgressionStep,
} from '../engine/chordProgression';

/**
 * React hook exposing the progression engine's live state + control surface.
 *
 * State comes from `progressionEngine.getSnapshot()` via `useSyncExternalStore`
 * — the engine only mutates its cached snapshot when something actually
 * changes, so React renders are tight.
 *
 * Transport methods route through `sequeenEngine` (not the raw progression
 * engine) so `playProgression` can auto-start the clock when needed.
 */
export interface UseChordProgressionResult {
  snapshot: ChordProgressionSnapshot;
  load: (progression: ChordProgression) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setLoop: (loop: boolean) => void;
  updateStep: (idx: number, patch: Partial<ChordProgressionStep>) => void;
  addStep: () => void;
  removeStep: (idx: number) => void;
  moveStep: (idx: number, delta: -1 | 1) => void;
}

export function useChordProgression(): UseChordProgressionResult {
  const snapshot = useSyncExternalStore(
    (cb) => progressionEngine.subscribe(cb),
    () => progressionEngine.getSnapshot(),
    () => progressionEngine.getSnapshot(),
  );

  const load = useCallback((p: ChordProgression) => progressionEngine.load(p), []);
  const play = useCallback(() => sequeenEngine.playProgression(), []);
  const pause = useCallback(() => sequeenEngine.pauseProgression(), []);
  const stop = useCallback(() => sequeenEngine.stopProgression(), []);
  const setLoop = useCallback((loop: boolean) => progressionEngine.setLoop(loop), []);
  const updateStep = useCallback(
    (idx: number, patch: Partial<ChordProgressionStep>) => progressionEngine.updateStep(idx, patch),
    [],
  );
  const addStep = useCallback(() => progressionEngine.addStep(), []);
  const removeStep = useCallback((idx: number) => progressionEngine.removeStep(idx), []);
  const moveStep = useCallback(
    (idx: number, delta: -1 | 1) => progressionEngine.moveStep(idx, delta),
    [],
  );

  return { snapshot, load, play, pause, stop, setLoop, updateStep, addStep, removeStep, moveStep };
}
