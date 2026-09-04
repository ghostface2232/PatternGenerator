import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, patchIn } from "./document.js";
import { DOC_LIMITS } from "./constants.js";
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
  validateDocument,
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

test("validation repairs wrong types instead of letting them reach the app", () => {
  const doc = validateDocument({
    name: { evil: 1 },
    id: 42,
    units: "inch",
    sheet: { w: "abc", h: null },
    hole: { shape: "Blob", diameter: "7", diamondOrient: 3, triEquilateral: "yes" },
    layout: { type: 5, edgeGapX: NaN, radial: { mode: "Nope", centerHole: 1 } },
    taper: { enabled: "true", direction: "Sideways" },
    appearance: { holeColor: "red", bgColor: "#00FF00" },
    variation: null,
  });
  assert.equal(doc.name, "Untitled");
  assert.equal(typeof doc.id, "string");
  assert.equal(doc.units, "mm");
  assert.equal(doc.sheet.w, 200); // "abc" → default
  assert.equal(doc.sheet.h, 200);
  assert.equal(doc.hole.shape, "Circle");
  assert.equal(doc.hole.diameter, 7); // numeric string is accepted
  assert.equal(doc.hole.diamondOrient, "Point up");
  assert.equal(doc.hole.triEquilateral, true);
  assert.equal(doc.layout.type, "Staggered 60°");
  assert.equal(doc.layout.edgeGapX, 3);
  assert.equal(doc.layout.radial.mode, "Full");
  assert.equal(doc.layout.radial.centerHole, false);
  assert.equal(doc.taper.enabled, false);
  assert.equal(doc.taper.direction, "Top larger");
  assert.equal(doc.appearance.holeColor, "#141418");
  assert.equal(doc.appearance.bgColor, "#00FF00");
  assert.ok(Array.isArray(doc.variation.layers) && doc.variation.layers.length === 1);
  // The repaired document still drives the pipeline.
  assert.ok(computePattern(doc).activeHoles.length > 0);
});

test("validation clamps out-of-range numbers to what the UI can produce", () => {
  const doc = validateDocument({
    sheet: { w: 1e7, h: -50 },
    hole: { diameter: 0.0001, cornerRadius: 1e9 },
    layout: { edgeGapX: -5, customAngle: 400 },
    boundary: { margins: { top: 900, left: -3 }, cornerRadius: 1e6 },
    taper: { thickness: 500, angle: 90 },
    variation: { minScale: 9, maxScale: 0.1, quantize: 99, layers: [{ exponent: 1e6, seed: -4, detail: 42 }] },
  });
  assert.equal(doc.sheet.w, 1000);
  assert.equal(doc.sheet.h, 10);
  assert.equal(doc.hole.diameter, 0.5);
  assert.equal(doc.hole.cornerRadius, 30);
  assert.equal(doc.layout.edgeGapX, 0);
  assert.equal(doc.layout.customAngle, 90);
  assert.equal(doc.boundary.margins.top, 50);
  assert.equal(doc.boundary.margins.left, 0);
  assert.equal(doc.boundary.cornerRadius, 500);
  assert.equal(doc.taper.thickness, 10);
  assert.equal(doc.taper.angle, 15);
  assert.ok(doc.variation.minScale <= doc.variation.maxScale);
  assert.equal(doc.variation.quantize, 12);
  assert.equal(doc.variation.layers[0].exponent, 5);
  assert.equal(doc.variation.layers[0].seed, 0);
  assert.equal(doc.variation.layers[0].detail, 6);
  // Every clamp lands on the matching slider bound, so an imported document can
  // never describe a pattern the UI itself could not reach.
  assert.deepEqual(
    [doc.sheet.w, doc.sheet.h, doc.hole.diameter, doc.layout.edgeGapX],
    [
      DOC_LIMITS["sheet.w"][1],
      DOC_LIMITS["sheet.h"][0],
      DOC_LIMITS["hole.diameter"][0],
      DOC_LIMITS["layout.edgeGap"][0],
    ]
  );
});

test("validation repairs the variation block and its layer selection", () => {
  const bad = validateDocument({ variation: { layers: "nope", selectedLayerId: "ghost" } });
  assert.equal(bad.variation.layers.length, 1);
  assert.equal(bad.variation.selectedLayerId, bad.variation.layers[0].id);
  const many = validateDocument({ variation: { layers: [{}, {}, {}, {}, {}] } });
  assert.equal(many.variation.layers.length, 3); // MAX_VARIATION_LAYERS
  const holes = validateDocument({ removedHoles: [3, 3, -1, 2.5, "4", null, 7, "x"] });
  assert.deepEqual(holes.removedHoles, [3, 4, 7]); // numeric strings count, like every other field
});

test("validation drops unknown keys", () => {
  const doc = validateDocument({ ...createDocument(), rogue: 1, hole: { shape: "Pill", rogue: 2 } });
  assert.equal("rogue" in doc, false);
  assert.equal("rogue" in doc.hole, false);
  assert.equal(doc.hole.shape, "Pill");
});

test("no shape JSON can produce makes validation throw", () => {
  const inputs = [
    ["null", null],
    ["undefined", undefined],
    ["number", 7],
    ["string", "text"],
    ["array", []],
    ["null-prototype object", Object.create(null)],
    ["array where an object belongs", { hole: [] }],
    ["deeply nested junk", JSON.parse("[".repeat(200) + "]".repeat(200))],
    ["every branch replaced by an array", { sheet: [], hole: [], layout: [], boundary: [], variation: [], taper: [] }],
    ["every branch replaced by a string", { sheet: "x", hole: "x", layout: "x", boundary: "x", variation: "x" }],
  ];
  for (const [label, input] of inputs) {
    assert.doesNotThrow(() => validateDocument(input), label);
    const doc = validateDocument(input);
    assert.equal(doc.schemaVersion, createDocument().schemaVersion, label);
    assert.doesNotThrow(() => computePattern(doc), `${label} → pipeline`);
  }
});

// A document the validator cannot read is reported, not silently swapped for a
// blank one: openFile alerts, openRecent alerts, a share link falls back to the
// autosaved document, and loadCurrent degrades to a fresh document.
test("an unreadable document surfaces as an error rather than a silent default", () => {
  const hostile = {
    sheet: {},
    get hole() {
      throw new Error("boom");
    },
  };
  assert.throws(() => validateDocument(hostile), /boom/);
  assert.throws(() => deserializeDocument(JSON.stringify({ sheet: 1 })), /not a Perf Pattern/);
});
