// Variable-width strokes: the geometry behind the Flow Lines layout, where a
// "hole" is not a blob around a point but a slot along a curve.
//
// A stroke is a centreline (`pts`, offsets from the hole's own origin) and a
// half-width at every one of its vertices (`halfW`), so one slot can taper along
// its length wherever the size channel does. Everything here is pure and in
// millimetres; nothing knows what a hole record looks like beyond those two
// arrays.
//
// The outline is built on demand rather than stored: it is twice the size of the
// centreline, only the canvas and the exporters need it, and storing it would
// mean keeping it in step with every edit that rescales a width.
import { clamp } from "../core/math.js";
import { polyArea, segmentGap } from "./polygon.js";

// Chords per end cap. Six reads as round at any zoom the editor offers and keeps
// the exported path short — a document can hold hundreds of these.
const CAP_SEGMENTS = 6;
// How far a corner's offset may be stretched to keep the outline's two sides
// parallel to the centreline through a bend. Past this the bend is sharp enough
// that a mitre would fire off a spike, and a blunt corner is the better lie.
const MAX_MITRE = 3;

export const strokeOf = value =>
  value && Array.isArray(value.pts) && value.pts.length >= 2 && Array.isArray(value.halfW) ? value : null;

// Unit tangent at each vertex: the direction of the curve there, from both
// neighbouring segments where there are two.
function tangents(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push([dx / len, dy / len]);
  }
  return out;
}

// The closed outline of a stroke: one side out, the other side back, with a
// half-disc at each end. Wound clockwise on screen, like every other outline
// here, so `polyArea` and the polygon helpers read it the same way.
export function strokeOutline(stroke) {
  const s = strokeOf(stroke);
  if (!s) return [];
  const { pts, halfW } = s;
  const tan = tangents(pts);
  const width = i => Math.max(0, halfW[Math.min(i, halfW.length - 1)] ?? 0);
  // The offset at a vertex follows the average tangent, stretched by 1/cos of
  // the half-turn so the two sides stay the full width apart through a bend.
  const side = (i, sign) => {
    const [tx, ty] = tan[i];
    const nx = -ty * sign,
      ny = tx * sign;
    const w = width(i);
    let mitre = 1;
    if (i > 0 && i < pts.length - 1) {
      const dx = pts[i][0] - pts[i - 1][0],
        dy = pts[i][1] - pts[i - 1][1];
      const len = Math.hypot(dx, dy) || 1;
      // cos of the angle between the incoming segment and the averaged tangent.
      mitre = clamp(1 / Math.max(1e-3, (dx / len) * tx + (dy / len) * ty), 1, MAX_MITRE);
    }
    return [pts[i][0] + nx * w * mitre, pts[i][1] + ny * w * mitre];
  };
  // The half turn from the side just left, round the end of the line, to the
  // other side — outward, past the last vertex. Sweeping the other way would cut
  // the cap back INTO the slot: a 20 mm slot 4 mm wide came out at 76 mm² where
  // its own rectangle alone is 80.
  const cap = (i, sign) => {
    const [tx, ty] = tan[i];
    const w = width(i);
    if (w <= 0) return [];
    const from = Math.atan2(tx * sign, -ty * sign);
    const arc = [];
    for (let k = 1; k < CAP_SEGMENTS; k++) {
      const a = from - (Math.PI * k) / CAP_SEGMENTS;
      arc.push([pts[i][0] + Math.cos(a) * w, pts[i][1] + Math.sin(a) * w]);
    }
    return arc;
  };
  const last = pts.length - 1;
  const out = [];
  for (let i = 0; i <= last; i++) out.push(side(i, 1));
  out.push(...cap(last, 1));
  for (let i = last; i >= 0; i--) out.push(side(i, -1));
  out.push(...cap(0, -1));
  // Reversed so the result is wound clockwise on screen like every other outline
  // here — the same polygon either way, but only one of the two windings is the
  // one `signedPolyArea` and the convex helpers read as "inside on the left".
  return out.reverse();
}

export const strokeArea = stroke => polyArea(strokeOutline(stroke));

// What bounds the slot: the centreline's extent, opened out by the half-width at
// each vertex. Relative to the hole's origin, like `pts`.
export function strokeBBox(stroke) {
  const s = strokeOf(stroke);
  if (!s) return { left: 0, right: 0, top: 0, bottom: 0 };
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  s.pts.forEach(([x, y], i) => {
    const w = Math.max(0, s.halfW[Math.min(i, s.halfW.length - 1)] ?? 0);
    left = Math.min(left, x - w);
    right = Math.max(right, x + w);
    top = Math.min(top, y - w);
    bottom = Math.max(bottom, y + w);
  });
  return { left, right, top, bottom };
}

export const strokeMaxWidth = stroke => {
  const s = strokeOf(stroke);
  return s ? 2 * Math.max(0, ...s.halfW) : 0;
};

// Half-width where the point (px, py) projects onto the centreline, so a tapered
// slot is tested against the width it actually has there rather than its widest.
export function strokeContains(px, py, stroke) {
  const s = strokeOf(stroke);
  if (!s) return false;
  const { pts, halfW } = s;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1],
      [bx, by] = pts[i];
    const dx = bx - ax,
      dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
    const w = (halfW[i - 1] ?? 0) + ((halfW[i] ?? 0) - (halfW[i - 1] ?? 0)) * t;
    if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= w) return true;
  }
  return false;
}

// The stroke's segments in sheet coordinates, each carrying the widest half-width
// of its two ends. This is what the ligament search walks: two slots are as close
// as their closest pair of segments, and a bounding box around a line that
// crosses the whole panel says nothing at all about where it is.
export function strokeSegments(hole, stroke) {
  const s = strokeOf(stroke);
  if (!s) return [];
  const { pts, halfW } = s;
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    out.push({
      ax: hole.x + pts[i - 1][0],
      ay: hole.y + pts[i - 1][1],
      bx: hole.x + pts[i][0],
      by: hole.y + pts[i][1],
      r: Math.max(halfW[i - 1] ?? 0, halfW[i] ?? 0),
    });
  }
  return out;
}

export function segmentClearance(p, q) {
  return segmentGap([p.ax, p.ay], [p.bx, p.by], [q.ax, q.ay], [q.bx, q.by]) - p.r - q.r;
}

// Clearance between two whole strokes. Quadratic in their segment counts, which
// is why the ligament search pairs SEGMENTS rather than calling this — it is here
// for the shape registry's `gap`, which is asked about one pair at a time.
export function strokeGap(h1, s1, h2, s2) {
  const a = strokeSegments(h1, s1),
    b = strokeSegments(h2, s2);
  if (!a.length || !b.length) return Infinity;
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, segmentClearance(p, q));
  return best;
}

// The share of a slot that lies inside the perforation boundary, applied to the
// area it actually has.
//
// The generic estimator samples a hole's bounding box, which for a slot running
// corner to corner is most of the panel: 144 samples over that box land a handful
// on a shape a few millimetres thick, and the open-area figure came out of the
// noise between them. Walking the centreline instead puts every sample on the
// slot by construction, and the width is the width there.
//
// The walk gives a ratio rather than an area, and `exactArea` — the outline's own
// area, caps and mitres and all — is what it scales. So a slot wholly inside the
// boundary reports exactly what it is, not a second estimate of it.
export function strokeVisibleArea(hole, stroke, exactArea, inside) {
  const s = strokeOf(stroke);
  if (!s) return 0;
  const { pts, halfW } = s;
  const width = i => Math.max(0, halfW[Math.min(i, halfW.length - 1)] ?? 0);
  let total = 0,
    visible = 0;
  const count = (measure, isInside) => {
    total += measure;
    if (isInside) visible += measure;
  };
  for (let i = 1; i < pts.length; i++) {
    const ax = hole.x + pts[i - 1][0],
      ay = hole.y + pts[i - 1][1];
    const bx = hole.x + pts[i][0],
      by = hole.y + pts[i][1];
    const length = Math.hypot(bx - ax, by - ay);
    if (!(length > 0)) continue;
    count(length * (width(i - 1) + width(i)), inside((ax + bx) / 2, (ay + by) / 2));
  }
  // The two end caps, each a half-disc.
  for (const i of [0, pts.length - 1]) {
    const w = width(i);
    if (w > 0) count((Math.PI * w * w) / 2, inside(hole.x + pts[i][0], hole.y + pts[i][1]));
  }
  return total > 0 ? (exactArea * visible) / total : 0;
}
