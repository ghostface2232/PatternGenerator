// Saving and loading documents: JSON files, localStorage autosave with a recent
// list, and compressed share links in the URL hash. All functions are pure or
// take their storage as a parameter so they run under node --test.
import LZString from "lz-string";
import { DOC_SCHEMA_VERSION, createDocument, newDocumentId } from "./document.js";
import {
  DIAMOND_ORIENTATIONS,
  DIN_PRESETS,
  DOC_LIMITS,
  HOLE_SHAPES,
  MAX_ASSET_DATA_URL_CHARS,
  MAX_ASSET_TOTAL_CHARS,
  MAX_ASSETS,
  MAX_VARIATION_LAYERS,
  PATTERN_TYPES,
  RADIAL_LAYOUTS,
  RADIAL_MODES,
  TAPER_DIRECTIONS,
} from "./constants.js";
import { BLEND_MODES, DEFAULT_VARIATION_LAYER, FIELD_SPACES, SIZE_PROFILES } from "../fields/variation-engine.js";
import {
  CHANNEL_INFO,
  CONTROLLER_KINDS,
  FALLOFFS,
  FIELD_CHANNELS,
  KIND_POINT_COUNT,
  MAX_CONTROLLERS,
  ONE_SIDED_VALUES,
} from "../fields/controllers.js";

export const FILE_EXTENSION = ".perf.json";
export const FILE_MIME = "application/json";
export const STORAGE_KEY_CURRENT = "perf-pattern:current";
export const STORAGE_KEY_RECENT = "perf-pattern:recent";
export const RECENT_LIMIT = 10;
export const SHARE_PARAM = "d";

// ─── Migration ────────────────────────────────────────────────────────
// One entry per schema step: MIGRATIONS[n] upgrades version n → n+1.
const MIGRATIONS = {
  // 0 → 1: documents saved before schemaVersion existed carry no version.
  0: doc => ({ ...doc, schemaVersion: 1 }),
  // 1 → 2: Phase 2 adds hole.shapeMix, the `fields` controller block and the
  // `assets` image store. All three are absent from a v1 document and
  // validateDocument fills them from createDocument()'s defaults, which are
  // inert (fields disabled, no controllers, no assets) — so a v1 document reads
  // back with exactly the pattern it was saved with.
  1: doc => ({ ...doc, schemaVersion: 2 }),
  // 2 → 3: Phase 3 adds the layout modes Cross-hatch, Scatter, Spiral and
  // Fibonacci, with `layout.crosshatch` and `layout.scatter` to describe the
  // first two. A v2 document names none of them and carries neither block, so
  // validateDocument fills both from createDocument()'s defaults and the
  // document reads back with the pattern it was saved with — the new blocks are
  // read only by modes a v2 document cannot be in.
  2: doc => ({ ...doc, schemaVersion: 3 }),
};

// ─── Validation ───────────────────────────────────────────────────────
// A document can arrive from a hand-edited file or a share link, so every field
// is rebuilt from the defaults with its own type, range and enum check rather
// than merged in blindly: a wrong type used to crash the render, and an
// out-of-range size could generate millions of holes. Unknown keys are dropped.
export const MAX_REMOVED_HOLES = 200000;
const MAX_NAME_LENGTH = 200;

const num = (value, fallback, path) => {
  // Numbers and numeric strings only: null, booleans and "" must fall back, not
  // coerce to 0 (Number(null) === 0 would silently rewrite a missing field).
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const range = DOC_LIMITS[path];
  return range ? Math.min(range[1], Math.max(range[0], n)) : n;
};
const int = (value, fallback, path) => Math.round(num(value, fallback, path));
const bool = (value, fallback) => (typeof value === "boolean" ? value : fallback);
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const text = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || fallback;
};
const color = (value, fallback) => (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
const obj = value => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

function validateLayer(raw, index) {
  const l = obj(raw);
  const d = DEFAULT_VARIATION_LAYER;
  return {
    id: typeof l.id === "string" && l.id ? l.id.slice(0, 64) : `layer-${index + 1}`,
    enabled: bool(l.enabled, d.enabled),
    locked: bool(l.locked, d.locked),
    opacity: num(l.opacity, d.opacity, "layer.opacity"),
    blendMode: pick(l.blendMode, BLEND_MODES, d.blendMode),
    space: pick(l.space, FIELD_SPACES, d.space),
    profile: pick(l.profile, SIZE_PROFILES, d.profile),
    angle: num(l.angle, d.angle, "layer.angle"),
    centerX: num(l.centerX, d.centerX, "layer.center"),
    centerY: num(l.centerY, d.centerY, "layer.center"),
    radius: num(l.radius, d.radius, "layer.radius"),
    turns: num(l.turns, d.turns, "layer.turns"),
    position: num(l.position, d.position, "layer.position"),
    phase: num(l.phase, d.phase, "layer.phase"),
    frequency: num(l.frequency, d.frequency, "layer.frequency"),
    detail: int(l.detail, d.detail, "layer.detail"),
    steps: int(l.steps, d.steps, "layer.steps"),
    exponent: num(l.exponent, d.exponent, "layer.exponent"),
    jitter: num(l.jitter, d.jitter, "layer.jitter"),
    seed: int(l.seed, d.seed, "layer.seed"),
    mirror: bool(l.mirror, d.mirror),
    invert: bool(l.invert, d.invert),
  };
}

function validateVariation(raw, fallback) {
  const v = obj(raw);
  const source = Array.isArray(v.layers) ? v.layers.slice(0, MAX_VARIATION_LAYERS) : [];
  const layers = (source.length ? source : fallback.layers).map(validateLayer);
  const minScale = num(v.minScale, fallback.minScale, "variation.minScale");
  const maxScale = num(v.maxScale, fallback.maxScale, "variation.maxScale");
  const selected = layers.find(l => l.id === v.selectedLayerId);
  return {
    enabled: bool(v.enabled, fallback.enabled),
    minScale: Math.min(minScale, maxScale),
    maxScale: Math.max(minScale, maxScale),
    quantize: int(v.quantize, fallback.quantize, "variation.quantize"),
    cullBelow: num(v.cullBelow, fallback.cullBelow, "variation.cullBelow"),
    layers,
    selectedLayerId: selected ? selected.id : layers[0].id,
  };
}

// ─── Field controllers ────────────────────────────────────────────────
// A controller carries geometry the pipeline reads for every hole, so a broken
// one is worse than a missing one: a NaN coordinate poisons every distance it
// takes part in. Anything that cannot be repaired into a usable controller is
// dropped rather than passed through — the pattern loses one field, not its
// whole render.
const TARGET_LIMIT = { size: "controller.target.size", spacing: "controller.target.spacing", angle: "controller.target.angle", shape: "controller.target.shape" }; // prettier-ignore

function validatePoints(raw, kind) {
  const { min, max } = KIND_POINT_COUNT[kind];
  if (max === 0) return [];
  if (!Array.isArray(raw)) return null;
  const points = [];
  for (const entry of raw.slice(0, max)) {
    const p = obj(entry);
    const x = num(p.x, NaN, "controller.coord");
    const y = num(p.y, NaN, "controller.coord");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null; // a hole in the path, not a shorter path
    points.push({ x, y });
  }
  return points.length >= min ? points : null;
}

function validatePlacement(raw) {
  const p = obj(raw);
  return {
    x: num(p.x, 0, "controller.coord"),
    y: num(p.y, 0, "controller.coord"),
    w: num(p.w, 50, "controller.image.size"),
    h: num(p.h, 50, "controller.image.size"),
    rotation: num(p.rotation, 0, "controller.image.rotation"),
  };
}

function validateController(raw, index, takenIds) {
  const c = obj(raw);
  const kind = pick(c.kind, CONTROLLER_KINDS, null);
  const channel = pick(c.channel, FIELD_CHANNELS, null);
  if (!kind || !channel) return null;
  const points = validatePoints(obj(c.geometry).points, kind);
  if (points === null) return null;

  let id = typeof c.id === "string" && c.id ? c.id.slice(0, 64) : `ctrl-${index + 1}`;
  while (takenIds.has(id)) id = `${id}-${index + 1}`;
  takenIds.add(id);

  const controller = {
    id,
    channel,
    kind,
    enabled: bool(c.enabled, true),
    geometry: { points },
    target: num(c.target, CHANNEL_INFO[channel].defaultTarget, TARGET_LIMIT[channel]),
    radius: num(c.radius, 40, "controller.radius"),
    falloff: pick(c.falloff, FALLOFFS, "smooth"),
    oneSided: pick(int(c.oneSided, 0), ONE_SIDED_VALUES, 0),
    strength: num(c.strength, 1, "controller.strength"),
    // Checked against the finished list below: a reference to a controller that
    // did not survive validation would leave the geometry resolution walking to
    // a dead end on every hole.
    syncWith: typeof c.syncWith === "string" && c.syncWith && c.syncWith !== id ? c.syncWith.slice(0, 64) : null,
    image: null,
  };
  if (kind === "image") {
    const image = obj(c.image);
    controller.image = {
      assetId: typeof image.assetId === "string" && image.assetId ? image.assetId.slice(0, 64) : null,
      invert: bool(image.invert, false),
      gamma: num(image.gamma, 1, "controller.image.gamma"),
      min: num(image.min, 0, "controller.image.level"),
      max: num(image.max, 1, "controller.image.level"),
      placement: validatePlacement(image.placement),
    };
  }
  return controller;
}

function validateFields(raw, fallback) {
  const f = obj(raw);
  const source = Array.isArray(f.controllers) ? f.controllers.slice(0, MAX_CONTROLLERS) : [];
  const takenIds = new Set();
  const controllers = source.map((entry, i) => validateController(entry, i, takenIds)).filter(Boolean);
  const byId = new Map(controllers.map(c => [c.id, c]));
  for (const controller of controllers) {
    if (!controller.syncWith) continue;
    const target = byId.get(controller.syncWith);
    // A reference to a controller that did not survive validation would leave
    // the geometry resolution walking to a dead end on every hole; a reference
    // across the image boundary is worse, because an image and a path have no
    // geometry in common and the follower would resolve to a kind it cannot be.
    if (!target || target.kind === "image" || controller.kind === "image") controller.syncWith = null;
  }
  return { enabled: bool(f.enabled, fallback.enabled), controllers };
}

// Only assets an image controller still points at are kept: an orphan is dead
// weight in every autosave and file from then on, and nothing can bring it back.
function validateAssets(raw, controllers) {
  const referenced = new Set(controllers.filter(c => c.kind === "image" && c.image?.assetId).map(c => c.image.assetId));
  const assets = {};
  let count = 0;
  let total = 0;
  for (const [key, value] of Object.entries(obj(raw))) {
    if (count >= MAX_ASSETS || !referenced.has(key)) continue;
    const asset = obj(value);
    const dataURL = typeof asset.dataURL === "string" ? asset.dataURL : "";
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataURL)) continue;
    if (dataURL.length > MAX_ASSET_DATA_URL_CHARS) continue;
    // The per-image cap alone does not bound the document: the total is what has
    // to fit in localStorage, so images past the budget are dropped rather than
    // producing a document the autosave can never write.
    if (total + dataURL.length > MAX_ASSET_TOTAL_CHARS) continue;
    total += dataURL.length;
    assets[key] = {
      name: text(asset.name, "image"),
      dataURL,
      width: Math.max(1, int(asset.width, 1)),
      height: Math.max(1, int(asset.height, 1)),
    };
    count++;
  }
  return assets;
}

function validateRemovedHoles(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  for (const value of raw) {
    // Numeric strings are accepted here for the same reason as everywhere else:
    // a hand-written file should not silently lose entries.
    const index = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (Number.isInteger(index) && index >= 0) seen.add(index);
    if (seen.size >= MAX_REMOVED_HOLES) break;
  }
  return [...seen];
}

// Rebuild a complete, in-range document from arbitrary parsed JSON. Every shape
// JSON.parse can produce is handled without throwing; exotic host objects
// (throwing getters, proxies) are not, deliberately. Every caller already turns
// a throw into something useful — "Could not open X", or falling back to the
// autosaved document — and swallowing it here would replace the user's document
// with a blank one and say nothing.
export function validateDocument(raw) {
  const d = createDocument();
  const r = obj(raw);
  const margins = obj(obj(r.boundary).margins);
  const fields = validateFields(r.fields, d.fields);
  const hole = obj(r.hole);
  const layout = obj(r.layout);
  const radial = obj(layout.radial);
  const crosshatch = obj(layout.crosshatch);
  const scatter = obj(layout.scatter);
  const taper = obj(r.taper);
  const appearance = obj(r.appearance);
  const margin = key => num(margins[key], d.boundary.margins[key], "boundary.margins");
  return {
    schemaVersion: DOC_SCHEMA_VERSION,
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : newDocumentId(),
    units: pick(r.units, ["mm"], d.units),
    name: text(r.name, d.name),
    sheet: { w: num(obj(r.sheet).w, d.sheet.w, "sheet.w"), h: num(obj(r.sheet).h, d.sheet.h, "sheet.h") },
    boundary: {
      margins: { top: margin("top"), bottom: margin("bottom"), left: margin("left"), right: margin("right") },
      marginLinked: bool(obj(r.boundary).marginLinked, d.boundary.marginLinked),
      cornerRadius: num(obj(r.boundary).cornerRadius, d.boundary.cornerRadius, "boundary.cornerRadius"),
    },
    hole: {
      shape: pick(hole.shape, HOLE_SHAPES, d.hole.shape),
      diameter: num(hole.diameter, d.hole.diameter, "hole.diameter"),
      w: num(hole.w, d.hole.w, "hole.w"),
      h: num(hole.h, d.hole.h, "hole.h"),
      cornerRadius: num(hole.cornerRadius, d.hole.cornerRadius, "hole.cornerRadius"),
      diamondOrient: pick(hole.diamondOrient, DIAMOND_ORIENTATIONS, d.hole.diamondOrient),
      triEquilateral: bool(hole.triEquilateral, d.hole.triEquilateral),
      shapeMix: num(hole.shapeMix, d.hole.shapeMix, "hole.shapeMix"),
    },
    layout: {
      type: pick(layout.type, PATTERN_TYPES, d.layout.type),
      edgeGapX: num(layout.edgeGapX, d.layout.edgeGapX, "layout.edgeGap"),
      edgeGapY: num(layout.edgeGapY, d.layout.edgeGapY, "layout.edgeGap"),
      gapLinked: bool(layout.gapLinked, d.layout.gapLinked),
      customAngle: num(layout.customAngle, d.layout.customAngle, "layout.customAngle"),
      crosshatch: {
        angleA: num(crosshatch.angleA, d.layout.crosshatch.angleA, "layout.crosshatch.angle"),
        angleB: num(crosshatch.angleB, d.layout.crosshatch.angleB, "layout.crosshatch.angle"),
      },
      // Rounded to an integer as well as clamped: the seed is fed to a 32-bit
      // PRNG, so a fractional one would be truncated somewhere and the document
      // would no longer say what it produces.
      scatter: { seed: int(scatter.seed, d.layout.scatter.seed, "layout.scatter.seed") },
      radial: {
        edgeGap: num(radial.edgeGap, d.layout.radial.edgeGap, "layout.radial.gap"),
        circumGap: num(radial.circumGap, d.layout.radial.circumGap, "layout.radial.gap"),
        linked: bool(radial.linked, d.layout.radial.linked),
        mode: pick(radial.mode, RADIAL_MODES, d.layout.radial.mode),
        layout: pick(radial.layout, RADIAL_LAYOUTS, d.layout.radial.layout),
        centerHole: bool(radial.centerHole, d.layout.radial.centerHole),
      },
    },
    presetIndex: Math.min(DIN_PRESETS.length - 1, Math.max(0, int(r.presetIndex, 0))),
    variation: validateVariation(r.variation, d.variation),
    fields,
    assets: validateAssets(r.assets, fields.controllers),
    taper: {
      enabled: bool(taper.enabled, d.taper.enabled),
      thickness: num(taper.thickness, d.taper.thickness, "taper.thickness"),
      angle: num(taper.angle, d.taper.angle, "taper.angle"),
      direction: pick(taper.direction, TAPER_DIRECTIONS, d.taper.direction),
    },
    appearance: {
      holeColor: color(appearance.holeColor, d.appearance.holeColor),
      bgColor: color(appearance.bgColor, d.appearance.bgColor),
    },
    removedHoles: validateRemovedHoles(r.removedHoles),
  };
}

// Upgrade any older document to the current schema, then validate it.
export function migrateDocument(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Not a document");
  let doc = raw;
  let version = Number.isInteger(doc.schemaVersion) ? doc.schemaVersion : 0;
  if (version > DOC_SCHEMA_VERSION)
    throw new Error(`Document schema ${version} is newer than this app (${DOC_SCHEMA_VERSION})`);
  while (version < DOC_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from schema ${version}`);
    doc = step(doc);
    version++;
  }
  return validateDocument(doc);
}

// ─── JSON ─────────────────────────────────────────────────────────────
export function serializeDocument(doc, pretty = true) {
  return JSON.stringify(doc, null, pretty ? 2 : 0);
}

export function deserializeDocument(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.sheet || !parsed.hole)
    throw new Error("File is not a Perf Pattern document");
  return migrateDocument(parsed);
}

// Safe file name from the document name ("Speaker grille v2" → "Speaker_grille_v2").
export function fileStem(doc) {
  const stem = String(doc.name || "pattern")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return stem || "pattern";
}

// ─── Assets ───────────────────────────────────────────────────────────
// Embedded images are the one part of a document that does not travel. A share
// link has to fit in a URL, and the recent list holds ten whole documents under
// one localStorage key — a few hundred kilobytes of base64 each would blow the
// quota and take the list down with it. Both drop the images and keep
// everything else; the image controllers survive and go inert until a picture is
// loaded again. The `current` autosave keeps them, so a reload is unaffected.
export function stripAssets(doc) {
  if (!doc || !doc.assets || Object.keys(doc.assets).length === 0) return doc;
  return { ...doc, assets: {} };
}

export const hasAssets = doc => Object.keys(doc?.assets || {}).length > 0;

// Drop images no image controller points at any more. Called whenever a
// controller is deleted or given a different picture, so an editing session does
// not accumulate megabytes of base64 nothing can reach. Returns the same object
// when there is nothing to drop, so the autosave still sees an unchanged
// document as unchanged.
export function pruneAssets(doc) {
  const assets = doc.assets || {};
  const keys = Object.keys(assets);
  if (!keys.length) return doc;
  const referenced = new Set(
    (doc.fields?.controllers || []).filter(c => c.kind === "image" && c.image?.assetId).map(c => c.image.assetId)
  );
  const kept = keys.filter(key => referenced.has(key));
  if (kept.length === keys.length) return doc;
  return { ...doc, assets: Object.fromEntries(kept.map(key => [key, assets[key]])) };
}

// An asset key that is free in this document.
export function newAssetId(assets = {}) {
  for (let i = 1; ; i++) {
    const id = `asset-${i}`;
    if (!(id in assets)) return id;
  }
}

// ─── Share links ──────────────────────────────────────────────────────
export function encodeShareHash(doc) {
  const compact = stripAssets({ ...doc });
  delete compact.id; // a shared copy becomes its own document when opened
  return `#${SHARE_PARAM}=${LZString.compressToEncodedURIComponent(JSON.stringify(compact))}`;
}

export function decodeShareHash(hash) {
  if (!hash) return null;
  const match = /^#?(?:.*&)?d=([^&]+)/.exec(hash);
  if (!match) return null;
  const json = LZString.decompressFromEncodedURIComponent(match[1]);
  if (!json) throw new Error("Share link is damaged");
  return deserializeDocument(json);
}

// ─── localStorage autosave + recent list ──────────────────────────────
// `storage` is anything with getItem / setItem / removeItem (localStorage or a Map shim).
export function saveCurrent(storage, doc) {
  storage.setItem(STORAGE_KEY_CURRENT, serializeDocument(doc, false));
}

export function loadCurrent(storage) {
  const text = storage.getItem(STORAGE_KEY_CURRENT);
  if (!text) return null;
  try {
    return deserializeDocument(text);
  } catch {
    return null;
  }
}

export function loadRecent(storage) {
  try {
    const list = JSON.parse(storage.getItem(STORAGE_KEY_RECENT) || "[]");
    if (!Array.isArray(list)) return [];
    const recent = [];
    const seen = new Set();
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      try {
        const doc = migrateDocument(raw.doc);
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        recent.push({
          id: doc.id,
          name: doc.name,
          updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
          doc,
        });
      } catch {
        // One damaged entry must not prevent the application from opening.
      }
      if (recent.length >= RECENT_LIMIT) break;
    }
    return recent;
  } catch {
    return [];
  }
}

// Upsert the document in the recent list (most recent first, capped).
export function touchRecent(storage, doc, now = Date.now()) {
  const entry = { id: doc.id, name: doc.name, updatedAt: now, doc: stripAssets(doc) };
  const rest = loadRecent(storage).filter(e => e && e.id !== doc.id);
  const list = [entry, ...rest].slice(0, RECENT_LIMIT);
  storage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
  return list;
}

export function removeRecent(storage, id) {
  const list = loadRecent(storage).filter(e => e && e.id !== id);
  storage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
  return list;
}
