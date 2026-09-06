// The parametric hole shapes of Phase 4: a star, a plus, a cross, a ring, a
// hex nut, a crescent, a row of slots, a teardrop and a heart. Each is a ring
// outline (geometry/rings.js) in UNIT space — centred, with its longest extent
// exactly 1, proportions kept — that the hole's width and height then scale.
// So a 5 × 5 mm star is a star 5 mm across, and W ≠ H stretches it the way
// it stretches a rectangle.
//
// Every preset has one continuous parameter, `ratio` (0…1, read from
// hole.ratio and mapped onto the range the preset names), and some have a
// `count` (hole.count): the points of a star, the slots in a row. The
// outlines are built once per (preset, ratio, count) and cached, since the
// same one is handed to every hole of the document.
import { circleRing, normalizeRings, ringsBBox, transformRings, unitRings } from "./rings.js";
import { differencePolygons, unionPolygons } from "./offset.js";

// Chords per full circle in a preset outline: the same count the superellipse
// draws with, so a ring's bore and a slot's ends read as round at any zoom
// the editor offers, and the area is within 0.2% of the true curve.
const SEGMENTS = 64;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

// Fit rings to unit size keeping their proportions: the longest side of the
// bounding box scaled to 1, about the origin the preset was built around.
//
// About the origin, not the bounding box's centre, on purpose. A star's box
// shifts as its inner radius moves (the points stay, the notches between them
// come and go at the bottom), and recentring on it would move every vertex —
// including the points, whose distance from the centre is what the free-form
// modes space the holes by. Built about the origin, that distance stays put
// and the Inner Radius slider reshapes the hole without moving one. The
// origin is inside every preset's outline, so the hole's centre still lands
// on the hole.
function fit(rings) {
  const normalised = normalizeRings(rings);
  const box = ringsBBox(normalised);
  const size = Math.max(box.right - box.left, box.bottom - box.top);
  if (!(size > 0)) return [];
  return normalised.map(ring => ring.map(([x, y]) => [x / size, y / size]));
}

// A rectangle centred at (cx, cy), optionally with fully round ends along its
// long axis (a stadium) — the slot.
function stadium(cx, cy, w, h) {
  const r = Math.min(w, h) / 2;
  if (w >= h) {
    const s = w / 2 - r;
    const right = [],
      left = [];
    for (let i = 0; i <= SEGMENTS / 2; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / (SEGMENTS / 2);
      right.push([cx + s + Math.cos(a) * r, cy + Math.sin(a) * r]);
      left.push([cx - s - Math.cos(a) * r, cy - Math.sin(a) * r]);
    }
    return right.concat(left);
  }
  const s = h / 2 - r;
  const bottom = [],
    top = [];
  for (let i = 0; i <= SEGMENTS / 2; i++) {
    const a = (Math.PI * i) / (SEGMENTS / 2);
    bottom.push([cx + Math.cos(a) * r, cy + s + Math.sin(a) * r]);
    top.push([cx - Math.cos(a) * r, cy - s - Math.sin(a) * r]);
  }
  return bottom.concat(top);
}

const rect = (cx, cy, w, h) => [
  [cx - w / 2, cy - h / 2],
  [cx + w / 2, cy - h / 2],
  [cx + w / 2, cy + h / 2],
  [cx - w / 2, cy + h / 2],
];

export const SHAPE_PRESETS = {
  Star: {
    ratio: { label: "Inner Radius", min: 0.15, max: 0.9, default: 0.45 },
    count: { label: "Points", min: 3, max: 12, default: 5 },
    rings(inner, points) {
      const ring = [];
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
        const a = -Math.PI / 2 + (Math.PI * i) / points;
        ring.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return [ring];
    },
  },
  Plus: {
    ratio: { label: "Arm Width", min: 0.1, max: 0.9, default: 0.35 },
    rings(arm) {
      return unionPolygons([[rect(0, 0, 1, arm)], [rect(0, 0, arm, 1)]]).flat();
    },
  },
  Cross: {
    ratio: { label: "Arm Width", min: 0.1, max: 0.9, default: 0.3 },
    rings(arm) {
      const plus = unionPolygons([[rect(0, 0, 1, arm)], [rect(0, 0, arm, 1)]]).flat();
      return transformRings(plus, 0, 0, 1, 1, Math.PI / 4);
    },
  },
  Ring: {
    ratio: { label: "Bore", min: 0.1, max: 0.9, default: 0.5 },
    rings(bore) {
      return [circleRing(0, 0, 0.5, SEGMENTS), circleRing(0, 0, 0.5 * bore, SEGMENTS)];
    },
  },
  "Hex Nut": {
    ratio: { label: "Bore", min: 0.1, max: 0.9, default: 0.5 },
    rings(bore) {
      // Pointy-top hexagon of circumradius ½, like the Hexagon hole; the bore
      // is a share of the across-flats width.
      const hex = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        hex.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]);
      }
      const flats = Math.sqrt(3) / 2;
      return [hex, circleRing(0, 0, (flats * bore) / 2, SEGMENTS)];
    },
  },
  Crescent: {
    ratio: { label: "Thickness", min: 0.1, max: 0.9, default: 0.45 },
    rings(thickness) {
      // A disc with a second disc bitten out of it, the bite's centre sliding
      // out along the axis as the crescent thickens. Placed so the origin sits
      // in the middle of the crescent's thick part — the bite would otherwise
      // cover it, and a hole whose centre is not on the hole misses every
      // test that reads the centre.
      const c = lerp(0.12, 0.62, thickness);
      const disc = circleRing((0.96 - c) / 2, 0, 0.5, SEGMENTS);
      const bite = circleRing((0.96 + c) / 2, 0, 0.46, SEGMENTS);
      return differencePolygons([[disc]], [[bite]]).flat();
    },
  },
  Slots: {
    ratio: { label: "Slot Width", min: 0.2, max: 0.85, default: 0.5 },
    count: { label: "Slots", min: 2, max: 8, default: 3 },
    rings(share, slots) {
      // Vertical stadium slots across the width, each `share` of its pitch.
      const pitch = 1 / slots;
      const w = pitch * share;
      const out = [];
      for (let i = 0; i < slots; i++) out.push(stadium(-0.5 + pitch * (i + 0.5), 0, w, 1));
      return out;
    },
  },
  Teardrop: {
    ratio: { label: "Taper", min: 0.1, max: 0.9, default: 0.5 },
    rings(taper) {
      // A disc at the bottom and a point above it, joined by the tangents from
      // the point to the disc. `taper` sets how far above the disc the point
      // sits, from a blunt drop to a long one.
      const r = 0.5;
      const tipY = -r - lerp(0.3, 1.6, taper) * r;
      const d = -tipY; // distance from the disc's centre (at the origin) to the tip
      const theta = Math.acos(r / d);
      const ring = [[0, tipY]];
      // From the right tangent point round the bottom to the left one.
      const from = -Math.PI / 2 + theta,
        to = (3 * Math.PI) / 2 - theta;
      const n = Math.round((SEGMENTS * (to - from)) / TAU);
      for (let i = 0; i <= n; i++) {
        const a = from + ((to - from) * i) / n;
        ring.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return [ring];
    },
  },
  Heart: {
    ratio: { label: "Lobes", min: 0.2, max: 0.8, default: 0.5 },
    rings(lobes) {
      // Two discs and the wedge beneath them, unioned. `lobes` is the discs'
      // radius against the heart's width: round and squat at one end, a
      // narrow point at the other.
      const r = lerp(0.18, 0.32, lobes);
      const cy = -0.5 + r;
      const left = circleRing(-0.5 + r, cy, r, SEGMENTS);
      const right = circleRing(0.5 - r, cy, r, SEGMENTS);
      // The wedge starts at the discs' centres, so the cleft between the lobes
      // ends there and nothing is left pinched between them lower down.
      const wedge = [
        [-0.5 + r, cy],
        [0.5 - r, cy],
        [0, 0.5],
      ];
      return unionPolygons([[left], [right], [wedge]]).flat();
    },
  },
};

export const PRESET_SHAPE_NAMES = Object.keys(SHAPE_PRESETS);
export const isPresetShape = name => Object.prototype.hasOwnProperty.call(SHAPE_PRESETS, name);

// hole.ratio is 0…1 in the document; the preset reads it across its own range.
export const presetRatio = (name, ratio) => {
  const range = SHAPE_PRESETS[name]?.ratio;
  if (!range) return 0;
  const t = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0.5;
  return lerp(range.min, range.max, t);
};
export const presetCount = (name, count) => {
  const range = SHAPE_PRESETS[name]?.count;
  if (!range) return 0;
  const n = Number.isFinite(count) ? Math.round(count) : range.default;
  return Math.min(range.max, Math.max(range.min, n));
};

const cache = new Map();
const CACHE_LIMIT = 64;

// The outline of a preset for a document's hole block, in unit space.
export function presetRings(name, ratio, count) {
  const preset = SHAPE_PRESETS[name];
  if (!preset) return [];
  const r = presetRatio(name, ratio);
  const n = presetCount(name, count);
  const key = `${name}|${r}|${n}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rings = fit(preset.rings(r, n));
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, rings);
  return rings;
}

// Kept for callers that want the fitting rule on its own — the custom shapes
// (imported, or built in the editor) fit to the unit SQUARE instead, since
// their width and height are the user's to set; see unitRings.
export { unitRings };
