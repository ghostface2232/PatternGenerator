// The boolean shape editor's maths: a stack of basic shapes, each adding to
// the hole (union) or taking away from it (subtract), composed into one ring
// outline with polygon-clipping (geometry/offset.js) and fitted to the unit
// square as the Custom hole. Pure; the editor's modal is ui/ShapeEditor.jsx.
//
// Layers live in millimetres of the DESIGN — a scratch space of their own, not
// the sheet — because the result is normalised anyway: what the hole's width
// and height then scale is the composed outline's proportions, not these
// numbers. The stack is kept in the document (hole.custom.layers) so the
// editor can reopen it; the composed rings are cached beside it
// (hole.custom.rings) so the pipeline never runs the clipper.
import { clamp } from "../core/math.js";
import { DOC_LIMITS } from "../core/constants.js";
import { basePolyVerts } from "./polygon.js";
import { circleRing, normalizeRings, ringsArea, ringsBBox, ringsContains, transformRings } from "./rings.js";
import { differencePolygons, intersectPolygons, unionPolygons } from "./offset.js";
import { presetRings } from "./shape-presets.js";
import { fitCustomOutline } from "./svg-import.js";
import { arcPoints } from "./rings.js";
import { lockAngleFrom, lockDelta, nearestSpan, snapTo } from "./snap.js";

export const LAYER_SHAPES = ["Circle", "Rectangle", "Hexagon", "Star", "Triangle", "Diamond", "Polygon"];
// The Pathfinder roles, in the order Illustrator's panel lists them: a layer
// adds to what is below it, cuts from it, keeps only where both overlap, or
// keeps where exactly one of them is.
export const LAYER_ROLES = ["union", "subtract", "intersect", "exclude"];
export const LAYER_ROLE_INFO = {
  union: { label: "Union", hint: "Adds to the hole" },
  subtract: { label: "Subtract", hint: "Cuts from the hole" },
  intersect: { label: "Intersect", hint: "Keeps only where it overlaps the hole" },
  exclude: { label: "Exclude", hint: "Keeps where it or the hole is, not both" },
};
const SEGMENTS = 64;
const [COORD_MIN, COORD_MAX] = DOC_LIMITS["layer.coord"];
const [SIZE_MIN, SIZE_MAX] = DOC_LIMITS["layer.size"];
const coord = v => clamp(v, COORD_MIN, COORD_MAX);
const size = v => clamp(v, SIZE_MIN, SIZE_MAX);

// A layer's own outline in unit space (longest side 1, about its centre),
// before its size, rotation and position are applied.
function layerUnitRings(layer) {
  switch (layer.shape) {
    case "Circle":
      return [circleRing(0, 0, 0.5, SEGMENTS)];
    case "Rectangle":
      return [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]; // prettier-ignore
    case "Hexagon": {
      const hex = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        hex.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]);
      }
      return [hex];
    }
    case "Star":
      return presetRings("Star", layer.ratio, layer.count);
    case "Triangle":
      return [basePolyVerts("Triangle", 1, 1)];
    case "Diamond":
      return [basePolyVerts("Diamond", 1, 1)];
    default:
      return [];
  }
}

// A rectangle w × h about the origin with corners of radius r, in millimetres —
// built at size rather than scaled from a unit square, so a rounded bar's
// corners are quarter circles and its full rounding a stadium, not an ellipse.
function roundedRect(w, h, r) {
  const radius = Math.min(Math.max(0, r), w / 2, h / 2);
  if (!(radius > 0)) return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; // prettier-ignore
  const HALF = Math.PI / 2;
  const n = Math.max(4, Math.round(SEGMENTS / 4));
  const corners = [
    [w / 2 - radius, -h / 2 + radius, -HALF],
    [w / 2 - radius, h / 2 - radius, 0],
    [-w / 2 + radius, h / 2 - radius, HALF],
    [-w / 2 + radius, -h / 2 + radius, Math.PI],
  ];
  const ring = [];
  for (const [cx, cy, from] of corners) {
    for (const [x, y] of arcPoints(cx, cy, radius, from, from + HALF, n)) {
      const last = ring[ring.length - 1];
      if (last && Math.hypot(last[0] - x, last[1] - y) < 1e-9) continue;
      ring.push([x, y]);
    }
  }
  const [fx, fy] = ring[0],
    [lx, ly] = ring[ring.length - 1];
  if (Math.hypot(fx - lx, fy - ly) < 1e-9) ring.pop();
  return ring;
}

// A layer's outline in design millimetres.
export function layerRings(layer) {
  if (layer.shape === "Polygon") {
    const points = (layer.points || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    return points.length >= 3 ? normalizeRings([points]) : [];
  }
  const w = Math.max(1e-6, layer.w),
    h = Math.max(1e-6, layer.h);
  const angle = ((layer.rotation || 0) * Math.PI) / 180;
  if (layer.shape === "Rectangle") {
    // `ratio` is the corner radius as a share of half the shorter side: 0 is
    // sharp, 1 a stadium (a circle, for a square).
    const r = (Math.min(1, Math.max(0, layer.ratio ?? 0)) * Math.min(w, h)) / 2;
    return transformRings([roundedRect(w, h, r)], layer.x, layer.y, 1, 1, angle);
  }
  const unit = layerUnitRings(layer);
  if (!unit.length) return [];
  return transformRings(unit, layer.x, layer.y, w, h, angle);
}

export function createShapeLayer(shape, existing = []) {
  const taken = new Set(existing.map(l => l.id));
  let id;
  for (let i = 1; ; i++) {
    id = `layer-${i}`;
    if (!taken.has(id)) break;
  }
  const layer = { id, shape, role: "union", x: 0, y: 0, w: 10, h: 10, rotation: 0, ratio: 0.5, count: 5, points: [] };
  if (shape === "Polygon") {
    layer.points = [
      [0, -5],
      [5, 4],
      [-5, 4],
    ];
  }
  return layer;
}

// Compose in displayed order, so an addition can restore an earlier cut.
// Each result is a list of polygons in design millimetres — [outer, …holes].
// The first layer that contributes anything starts the solid whatever its
// role says, since there is nothing yet to cut from or intersect with — so a
// stack whose first layer is a cut is not silently empty.
export function composeLayers(layers) {
  let result = [];
  let started = false;
  for (const layer of layers) {
    const rings = layerRings(layer);
    if (!rings.length) continue;
    if (!started) {
      if (layer.role === "subtract") continue; // a cut with nothing to cut from
      result = unionPolygons([rings]);
      started = result.length > 0;
      continue;
    }
    if (layer.role === "subtract") result = differencePolygons(result, [rings]);
    else if (layer.role === "intersect") result = intersectPolygons(result, [rings]);
    else if (layer.role === "exclude") {
      const both = intersectPolygons(result, [rings]);
      result = differencePolygons(unionPolygons([...result, rings]), both);
    } else result = unionPolygons([...result, rings]);
  }
  return result;
}

// ─── Direct manipulation ──────────────────────────────────────────────
// The editor's canvas is an SVG in design millimetres; these are the pure
// answers to what a pointer there does, the way the sheet gizmos answer for
// the canvas. Handles: the four corners (resize about the centre; Shift keeps
// the proportions), a rotation knob above the top edge, and — for a polygon
// layer — its vertices.

const rotate = (x, y, angle) => ({ x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) }); // prettier-ignore

export function layerBox(layer) {
  return ringsBBox(layerRings(layer));
}

// The knob's distance above the top edge, in design mm, scaled by the caller
// to what reads as ~20 screen pixels.
export function layerHandles(layer, knobOffset = 3) {
  if (layer.shape === "Polygon") {
    return (layer.points || []).map(([x, y], i) => ({ id: `v${i}`, x, y, role: "vertex", index: i }));
  }
  const angle = ((layer.rotation || 0) * Math.PI) / 180;
  const hw = layer.w / 2,
    hh = layer.h / 2;
  const corner = (id, sx, sy) => {
    const p = rotate(sx * hw, sy * hh, angle);
    return { id, x: layer.x + p.x, y: layer.y + p.y, role: "corner", sx, sy };
  };
  const knob = rotate(0, -hh - knobOffset, angle);
  return [
    corner("nw", -1, -1),
    corner("ne", 1, -1),
    corner("se", 1, 1),
    corner("sw", -1, 1),
    { id: "rotate", x: layer.x + knob.x, y: layer.y + knob.y, role: "rotate" },
  ];
}

// The handle under a point, within `tolerance` design millimetres.
export function hitTestLayerHandles(layer, x, y, tolerance, knobOffset) {
  let hit = null,
    best = tolerance;
  for (const handle of layerHandles(layer, knobOffset)) {
    const d = Math.hypot(handle.x - x, handle.y - y);
    if (d <= best) {
      best = d;
      hit = handle;
    }
  }
  return hit;
}

// The topmost layer under a point: inside its outline, or within `tolerance`
// of it. Later layers are drawn on top, so they win.
export function hitTestLayers(layers, x, y, tolerance = 0) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const rings = layerRings(layers[i]);
    if (!rings.length) continue;
    if (ringsContains(rings, x, y)) return layers[i];
    if (tolerance > 0 && rings.some(ring => nearestSpan(ring, x, y, true)?.distance <= tolerance)) return layers[i];
  }
  return null;
}

export function translateLayer(layer, dx, dy, shift = false) {
  const delta = shift ? lockDelta(dx, dy) : { dx, dy };
  if (layer.shape === "Polygon") {
    return { ...layer, points: (layer.points || []).map(([x, y]) => [coord(x + delta.dx), coord(y + delta.dy)]) };
  }
  return { ...layer, x: coord(layer.x + delta.dx), y: coord(layer.y + delta.dy) };
}

// A handle dragged to (x, y). Corners resize about the centre, the way the
// image controller's corner does; Shift keeps the width-to-height ratio. The
// knob turns the layer, Shift in 15° steps. A vertex simply moves, Shift
// locking it to 45° from the previous one.
export function moveLayerHandle(layer, handle, x, y, shift = false) {
  if (handle.role === "vertex") {
    const points = layer.points || [];
    if (!points[handle.index]) return layer;
    let target = { x, y };
    if (shift) {
      const [ax, ay] = points[(handle.index - 1 + points.length) % points.length];
      target = lockAngleFrom({ x: ax, y: ay }, x, y);
    }
    return { ...layer, points: points.map((p, i) => (i === handle.index ? [coord(target.x), coord(target.y)] : p)) };
  }
  if (handle.role === "rotate") {
    const deg = (Math.atan2(y - layer.y, x - layer.x) * 180) / Math.PI + 90;
    const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
    return { ...layer, rotation: shift ? snapTo(wrapped, 15) : Math.round(wrapped * 10) / 10 };
  }
  if (handle.role === "corner") {
    const angle = ((layer.rotation || 0) * Math.PI) / 180;
    const local = rotate(x - layer.x, y - layer.y, -angle);
    let w = size(Math.abs(local.x) * 2),
      h = size(Math.abs(local.y) * 2);
    if (shift && layer.w > 0 && layer.h > 0) {
      // Keep the proportions: follow whichever axis the cursor pulled further.
      const ratio = layer.h / layer.w;
      if (w * ratio >= h) h = size(w * ratio);
      else w = size(h / ratio);
    }
    return { ...layer, w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 };
  }
  return layer;
}

// A vertex added to a polygon layer on the edge nearest the pointer, or
// removed from it — a double-click, as everywhere else. A polygon keeps three.
export function insertLayerVertexAt(layer, x, y, tolerance = Infinity) {
  if (layer.shape !== "Polygon") return null;
  const points = layer.points || [];
  const span = nearestSpan(points, x, y, true);
  if (!span || span.distance > tolerance) return null;
  const next = points.slice();
  next.splice(span.index + 1, 0, [coord(span.x), coord(span.y)]);
  return { ...layer, points: next };
}

export function removeLayerVertexAt(layer, index) {
  if (layer.shape !== "Polygon" || (layer.points || []).length <= 3) return null;
  return { ...layer, points: layer.points.filter((_, i) => i !== index) };
}

// A copy beside the original, with a fresh id.
export function duplicateLayer(layer, existing) {
  const fresh = createShapeLayer(layer.shape, existing);
  const copy = { ...fresh, ...layer, id: fresh.id };
  copy.points = (layer.points || []).map(([x, y]) => [x, y]);
  const box = layerBox(layer);
  const dx = Math.max(1, Math.round((box.right - box.left) * 0.5 + 1));
  return translateLayer(copy, dx, 0);
}

// The composed stack as the Custom hole's outline: the rings of every piece,
// fitted to the unit square, with the design's proportions in `aspect`. Empty
// rings when the stack composes to nothing.
export function layersToUnitShape(layers, name = "shape") {
  const polygons = composeLayers(layers);
  const rings = polygons.flat();
  const unit = fitCustomOutline(rings);
  return {
    kind: "layers",
    name: String(name || "shape").slice(0, 60),
    rings: unit.rings,
    aspect: unit.aspect,
    lockAspect: true,
    layers: layers.map(layer => ({ ...layer, points: layer.points.map(([x, y]) => [x, y]) })),
  };
}

// For the editor's preview: the design's bounding box over every layer, and
// the composed result's area, in design millimetres.
export function designExtent(layers) {
  const rings = layers.flatMap(layerRings);
  const box = ringsBBox(rings);
  return { box, area: ringsArea(composeLayers(layers).flat()) };
}
