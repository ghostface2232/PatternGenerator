import test from "node:test";
import assert from "node:assert/strict";
import { COALESCE_MS, amend, canRedo, canUndo, closeGroup, createHistory, record, redo, undo } from "./history.js";

test("record / undo / redo walk the stacks", () => {
  let h = createHistory("a");
  h = record(h, "b", { now: 0 });
  h = record(h, "c", { now: 5000 });
  assert.equal(h.present, "c");
  assert.equal(canUndo(h), true);
  assert.equal(canRedo(h), false);
  h = undo(h);
  assert.equal(h.present, "b");
  h = undo(h);
  assert.equal(h.present, "a");
  assert.equal(canUndo(h), false);
  h = undo(h); // no-op at the bottom
  assert.equal(h.present, "a");
  h = redo(h);
  h = redo(h);
  assert.equal(h.present, "c");
  assert.equal(canRedo(h), false);
});

test("a new edit after undo discards the redo branch", () => {
  let h = createHistory(1);
  h = record(h, 2, { now: 0 });
  h = undo(h);
  h = record(h, 3, { now: 10000 });
  assert.equal(canRedo(h), false);
  assert.deepEqual(h.past, [1]);
});

test("edits with the same key inside the window coalesce into one step", () => {
  let h = createHistory(0);
  h = record(h, 1, { key: "slider", now: 0 });
  h = record(h, 2, { key: "slider", now: 100 });
  h = record(h, 3, { key: "slider", now: 200 });
  assert.equal(h.present, 3);
  assert.equal(h.past.length, 1);
  h = undo(h);
  assert.equal(h.present, 0);
});

test("a different key, a timeout, or closeGroup() starts a new step", () => {
  let h = createHistory(0);
  h = record(h, 1, { key: "a", now: 0 });
  h = record(h, 2, { key: "b", now: 10 });
  assert.equal(h.past.length, 2);
  h = record(h, 3, { key: "b", now: 10 + COALESCE_MS + 1 });
  assert.equal(h.past.length, 3);
  h = closeGroup(h);
  h = record(h, 4, { key: "b", now: h.lastTime + 1 });
  assert.equal(h.past.length, 4);
});

test("amend changes the present without a history step", () => {
  let h = createHistory("a");
  h = amend(h, "b");
  assert.equal(h.present, "b");
  assert.equal(canUndo(h), false);
});

test("the past is capped at the limit", () => {
  let h = createHistory(0);
  for (let i = 1; i <= 10; i++) h = record(h, i, { now: i * 10000, limit: 3 });
  assert.equal(h.past.length, 3);
  assert.deepEqual(h.past, [7, 8, 9]);
});

test("recording an identical present is a no-op", () => {
  const h = createHistory("a");
  assert.equal(record(h, "a"), h);
});
