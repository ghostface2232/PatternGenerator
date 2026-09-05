// Inward offsets and boolean operations on ring outlines, on top of the
// polygon-clipping library (Martinez–Rueda). Everything here is pure and
// deterministic; the library has no randomness in it, so a layout that calls
// through here is still a function of the document alone.
//
// The convex inset in geometry/polygon.js is exact and cheap, and stays the
// route for convex outlines. What it cannot do is erode a concave one: clipping
// by the half-plane of every edge cuts off the parts of a notched outline that
// lie on the far side of a notch's edge. The erosion of any polygon by a disc of
// radius d is the polygon less the disc swept along its own outline, and that
// sweep is a union of capsules — one per edge — which is a difference the
// library computes exactly (to the chords the capsule's caps are drawn with).
import polygonClipping from "polygon-clipping";
import { normalizeRings } from "./rings.js";

// Chords per end cap of a capsule. Twelve keep the cap within 0.35% of its
// radius of the true arc: 0.02 mm at the deepest taper the sliders allow.
const CAP_SEGMENTS = 12;

// Rings in the library's form: a polygon is [outer, hole, hole, …]. The
// library closes its rings (last vertex repeats the first); ours do not, and
// `fromClipping` takes that vertex off again.
const toClipping = rings => rings.map(ring => ring.map(([x, y]) => [x, y]));

// Every polygon of a MultiPolygon as rings again, normalised.
export function fromClipping(multi) {
  const out = [];
  for (const polygon of multi || []) {
    const rings = polygon.map(ring => {
      const pts = ring.map(([x, y]) => [x, y]);
      if (pts.length > 1) {
        const [ax, ay] = pts[0],
          [bx, by] = pts[pts.length - 1];
        if (Math.abs(ax - bx) < 1e-12 && Math.abs(ay - by) < 1e-12) pts.pop();
      }
      return pts;
    });
    const normalised = normalizeRings(rings);
    if (normalised.length) out.push(normalised);
  }
  return out;
}

// A capsule of radius r around the segment a–b, as one ring.
function capsule(a, b, r) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const nx = len > 0 ? -dy / len : 1,
    ny = len > 0 ? dx / len : 0;
  // From the left normal round the far end of b to the right normal, then
  // from there round the near end of a and back — each cap sweeps through the
  // segment's own direction (or its reverse), which is what puts it OUTSIDE the
  // segment rather than folded back over it.
  const base = Math.atan2(ny, nx);
  const ring = [];
  for (let i = 0; i <= CAP_SEGMENTS; i++) {
    const t = base - (Math.PI * i) / CAP_SEGMENTS;
    ring.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]);
  }
  for (let i = 0; i <= CAP_SEGMENTS; i++) {
    const t = base - Math.PI - (Math.PI * i) / CAP_SEGMENTS;
    ring.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]);
  }
  return ring;
}

// The rings eroded by a disc of radius d: every point at least d inside the
// outline. Returns a list of polygons, each [outer, …holes], since an erosion
// can split an outline into pieces, put a hole through a thin one, or close it
// up entirely (an empty list).
export function erodeRings(rings, d) {
  if (!(d > 0)) return rings.length ? [rings] : [];
  const capsules = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) capsules.push([capsule(ring[i], ring[(i + 1) % ring.length], d)]);
  }
  if (!capsules.length) return [];
  try {
    return fromClipping(polygonClipping.difference([toClipping(rings)], ...capsules));
  } catch {
    // The library refuses a few degenerate inputs (a ring that touches itself,
    // say). Nothing to cut is the safe answer: the caller closes the hole.
    return [];
  }
}

// Boolean operations on lists of polygons, each polygon [outer, …holes]. The
// results are lists of polygons in the same form, normalised.
const asMulti = polygons => polygons.map(toClipping);

export function unionPolygons(polygons) {
  if (!polygons.length) return [];
  try {
    return fromClipping(polygonClipping.union(...asMulti(polygons)));
  } catch {
    return [];
  }
}

export function intersectPolygons(a, b) {
  if (!a.length || !b.length) return [];
  try {
    return fromClipping(polygonClipping.intersection(asMulti(a), asMulti(b)));
  } catch {
    return [];
  }
}

export function differencePolygons(a, subtract) {
  if (!a.length) return [];
  if (!subtract.length) return a;
  try {
    return fromClipping(polygonClipping.difference(asMulti(a), asMulti(subtract)));
  } catch {
    return a;
  }
}
