import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, patchIn } from "./document.js";
import { computePattern } from "./pipeline.js";
import {
  decodeShareHash,
  deserializeDocument,
  encodeShareHash,
  fileStem,
  loadCurrent,
  loadRecent,
  migrateDocument,
  saveCurrent,
  serializeDocument,
  touchRecent,
} from "./persistence.js";

const memStorage = () => {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
};

test("JSON round trip preserves the document and its pattern", () => {
  const doc = patchIn(createDocument(), {
    name: "Grille",
    "hole.shape": "Hexagon",
    "layout.edgeGapX": 1.2,
    removedHoles: [3, 7],
  });
  const back = deserializeDocument(serializeDocument(doc));
  assert.deepEqual(back, doc);
  assert.equal(computePattern(back).activeHoles.length, computePattern(doc).activeHoles.length);
});

test("share hash round trip drops the id but keeps everything else", () => {
  const doc = patchIn(createDocument(), { name: "Shared", "layout.type": "Radial", "variation.enabled": true });
  const hash = encodeShareHash(doc);
  assert.match(hash, /^#d=[A-Za-z0-9+\-$]+$/);
  const back = decodeShareHash(hash);
  const { id: _id, ...expected } = doc;
  const { id: backId, ...actual } = back;
  assert.deepEqual(actual, expected);
  assert.ok(backId && backId !== doc.id); // migrate fills a fresh id
  assert.equal(decodeShareHash(""), null);
  assert.equal(decodeShareHash("#other=1"), null);
  assert.throws(() => decodeShareHash("#d=!!!garbage"), /damaged|JSON|document/);
});

test("migration fills missing fields from the defaults and upgrades the version", () => {
  const legacy = { sheet: { w: 100, h: 50 }, hole: { shape: "Pill", w: 8 } }; // no schemaVersion, partial hole
  const doc = migrateDocument(legacy);
  assert.equal(doc.schemaVersion, createDocument().schemaVersion);
  assert.equal(doc.sheet.w, 100);
  assert.equal(doc.hole.shape, "Pill");
  assert.equal(doc.hole.h, createDocument().hole.h);
  assert.deepEqual(doc.layout, createDocument().layout);
  assert.ok(doc.id);
  assert.throws(() => migrateDocument({ schemaVersion: 99, sheet: {}, hole: {} }), /newer/);
  assert.throws(() => deserializeDocument("{not json"), /JSON/);
  assert.throws(() => deserializeDocument('{"foo":1}'), /not a Perf Pattern/);
});

test("localStorage autosave and the recent list", () => {
  const storage = memStorage();
  assert.equal(loadCurrent(storage), null);
  const a = patchIn(createDocument(), { name: "A" });
  const b = patchIn(createDocument(), { name: "B", id: "doc-b" });
  saveCurrent(storage, a);
  assert.deepEqual(loadCurrent(storage), a);
  touchRecent(storage, a, 1);
  touchRecent(storage, b, 2);
  touchRecent(storage, { ...a, name: "A2" }, 3); // upsert moves A to the front
  const recent = loadRecent(storage);
  assert.deepEqual(
    recent.map(e => [e.id, e.name, e.updatedAt]),
    [
      [a.id, "A2", 3],
      ["doc-b", "B", 2],
    ]
  );
  for (let i = 0; i < 20; i++) touchRecent(storage, { ...createDocument(), id: `x${i}` }, 10 + i);
  assert.equal(loadRecent(storage).length, 10);
});

test("fileStem sanitises the document name", () => {
  assert.equal(fileStem({ name: "Speaker grille v2" }), "Speaker_grille_v2");
  assert.equal(fileStem({ name: "  /// " }), "pattern");
  assert.equal(fileStem({ name: "환기 패널.최종" }), "환기_패널.최종");
});
