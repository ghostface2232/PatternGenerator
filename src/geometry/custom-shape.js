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
import { basePolyVerts } from "./polygon.js";
import { circleRing, normalizeRings, ringsArea, ringsBBox, transformRings } from "./rings.js";
import { differencePolygons, unionPolygons } from "./offset.js";
import { presetRings } from "./shape-presets.js";
import { fitCustomOutline } from "./svg-import.js";
import { arcPoints } from "./rings.js";

export const LAYER_SHAPES = ["Circle", "Rectangle", "Hexagon", "Star", "Triangle", "Diamond", "Polygon"];
export const LAYER_ROLES = ["union", "subtract"];
const SEGMENTS = 64;

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
export function composeLayers(layers) {
  let result = [];
  for (const layer of layers) {
    const rings = layerRings(layer);
    if (!rings.length) continue;
    result = layer.role === "subtract" ? differencePolygons(result, [rings]) : unionPolygons([...result, rings]);
  }
  return result;
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
