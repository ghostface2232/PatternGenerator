import { useCallback, useMemo, useReducer } from "react";
import { createDocument, patchIn, setIn } from "../core/document.js";

// Single reducer over the document. Every edit goes through one of:
//   api.set(path, value)   one field ("hole.diameter", 6)
//   api.patch({ ...})      several fields at once
//   api.update(fn)         arbitrary doc → doc transform
//   api.replace(doc)       load a whole document
// Global undo/redo (Phase 1) will wrap these actions; keep new edits on this API.
function reducer(doc, action) {
  switch (action.type) {
    case "set":
      return setIn(doc, action.path, action.value);
    case "patch":
      return patchIn(doc, action.patch);
    case "update":
      return action.fn(doc);
    case "replace":
      return action.doc;
    default:
      return doc;
  }
}

export function useDocument(initial) {
  const [doc, dispatch] = useReducer(reducer, initial, init => init || createDocument());
  const set = useCallback((path, value) => dispatch({ type: "set", path, value }), []);
  const patch = useCallback(patch => dispatch({ type: "patch", patch }), []);
  const update = useCallback(fn => dispatch({ type: "update", fn }), []);
  const replace = useCallback(doc => dispatch({ type: "replace", doc }), []);
  const api = useMemo(() => ({ set, patch, update, replace }), [set, patch, update, replace]);
  return [doc, api];
}
