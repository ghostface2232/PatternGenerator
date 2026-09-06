// Multi-ring outlines: a shape made of several closed loops read by the even-odd
// rule, so one outline can be a star, a ring with a bore, a row of separate
// slots, or an imported logo with its counters — anything a simple polygon
// cannot be. The preset hole shapes (geometry/shape-presets.js), the imported
// and boolean-built custom holes and the polygon boundary all speak this form.
//
// A `rings` value is an array of rings, each an array of [x, y] vertices. Where
// it stands for a hole it is in UNIT space — the outline's bounding box is the
// square from −½ to ½ on both axes — and the hole's own width and height scale
// it, which is what makes the area of every hole `unitArea × w × h` exactly.
//
// Orientation is normalised once, by `normalizeRings`: an outer ring is wound
// clockwise on screen (positive `signedPolyArea`, like every other outline in
// geometry/), and a ring nested inside an odd number of others — a hole in the
// hole — the other way. Two things depend on that and nothing else does: the
// signed areas then simply add up, and the canvas's default non-zero fill rule
// paints the holes as holes without being told to.
import { distPointSeg, isConvexPoly, isInsidePoly, polyGap, segmentsCross, signedPolyArea } from "./polygon.js";

const f3 = n => n.toFixed(3);

// How many times a point falls inside the rings: odd means inside the shape.
export function ringsContains(rings, x, y) {
  let inside = false;
  for (const ring of rings) if (ring.length >= 3 && isInsidePoly(x, y, ring)) inside = !inside;
  return inside;
}

// A vertex of `ring` that is not shared with `other`, for deciding which of two
// rings sits inside the other. Rings that touch — a union's seam, a bore that
// meets the rim — can share a vertex, and a shared vertex says nothing.
function probeVertex(ring, other) {
  for (const [x, y] of ring) {
    if (!other.some(([ox, oy]) => Math.abs(ox - x) < 1e-9 && Math.abs(oy - y) < 1e-9)) return [x, y];
  }
  return ring[0];
}

// Expects non-intersecting loops; imported overlaps are resolved by
// resolveEvenOddRings before reaching this winding-only helper.
// Rings wound as described above: outer rings positive, rings inside an odd
// number of others negative. Degenerate rings (fewer than three vertices, or
// no extent) are dropped. A ring with extent but no signed area is kept: a
// figure of eight whose lobes cancel is still an outline under the even-odd
// rule, and dropping it would make a boundary drawn that way silently the
// rectangle.
export function normalizeRings(rings) {
  const clean = (Array.isArray(rings) ? rings : [])
    .filter(ring => Array.isArray(ring) && ring.length >= 3)
    .map(ring => ring.map(([x, y]) => [x, y]))
    .filter(ring => {
      const box = ringsBBox([ring]);
      return box.right - box.left > 1e-9 || box.bottom - box.top > 1e-9;
    });
  return clean.map((ring, i) => {
    let depth = 0;
    for (let j = 0; j < clean.length; j++) {
      if (j === i) continue;
      const [px, py] = probeVertex(ring, clean[j]);
      if (isInsidePoly(px, py, clean[j])) depth++;
    }
    const wantPositive = depth % 2 === 0;
    return signedPolyArea(ring) > 0 === wantPositive ? ring : ring.slice().reverse();
  });
}

// Area under the even-odd rule, for normalised rings: the outer rings count and
// the holes in them count against.
export function ringsArea(rings) {
  let sum = 0;
  for (const ring of rings) sum += signedPolyArea(ring);
  return Math.abs(sum);
}

export function ringsBBox(rings) {
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (left === Infinity) return { left: 0, right: 0, top: 0, bottom: 0 };
  return { left, right, top, bottom };
}

// The rings scaled about the origin, turned, and moved to (x, y). Unit-space
// rings become the outline of one hole this way: sx and sy are its width and
// height, angle its rotation.
export function transformRings(rings, x, y, sx = 1, sy = 1, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return rings.map(ring =>
    ring.map(([px, py]) => {
      const lx = px * sx,
        ly = py * sy;
      return [x + lx * c - ly * s, y + lx * s + ly * c];
    })
  );
}

// Fit the rings into the unit square, keeping their aspect ratio's memory in
// the returned `aspect` (height over width) for callers that want to lock it.
// Scaled by its own width and height separately, so the bounding box is exactly
// the unit square and the hole's W and H mean what they mean for a rectangle.
export function unitRings(rings) {
  const normalised = normalizeRings(rings);
  const box = ringsBBox(normalised);
  const w = box.right - box.left,
    h = box.bottom - box.top;
  if (!(w > 0) || !(h > 0)) return { rings: [], aspect: 1 };
  const cx = (box.left + box.right) / 2,
    cy = (box.top + box.bottom) / 2;
  return {
    rings: normalised.map(ring => ring.map(([x, y]) => [(x - cx) / w, (y - cy) / h])),
    aspect: h / w,
  };
}

// Signed clearance between two outlines, each already in sheet coordinates.
//
// Overlap is a crossing between any two rings, or a vertex of one outline inside
// the SOLID of the other (even-odd, so a hole sitting inside another's bore is
// not an overlap — there is metal between them, and this measures it). Disjoint
// outlines are as far apart as their nearest vertex-to-edge pair, over every
// ring: that nearest pair can be on an inner ring, for exactly the bore case.
export function ringsGap(A, B) {
  if (!A.length || !B.length) return Infinity;
  // One plain ring each is the common case, and the polygon clearance handles
  // it — exactly for convex pairs, and with the same rules as below otherwise.
  if (A.length === 1 && B.length === 1) return polyGap(A[0], B[0]);
  // Strictly inside: a vertex on the other's edge is touching, not overlap.
  const edgeDistance = (Q, x, y) => {
    let d = Infinity;
    for (const rq of Q) {
      for (let i = 0; i < rq.length; i++) {
        const a = rq[i],
          b = rq[(i + 1) % rq.length];
        d = Math.min(d, distPointSeg(x, y, a[0], a[1], b[0], b[1]));
      }
    }
    return d;
  };
  const inside = (P, Q) =>
    P.some(ring => ring.some(([x, y]) => ringsContains(Q, x, y) && edgeDistance(Q, x, y) > 1e-9));
  let crossed = false;
  for (const ra of A) {
    for (const rb of B) {
      for (let i = 0; i < ra.length && !crossed; i++) {
        const a = ra[i],
          b = ra[(i + 1) % ra.length];
        for (let j = 0; j < rb.length; j++) {
          if (segmentsCross(a, b, rb[j], rb[(j + 1) % rb.length])) {
            crossed = true;
            break;
          }
        }
      }
      if (crossed) break;
    }
    if (crossed) break;
  }
  if (crossed || inside(A, B) || inside(B, A)) return -0.01;
  let dmin = Infinity;
  for (const [P, Q] of [
    [A, B],
    [B, A],
  ]) {
    for (const rp of P) {
      for (const [px, py] of rp) {
        for (const rq of Q) {
          for (let i = 0; i < rq.length; i++) {
            const a = rq[i],
              b = rq[(i + 1) % rq.length];
            dmin = Math.min(dmin, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
          }
        }
      }
    }
  }
  return dmin;
}

export const ringsConvex = rings => rings.length === 1 && isConvexPoly(rings[0]);

// Canvas path of the rings scaled about (cx, cy). One subpath per ring; the
// orientation normalised above makes the non-zero fill paint holes as holes.
export function ringsTrace(ctx, rings, cx, cy, sx = 1, sy = 1) {
  for (const ring of rings) {
    if (ring.length < 3) continue;
    ctx.moveTo(cx + ring[0][0] * sx, cy + ring[0][1] * sy);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(cx + ring[i][0] * sx, cy + ring[i][1] * sy);
    ctx.closePath();
  }
}

// The same outline as an SVG path `d`, absolute, in sheet millimetres.
export function ringsSVGPath(rings, x, y, sx = 1, sy = 1) {
  return rings
    .filter(ring => ring.length >= 3)
    .map(ring => `M ${ring.map(([px, py]) => `${f3(x + px * sx)} ${f3(y + py * sy)}`).join(" L ")} Z`)
    .join(" ");
}

// ─── Building rings ───────────────────────────────────────────────────

// Douglas–Peucker: the vertices of `points` that keep every dropped one within
// `tolerance` of the simplified line. For a closed ring, pass it open (no
// repeated last vertex); the first and last vertices are always kept.
export function simplifyPolyline(points, tolerance) {
  if (points.length <= 2 || !(tolerance > 0)) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop();
    let worst = -1,
      at = -1;
    const [ax, ay] = points[from],
      [bx, by] = points[to];
    for (let i = from + 1; i < to; i++) {
      const d = distPointSeg(points[i][0], points[i][1], ax, ay, bx, by);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([from, at], [at, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// A closed ring simplified the same way, keeping it closed: the ring is cut at
// its first vertex and at the vertex furthest from it, so neither half can be
// flattened to nothing.
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 3 || !(tolerance > 0)) return ring.slice();
  let far = 0,
    farDist = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const first = simplifyPolyline(ring.slice(0, far + 1), tolerance);
  const second = simplifyPolyline(ring.slice(far).concat([ring[0]]), tolerance);
  return first.concat(second.slice(1, -1));
}

// Points along a circular arc, clockwise on screen from `from` to `to`
// (radians), including both ends, at `segments` chords.
export function arcPoints(cx, cy, r, from, to, segments) {
  const out = [];
  const n = Math.max(1, Math.round(segments));
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// Chords enough that an arc of radius r stays within `tolerance` of its circle:
// the sagitta of a chord spanning θ is r(1 − cos θ/2).
export function arcSegmentsFor(r, sweep, tolerance) {
  if (!(r > 0) || !(tolerance > 0)) return 1;
  const ratio = 1 - tolerance / r;
  if (ratio <= -1) return 1;
  const theta = 2 * Math.acos(Math.max(-1, Math.min(1, ratio)));
  return Math.max(1, Math.ceil(Math.abs(sweep) / Math.max(1e-6, theta)));
}

// A full circle as a ring of `segments` chords, wound clockwise on screen.
export function circleRing(cx, cy, r, segments) {
  const pts = arcPoints(cx, cy, r, 0, Math.PI * 2, segments);
  pts.pop();
  return pts;
}
