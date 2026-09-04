import { useCallback, useEffect, useRef, useState } from "react";
import { cloneVariation } from "../core/document.js";

const HISTORY_LIMIT = 40;

// Undo/redo for the size-variation block only (the global document history
// arrives in Phase 1). Two write paths:
//   commit(next)  records a history step (discrete edits: toggles, presets, layer ops)
//   live(next)    no history (slider / handle drags); the caller records the
//                 step once at pointer-up via recordDragFrom(startSnapshot)
export function useVariationHistory(variation, setVariation) {
  const ref = useRef(variation);
  const past = useRef([]);
  const future = useRef([]);
  // Stack sizes mirrored into state so canUndo/canRedo re-render correctly.
  const [depth, setDepth] = useState({ past: 0, future: 0 });

  useEffect(() => {
    ref.current = variation;
  }, [variation]);

  const syncDepth = useCallback(() => setDepth({ past: past.current.length, future: future.current.length }), []);

  const resolve = useCallback(nextOrUpdater => {
    const current = ref.current;
    return typeof nextOrUpdater === "function" ? nextOrUpdater(cloneVariation(current)) : nextOrUpdater;
  }, []);

  const commit = useCallback(
    nextOrUpdater => {
      const current = ref.current;
      const next = resolve(nextOrUpdater);
      if (JSON.stringify(current) === JSON.stringify(next)) return;
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), cloneVariation(current)];
      future.current = [];
      ref.current = next;
      setVariation(next);
      syncDepth();
    },
    [resolve, setVariation, syncDepth]
  );

  const live = useCallback(
    nextOrUpdater => {
      const next = resolve(nextOrUpdater);
      ref.current = next;
      setVariation(next);
    },
    [resolve, setVariation]
  );

  const recordDragFrom = useCallback(
    startSnapshot => {
      if (JSON.stringify(startSnapshot) === JSON.stringify(ref.current)) return;
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), startSnapshot];
      future.current = [];
      syncDepth();
    },
    [syncDepth]
  );

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(cloneVariation(ref.current));
    ref.current = previous;
    setVariation(previous);
    syncDepth();
  }, [setVariation, syncDepth]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(cloneVariation(ref.current));
    ref.current = next;
    setVariation(next);
    syncDepth();
  }, [setVariation, syncDepth]);

  return { ref, commit, live, recordDragFrom, undo, redo, canUndo: depth.past > 0, canRedo: depth.future > 0 };
}
