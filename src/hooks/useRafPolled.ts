import { useSyncExternalStore } from 'react';

/**
 * Subscribe a component to an arbitrary external getter, polling it once
 * per animation frame.
 *
 * This is a deliberate trade-off: it avoids adding an event-emitter layer
 * to every engine class, at the cost of one React render per frame while
 * the component is mounted. The returned `getSnapshot` MUST return a stable
 * reference (primitive, or the same array/object until it actually changes)
 * so `useSyncExternalStore`'s `Object.is` comparison doesn't fire on every
 * frame. Pad/Drone/Motif engine getters all honour that contract.
 */
export function useRafPolled<T>(getSnapshot: () => T): T {
  return useSyncExternalStore(
    (cb) => {
      let raf = 0;
      const tick = () => {
        cb();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    },
    getSnapshot,
  );
}
