// Saving and loading documents: JSON files, localStorage autosave with a recent
// list, and compressed share links in the URL hash. All functions are pure or
// take their storage as a parameter so they run under node --test.
import LZString from "lz-string";
import { DOC_SCHEMA_VERSION, createDocument, newDocumentId } from "./document.js";
import {
  BOUNDARY_SHAPES,
  CUTOUT_SHAPES,
  DIAMOND_ORIENTATIONS,
  DIN_PRESETS,
  DOC_LIMITS,
  HOLE_SHAPES,
  MAX_BOUNDARY_POINTS,
  MAX_BOUNDARY_RINGS,
  MAX_CUSTOM_POINTS,
  MAX_CUSTOM_RINGS,
  MAX_CUTOUT_POINTS,
  MAX_CUTOUTS,
  MAX_SHAPE_LAYERS,
  MAX_ASSET_DATA_URL_CHARS,
  MAX_ASSET_TOTAL_CHARS,
  MAX_ASSETS,
  MAX_PATHS,
  MAX_PATH_POINTS,
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
  // 3 → 4: the Path layout, with `layout.path` describing the curves holes are
  // strung along. A v3 document cannot name that mode and carries no such block,
  // so validateDocument fills it from createDocument()'s default — an empty list
  // of curves, which the layout only reads when Path is the mode.
  3: doc => ({ ...doc, schemaVersion: 4 }),
  // 4 → 5: the Voronoi and Flow Lines layouts. Voronoi needed no new block — it
  // sows its cell sites from `layout.scatter.seed`, which v4 already carries —
  // and Flow Lines adds `layout.flow` for the direction its lines head in where
  // no controller says otherwise. A v4 document can name neither mode, so
  // validateDocument filling the block from the default reads its pattern back
  // unchanged.
  4: doc => ({ ...doc, schemaVersion: 5 }),
  // 5 → 6: Phase 4 gives the boundary a shape (Rectangle, Ellipse, Polygon),
  // its polygon rings, a list of cutouts and the trim flag. A v5 document has
  // none of them and validateDocument fills all four from createDocument()'s
  // defaults — a Rectangle with no cutouts, not trimmed — which is exactly the
  // margin-inset rectangle it was saved with.
  5: doc => ({ ...doc, schemaVersion: 6 }),
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

// The Path layout's curves. A vertex with a coordinate that is not a number
// poisons every distance the walk takes, so — as with a controller's geometry —
// a curve that cannot be repaired is dropped whole rather than passed through
// with a hole in it.
function validatePaths(raw) {
  if (!Array.isArray(raw)) return [];
  const paths = [];
  for (const entry of raw.slice(0, MAX_PATHS)) {
    const source = obj(entry);
    const rawPoints = Array.isArray(source.points) ? source.points.slice(0, MAX_PATH_POINTS) : [];
    const points = [];
    let broken = false;
    for (const p of rawPoints) {
      const point = obj(p);
      const x = num(point.x, NaN, "layout.path.coord");
      const y = num(point.y, NaN, "layout.path.coord");
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        broken = true;
        break;
      }
      points.push({ x, y });
    }
    if (broken || points.length < 2) continue;
    paths.push({ points, closed: bool(source.closed, false) });
  }
  return paths;
}

// ─── Boundary ─────────────────────────────────────────────────────────
// A ring is a list of [x, y] pairs in sheet millimetres. One vertex that is not
// a number would poison every containment test the region answers, so a ring
// that cannot be repaired is dropped whole, like a controller's geometry; a
// ring longer than the cap is cut at it rather than dropped, since an outline
// with its last vertices missing is still nearly the outline.
function validateRing(raw, cap) {
  if (!Array.isArray(raw)) return null;
  const ring = [];
  for (const p of raw.slice(0, cap)) {
    const pair = Array.isArray(p) ? p : p && typeof p === "object" ? [p.x, p.y] : null;
    if (!pair) return null;
    const x = num(pair[0], NaN, "boundary.coord");
    const y = num(pair[1], NaN, "boundary.coord");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    ring.push([x, y]);
  }
  return ring.length >= 3 ? ring : null;
}

function validateRings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_BOUNDARY_RINGS)
    .map(ring => validateRing(ring, MAX_BOUNDARY_POINTS))
    .filter(Boolean);
}

function validateCutouts(raw) {
  if (!Array.isArray(raw)) return [];
  const cutouts = [];
  const takenIds = new Set();
  for (const [index, entry] of raw.slice(0, MAX_CUTOUTS).entries()) {
    const c = obj(entry);
    const shape = pick(c.shape, CUTOUT_SHAPES, null);
    if (!shape) continue;
    const points = shape === "Polygon" ? validateRing(c.points, MAX_CUTOUT_POINTS) : [];
    if (shape === "Polygon" && !points) continue;
    let id = typeof c.id === "string" && c.id ? c.id.slice(0, 64) : `cut-${index + 1}`;
    while (takenIds.has(id)) id = `${id}-${index + 1}`;
    takenIds.add(id);
    cutouts.push({
      id,
      shape,
      x: num(c.x, 0, "boundary.coord"),
      y: num(c.y, 0, "boundary.coord"),
      w: num(c.w, 10, "cutout.size"),
      h: num(c.h, 10, "cutout.size"),
      rotation: num(c.rotation, 0, "cutout.rotation"),
      cornerRadius: num(c.cornerRadius, 0, "cutout.cornerRadius"),
      points: points || [],
    });
  }
  return cutouts;
}

// ─── The Custom hole shape ────────────────────────────────────────────
// An outline in unit space: rings of [x, y] pairs within the unit square (a
// little slack for a vertex that rounding pushed over), read by the even-odd
// rule. A ring that cannot be repaired is dropped, like a boundary ring.
const CUSTOM_KINDS = ["none", "svg", "layers"];
const LAYER_SHAPES = ["Circle", "Rectangle", "Hexagon", "Star", "Triangle", "Diamond", "Polygon"];
const LAYER_ROLES = ["union", "subtract"];

function validateUnitRing(raw) {
  if (!Array.isArray(raw)) return null;
  const ring = [];
  for (const p of raw.slice(0, MAX_CUSTOM_POINTS)) {
    const pair = Array.isArray(p) ? p : null;
    if (!pair) return null;
    const x = num(pair[0], NaN, "custom.coord");
    const y = num(pair[1], NaN, "custom.coord");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    ring.push([x, y]);
  }
  return ring.length >= 3 ? ring : null;
}

function validateShapeLayers(raw) {
  if (!Array.isArray(raw)) return [];
  const layers = [];
  const takenIds = new Set();
  for (const [index, entry] of raw.slice(0, MAX_SHAPE_LAYERS).entries()) {
    const l = obj(entry);
    const shape = pick(l.shape, LAYER_SHAPES, null);
    if (!shape) continue;
    let id = typeof l.id === "string" && l.id ? l.id.slice(0, 64) : `layer-${index + 1}`;
    while (takenIds.has(id)) id = `${id}-${index + 1}`;
    takenIds.add(id);
    const points = shape === "Polygon" ? validateRing(l.points, MAX_CUSTOM_POINTS) : [];
    if (shape === "Polygon" && !points) continue;
    layers.push({
      id,
      shape,
      role: pick(l.role, LAYER_ROLES, "union"),
      x: num(l.x, 0, "layer.coord"),
      y: num(l.y, 0, "layer.coord"),
      w: num(l.w, 10, "layer.size"),
      h: num(l.h, 10, "layer.size"),
      rotation: num(l.rotation, 0, "layer.rotation"),
      // The preset-like parameters a Star or Rectangle layer reads.
      ratio: num(l.ratio, 0.5, "hole.ratio"),
      count: int(l.count, 5, "hole.count"),
      points: points || [],
    });
  }
  return layers;
}

function validateCustomShape(raw, fallback) {
  const c = obj(raw);
  const rings = Array.isArray(c.rings) ? c.rings.slice(0, MAX_CUSTOM_RINGS).map(validateUnitRing).filter(Boolean) : [];
  const kind = pick(c.kind, CUSTOM_KINDS, fallback.kind);
  return {
    kind: rings.length ? kind : "none",
    name: typeof c.name === "string" ? c.name.trim().slice(0, 60) : fallback.name,
    rings,
    aspect: num(c.aspect, fallback.aspect, "custom.aspect"),
    lockAspect: bool(c.lockAspect, fallback.lockAspect),
    layers: validateShapeLayers(c.layers),
  };
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
      shape: pick(obj(r.boundary).shape, BOUNDARY_SHAPES, d.boundary.shape),
      rings: validateRings(obj(r.boundary).rings),
      cutouts: validateCutouts(obj(r.boundary).cutouts),
      trim: bool(obj(r.boundary).trim, d.boundary.trim),
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
      ratio: num(hole.ratio, d.hole.ratio, "hole.ratio"),
      count: int(hole.count, d.hole.count, "hole.count"),
      custom: validateCustomShape(hole.custom, d.hole.custom),
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
      path: {
        paths: validatePaths(obj(layout.path).paths),
        smooth: bool(obj(layout.path).smooth, d.layout.path.smooth),
        alignToTangent: bool(obj(layout.path).alignToTangent, d.layout.path.alignToTangent),
      },
      flow: { angle: num(obj(layout.flow).angle, d.layout.flow.angle, "layout.flow.angle") },
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
