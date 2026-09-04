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
  MAX_VARIATION_LAYERS,
  PATTERN_TYPES,
  RADIAL_LAYOUTS,
  RADIAL_MODES,
  TAPER_DIRECTIONS,
} from "./constants.js";
import { BLEND_MODES, DEFAULT_VARIATION_LAYER, FIELD_SPACES, SIZE_PROFILES } from "../fields/variation-engine.js";

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

function validateRemovedHoles(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  for (const value of raw) {
    if (Number.isInteger(value) && value >= 0) seen.add(value);
    if (seen.size >= MAX_REMOVED_HOLES) break;
  }
  return [...seen];
}

// Rebuild a complete, in-range document from arbitrary parsed JSON.
export function validateDocument(raw) {
  const d = createDocument();
  const r = obj(raw);
  const margins = obj(obj(r.boundary).margins);
  const hole = obj(r.hole);
  const layout = obj(r.layout);
  const radial = obj(layout.radial);
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
    },
    layout: {
      type: pick(layout.type, PATTERN_TYPES, d.layout.type),
      edgeGapX: num(layout.edgeGapX, d.layout.edgeGapX, "layout.edgeGap"),
      edgeGapY: num(layout.edgeGapY, d.layout.edgeGapY, "layout.edgeGap"),
      gapLinked: bool(layout.gapLinked, d.layout.gapLinked),
      customAngle: num(layout.customAngle, d.layout.customAngle, "layout.customAngle"),
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

// ─── Share links ──────────────────────────────────────────────────────
export function encodeShareHash(doc) {
  const compact = { ...doc };
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
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Upsert the document in the recent list (most recent first, capped).
export function touchRecent(storage, doc, now = Date.now()) {
  const entry = { id: doc.id, name: doc.name, updatedAt: now, doc };
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
