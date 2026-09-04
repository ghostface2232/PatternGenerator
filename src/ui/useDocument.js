import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { createDocument, patchIn, setIn } from "../core/document.js";
import { patternSignature } from "../core/pipeline.js";
import * as H from "../core/history.js";

// The document reducer with global undo/redo. Every edit goes through:
//   api.set(path, value, opts)   one field ("hole.diameter", 6)
//   api.patch({ ...}, opts)      several fields at once
//   api.update(fn, opts)         arbitrary doc → doc transform
//   api.replace(doc)             load a whole document (clears history)
// opts:
//   merge: "key"   coalesce with the previous step when it has the same key and
//                  happened within COALESCE_MS (slider drags, typing, gizmo drags)
//   record: false  change the present without a history step (transient state)
// Plus api.undo(), api.redo(), api.closeGroup() (end a coalescing run), and
// api.ref.current (the latest document, for pointer handlers).
// Without an explicit merge key, numeric and string edits coalesce under their
// own path (a slider drag or typing), while booleans / selections stand alone.
function autoKey(action) {
  if (action.merge !== undefined) return action.merge;
  if (action.type === "set")
    return typeof action.value === "number" || typeof action.value === "string" ? action.path : null;
  if (action.type === "patch") {
    const values = Object.values(action.patch);
    return values.length && values.every(v => typeof v === "number")
      ? Object.keys(action.patch).sort().join(",")
      : null;
  }
  return null;
}

// Removed-hole indices address one particular generated hole list, so an edit
// that changes the pattern drops them — in the same history step, so undo brings
// both back together. Loading a document (replace/undo/redo) keeps its removals.
function dropStaleRemovals(prev, next) {
  if (next === prev || next.removedHoles.length === 0) return next;
  return patternSignature(prev) === patternSignature(next) ? next : { ...next, removedHoles: [] };
}

function reducer(h, action) {
  const apply = raw => {
    const next = dropStaleRemovals(h.present, raw);
    if (action.record === false) return H.amend(h, next);
    return H.record(h, next, { key: autoKey(action) });
  };
  switch (action.type) {
    case "set":
      return apply(setIn(h.present, action.path, action.value));
    case "patch":
      return apply(patchIn(h.present, action.patch));
    case "update":
      return apply(action.fn(h.present));
    case "replace":
      return H.createHistory(action.doc);
    case "undo":
      return H.undo(h);
    case "redo":
      return H.redo(h);
    case "closeGroup":
      return H.closeGroup(h);
    default:
      return h;
  }
}

export function useDocument(initial) {
  const [h, dispatch] = useReducer(reducer, initial, init =>
    H.createHistory((typeof init === "function" ? init() : init) || createDocument())
  );
  const doc = h.present;
  // Mirror of the current document for code that runs outside React: canvas
  // pointer handlers, the export buttons and the unload flush. A layout effect,
  // not a passive one: layout effects run synchronously as part of the commit,
  // so a listener firing later in the same task as the edit that dispatched it
  // still reads the new document. A passive effect would land after that and
  // hand the listener the previous one.
  const ref = useRef(doc);
  useLayoutEffect(() => {
    ref.current = doc;
  }, [doc]);

  const set = useCallback((path, value, opts = {}) => dispatch({ type: "set", path, value, ...opts }), []);
  const patch = useCallback((patch, opts = {}) => dispatch({ type: "patch", patch, ...opts }), []);
  const update = useCallback((fn, opts = {}) => dispatch({ type: "update", fn, ...opts }), []);
  const replace = useCallback(doc => dispatch({ type: "replace", doc }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const closeGroup = useCallback(() => dispatch({ type: "closeGroup" }), []);

  const canUndo = H.canUndo(h);
  const canRedo = H.canRedo(h);
  const api = useMemo(
    () => ({ set, patch, update, replace, undo, redo, closeGroup, ref, canUndo, canRedo }),
    [set, patch, update, replace, undo, redo, closeGroup, canUndo, canRedo]
  );
  return [doc, api];
}
