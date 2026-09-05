import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, patchIn } from "./document.js";
import { DOC_LIMITS, MAX_ASSET_DATA_URL_CHARS } from "./constants.js";
import { MAX_CONTROLLERS, MAX_POLYLINE_POINTS } from "../fields/controllers.js";
import { computePattern } from "./pipeline.js";
import {
  decodeShareHash,
  deserializeDocument,
  encodeShareHash,
  fileStem,
  hasAssets,
  loadCurrent,
  loadRecent,
  migrateDocument,
  saveCurrent,
  serializeDocument,
  STORAGE_KEY_RECENT,
  stripAssets,
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

test("the recent list drops damaged entries and normalises valid documents", () => {
  const storage = memStorage();
  const valid = patchIn(createDocument(), { id: "valid", name: "Kept", "sheet.w": 321 });
  storage.setItem(
    STORAGE_KEY_RECENT,
    JSON.stringify([
      null,
      7,
      { id: "stale", name: "Stale metadata", updatedAt: "yesterday", doc: valid },
      { id: "broken", updatedAt: 2, doc: { schemaVersion: 99, sheet: {}, hole: {} } },
      { id: "duplicate", updatedAt: 3, doc: valid },
    ])
  );

  const recent = loadRecent(storage);
  assert.equal(recent.length, 1);
  assert.deepEqual(
    [recent[0].id, recent[0].name, recent[0].updatedAt, recent[0].doc.sheet.w],
    ["valid", "Kept", 0, 321]
  );
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

// ─── Phase 2: controllers, the morph shape and image assets ───────────

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const ctrl = (patch = {}) => ({
  id: "c1",
  channel: "size",
  kind: "point",
  enabled: true,
  geometry: { points: [{ x: 40, y: 60 }] },
  target: 1.6,
  radius: 35,
  falloff: "smooth",
  oneSided: 0,
  strength: 1,
  syncWith: null,
  image: null,
  ...patch,
});

test("controllers survive a file round trip unchanged", () => {
  const doc = patchIn(createDocument(), {
    "hole.shape": "Superellipse",
    "hole.shapeMix": 0.8,
    "fields.enabled": true,
    "fields.controllers": [
      ctrl(),
      ctrl({
        id: "c2",
        channel: "angle",
        kind: "curve",
        target: -35,
        oneSided: -1,
        falloff: "hard",
        syncWith: "c1",
        geometry: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 20 },
            { x: 30, y: 20 },
            { x: 40, y: 0 },
          ],
        },
      }),
    ],
  });
  const back = deserializeDocument(serializeDocument(doc));
  assert.deepEqual(back, doc);
  assert.equal(computePattern(back).activeHoles.length, computePattern(doc).activeHoles.length);
});

test("a v1 document upgrades to the current schema with every later block inert", () => {
  const fresh = createDocument();
  const v1 = { ...fresh, schemaVersion: 1, hole: { ...fresh.hole }, layout: { ...fresh.layout } };
  delete v1.fields;
  delete v1.assets;
  delete v1.hole.shapeMix;
  delete v1.layout.crosshatch;
  delete v1.layout.scatter;
  delete v1.layout.path;
  const upgraded = migrateDocument(v1);
  assert.equal(upgraded.schemaVersion, 4);
  assert.deepEqual(upgraded.fields, { enabled: false, controllers: [] });
  assert.deepEqual(upgraded.assets, {});
  assert.equal(upgraded.hole.shapeMix, fresh.hole.shapeMix);
  // Phase 3's layout blocks are read only by modes a v1 document cannot name.
  assert.deepEqual(upgraded.layout.crosshatch, fresh.layout.crosshatch);
  assert.deepEqual(upgraded.layout.scatter, fresh.layout.scatter);
  assert.deepEqual(upgraded.layout.path, fresh.layout.path);
  // Same pattern as before the upgrade, to the hole.
  assert.equal(computePattern(upgraded).activeHoles.length, 739);
});

test("validation drops the controllers it cannot repair and repairs the rest", () => {
  const doc = validateDocument({
    fields: {
      enabled: "yes",
      selectedId: "ghost", // an older document's selection: dropped, not carried
      controllers: [
        ctrl({ channel: "colour" }), // no such channel
        ctrl({ kind: "blob" }), // no such kind
        ctrl({ kind: "line", geometry: { points: [{ x: 1, y: 1 }] } }), // a line needs two
        ctrl({ geometry: { points: [{ x: 1, y: "nope" }] } }), // a coordinate that is not one
        ctrl({ geometry: null }),
        ctrl({ id: "keep", target: 99, radius: -5, strength: 4, falloff: "wobble", oneSided: 7, syncWith: "gone" }),
      ],
    },
  });
  assert.deepEqual(
    doc.fields.controllers.map(c => c.id),
    ["keep"]
  );
  const [kept] = doc.fields.controllers;
  assert.equal(kept.target, DOC_LIMITS["controller.target.size"][1]);
  assert.equal(kept.radius, DOC_LIMITS["controller.radius"][0]);
  assert.equal(kept.strength, 1);
  assert.equal(kept.falloff, "smooth");
  assert.equal(kept.oneSided, 0);
  assert.equal(kept.syncWith, null, "a reference to a controller that did not survive must be dropped");
  assert.equal(doc.fields.enabled, false); // "yes" is not a boolean
  assert.equal("selectedId" in doc.fields, false); // selection is UI state, not document state
  // The repaired document still drives the pipeline.
  assert.ok(computePattern(doc).activeHoles.length > 0);
});

test("validation caps, de-duplicates and clamps the controller list", () => {
  const many = validateDocument({ fields: { controllers: Array.from({ length: 30 }, () => ctrl()) } });
  assert.equal(many.fields.controllers.length, MAX_CONTROLLERS);
  assert.equal(new Set(many.fields.controllers.map(c => c.id)).size, MAX_CONTROLLERS, "ids must stay unique");
  // A self-reference cannot survive: it would be a cycle of one.
  assert.equal(validateDocument({ fields: { controllers: [ctrl({ syncWith: "c1" })] } }).fields.controllers[0].syncWith, null); // prettier-ignore
  // Coordinates and the shape mix clamp to what the app can reach.
  const wild = validateDocument({
    hole: { shapeMix: 12 },
    fields: { controllers: [ctrl({ geometry: { points: [{ x: 1e9, y: -1e9 }] } })] },
  });
  assert.equal(wild.hole.shapeMix, 1);
  assert.deepEqual(wild.fields.controllers[0].geometry.points[0], {
    x: DOC_LIMITS["controller.coord"][1],
    y: DOC_LIMITS["controller.coord"][0],
  });
  // A polyline longer than the cap is trimmed, not rejected.
  const long = validateDocument({
    fields: {
      controllers: [ctrl({ kind: "polyline", geometry: { points: Array.from({ length: 99 }, (_, i) => ({ x: i, y: i })) } })], // prettier-ignore
    },
  });
  assert.equal(long.fields.controllers[0].geometry.points.length, MAX_POLYLINE_POINTS);
});

test("only assets an image controller still points at are kept", () => {
  const image = ctrl({
    id: "img",
    kind: "image",
    image: { assetId: "a1", invert: true, gamma: 2, min: 0.1, max: 0.9 },
  });
  const doc = validateDocument({
    fields: { controllers: [image] },
    assets: {
      a1: { name: "photo", dataURL: PNG, width: 128, height: 96 },
      orphan: { name: "unused", dataURL: PNG, width: 8, height: 8 },
      bad: { name: "script", dataURL: "javascript:alert(1)", width: 8, height: 8 },
    },
  });
  assert.deepEqual(Object.keys(doc.assets), ["a1"]);
  assert.equal(doc.assets.a1.width, 128);
  assert.equal(doc.fields.controllers[0].image.gamma, 2);
  assert.equal(doc.fields.controllers[0].image.invert, true);
  // An image controller always gets a usable placement, even from nothing.
  assert.ok(doc.fields.controllers[0].image.placement.w > 0);
  // A data URL that is not an image, or is too big to belong in localStorage, goes.
  const huge = "data:image/png;base64," + "A".repeat(MAX_ASSET_DATA_URL_CHARS);
  assert.deepEqual(
    validateDocument({ fields: { controllers: [image] }, assets: { a1: { dataURL: huge } } }).assets,
    {}
  );
});

test("share links and the recent list travel without the images", () => {
  const doc = patchIn(createDocument(), {
    name: "Halftone",
    "fields.enabled": true,
    "fields.controllers": [
      ctrl({ id: "img", kind: "image", image: { assetId: "a1", invert: false, gamma: 1, min: 0, max: 1 } }),
    ],
    assets: { a1: { name: "photo", dataURL: PNG, width: 8, height: 8 } },
  });
  assert.equal(hasAssets(doc), true);
  assert.equal(hasAssets(stripAssets(doc)), false);
  assert.equal(stripAssets(doc).name, "Halftone");
  assert.notEqual(stripAssets(doc), doc, "stripping must not mutate the document it is given");
  assert.deepEqual(doc.assets, { a1: { name: "photo", dataURL: PNG, width: 8, height: 8 } });
  // Nothing to strip → the same object, so an autosave comparison still sees an
  // untouched document as unchanged.
  const plain = createDocument();
  assert.equal(stripAssets(plain), plain);

  // The controller survives the trip; only the picture is left behind, and the
  // controller goes inert rather than reading as black.
  const shared = decodeShareHash(encodeShareHash(doc));
  assert.deepEqual(shared.assets, {});
  assert.equal(shared.fields.controllers.length, 1);
  assert.equal(shared.fields.controllers[0].image.assetId, "a1");
  assert.equal(computePattern(shared).field.length, 0);

  const storage = memStorage();
  touchRecent(storage, doc, 1);
  assert.deepEqual(loadRecent(storage)[0].doc.assets, {});
  assert.equal(loadRecent(storage)[0].doc.fields.controllers.length, 1);
  // The autosave, which a reload reads back, keeps them.
  saveCurrent(storage, doc);
  assert.deepEqual(loadCurrent(storage).assets, doc.assets);
});
