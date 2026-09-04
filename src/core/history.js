// Pure undo/redo history over an immutable document.
//
//   { present, past: [...older], future: [...newer], lastKey, lastTime }
//
// record() pushes the previous present onto `past`. Consecutive edits with the
// same `key` inside COALESCE_MS (a slider drag, typing in a field, a gizmo drag)
// collapse into one step so undo reverses the whole gesture, not one tick of it.
// closeGroup() ends the current coalescing run explicitly (e.g. on pointer-up).

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

export function createHistory(present) {
  return { present, past: [], future: [], lastKey: null, lastTime: 0 };
}

export function record(h, next, { key = null, now = Date.now(), limit = HISTORY_LIMIT } = {}) {
  if (next === h.present) return h;
  const coalesce = key !== null && key === h.lastKey && now - h.lastTime < COALESCE_MS;
  if (coalesce) return { ...h, present: next, lastTime: now };
  const past = h.past.length >= limit ? h.past.slice(h.past.length - limit + 1) : h.past;
  return { present: next, past: [...past, h.present], future: [], lastKey: key, lastTime: now };
}

// Change the present without touching the stacks (transient / cosmetic edits).
export function amend(h, next) {
  return next === h.present ? h : { ...h, present: next };
}

export function closeGroup(h) {
  return h.lastKey === null ? h : { ...h, lastKey: null, lastTime: 0 };
}

export function undo(h) {
  if (h.past.length === 0) return h;
  const previous = h.past[h.past.length - 1];
  return {
    present: previous,
    past: h.past.slice(0, -1),
    future: [h.present, ...h.future],
    lastKey: null,
    lastTime: 0,
  };
}

export function redo(h) {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return { present: next, past: [...h.past, h.present], future: rest, lastKey: null, lastTime: 0 };
}

export const canUndo = h => h.past.length > 0;
export const canRedo = h => h.future.length > 0;
