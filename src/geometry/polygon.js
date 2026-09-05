// Polygon helpers: the convex ones the Diamond and Triangle hole shapes rely on,
// the general ones (even-odd containment, clearance, reflex-aware corner
// rounding) that concave outlines need, and the segment / point utilities the
// gap (ligament) computations share. All coordinates are millimetres in sheet
// space (y down).
import { clamp } from "../core/math.js";

export function distPointSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Unit vector from point `from` toward point `to`.
export function unitToward(from, to) {
  const dx = to[0] - from[0],
    dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

export function orient2d(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function segmentsIntersect(a, b, c, d) {
  const abC = orient2d(a, b, c),
    abD = orient2d(a, b, d);
  const cdA = orient2d(c, d, a),
    cdB = orient2d(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  const onSegment = (p, q, r) =>
    Math.abs(orient2d(p, q, r)) < 1e-9 &&
    r[0] >= Math.min(p[0], q[0]) - 1e-9 &&
    r[0] <= Math.max(p[0], q[0]) + 1e-9 &&
    r[1] >= Math.min(p[1], q[1]) - 1e-9 &&
    r[1] <= Math.max(p[1], q[1]) + 1e-9;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

// Shortest distance between two segments (0 when they cross).
export function segmentGap(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distPointSeg(a[0], a[1], c[0], c[1], d[0], d[1]),
    distPointSeg(b[0], b[1], c[0], c[1], d[0], d[1]),
    distPointSeg(c[0], c[1], a[0], a[1], b[0], b[1]),
    distPointSeg(d[0], d[1], a[0], a[1], b[0], b[1])
  );
}

// Shoelace area, signed: positive when the polygon is wound the way
// `isInsideConvexPoly` expects (clockwise on screen, since y runs down). The
// sign is what tells `insetConvexPoly` which side of an edge the inside is on.
export function signedPolyArea(verts) {
  let sum = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i],
      [x2, y2] = verts[(i + 1) % verts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export const polyArea = verts => Math.abs(signedPolyArea(verts));

// Area centroid of a simple polygon, which for a convex one is always strictly
// inside it — the property that makes it the safe centre to scale a hole about.
// Falls back to the vertex mean for a degenerate outline with no area.
export function polyCentroid(verts) {
  let twice = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i],
      [x2, y2] = verts[(i + 1) % verts.length];
    const cross = x1 * y2 - x2 * y1;
    twice += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(twice) < 1e-12) {
    const n = verts.length || 1;
    return [verts.reduce((sum, v) => sum + v[0], 0) / n, verts.reduce((sum, v) => sum + v[1], 0) / n];
  }
  return [cx / (3 * twice), cy / (3 * twice)];
}

// Axis-aligned extent of a vertex list. Zeroes for an empty one, so a cell that
// the inset below closed up entirely reads as a hole of no size rather than as
// ±Infinity propagating through the statistics.
export function polyBBox(verts) {
  if (!verts.length) return { left: 0, right: 0, top: 0, bottom: 0 };
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const [x, y] of verts) {
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return { left, right, top, bottom };
}

// Sutherland–Hodgman against one half-plane: the part of a convex polygon where
// n·p ≤ c, with `n` a unit vector. Convex in, convex out, and the workhorse
// under both the Voronoi cell construction (one half-plane per nearby site) and
// the inset below (one per edge).
export function clipPolyHalfPlane(verts, nx, ny, c) {
  const out = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i],
      b = verts[(i + 1) % verts.length];
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// A convex polygon with every edge moved `d` inward along its own normal — the
// exact Minkowski erosion by a disc of radius d for a convex shape, which is
// what makes the ligament between two Voronoi cells inset by g/2 each come out
// at exactly g. Returns [] when the polygon closes up entirely.
export function insetConvexPoly(verts, d) {
  if (!(d > 0)) return verts;
  if (verts.length < 3) return [];
  // The normal (y₂−y₁, x₁−x₂) points outward only for the winding above, so a
  // list handed over the other way round would be GROWN by d rather than shrunk.
  const flip = signedPolyArea(verts) < 0 ? -1 : 1;
  let out = verts;
  for (let i = 0; i < verts.length && out.length >= 3; i++) {
    const [x1, y1] = verts[i],
      [x2, y2] = verts[(i + 1) % verts.length];
    const nx = (y2 - y1) * flip,
      ny = (x1 - x2) * flip;
    const len = Math.hypot(nx, ny);
    if (len < 1e-12) continue;
    out = clipPolyHalfPlane(out, nx / len, ny / len, (nx * x1 + ny * y1) / len - d);
  }
  return out.length >= 3 ? out : [];
}

// Isoceles triangle inradius (base w, height h): r = area / semiperimeter.
export function triInradius(w, h) {
  const slant = Math.hypot(w / 2, h);
  return (w * h) / 2 / (w / 2 + slant);
}

// Canonical vertices relative to the hole centre, wound clockwise on screen.
// Diamond: w/h are the horizontal/vertical diagonals, point-up. "Flat up" is
// expressed downstream as a rotation (see diamondFlatAngle) so one canonical
// polygon serves both orientations.
// Triangle: base w, apex-up, origin = INCENTER (not centroid) so that shrinking
// a hole (gap, taper, size variation) keeps the ligament uniform on all 3 edges.
// A point-down triangle is the same polygon rotated by π.
export function basePolyVerts(shape, w, h) {
  if (shape === "Diamond")
    return [
      [0, -h / 2],
      [w / 2, 0],
      [0, h / 2],
      [-w / 2, 0],
    ];
  const r = triInradius(w, h);
  return [
    [0, -(h - r)],
    [w / 2, r],
    [-w / 2, r],
  ];
}

// The angle the outline turns through at vertex i, the shortest adjacent edge,
// and whether the vertex is REFLEX — the interior angle past a half turn, which
// only a concave outline has. `ang` is always the angle between the two edges
// as lines (0…π): the hole's own corner angle at a convex vertex and the
// METAL's corner angle at a reflex one, which is the angle a fillet there is
// tangent to either way. The winding is read from the polygon itself, so a
// list handed over reversed gets the same answers.
export function polyCorner(verts, i, winding = Math.sign(signedPolyArea(verts)) || 1) {
  const n = verts.length;
  const v = verts[i],
    p = verts[(i + n - 1) % n],
    q = verts[(i + 1) % n];
  const up = unitToward(v, p),
    un = unitToward(v, q);
  const ang = Math.acos(clamp(up[0] * un[0] + up[1] * un[1], -1, 1));
  const edge = Math.min(Math.hypot(p[0] - v[0], p[1] - v[1]), Math.hypot(q[0] - v[0], q[1] - v[1]));
  // A turn against the outline's own winding is a notch.
  const reflex = orient2d(p, v, q) * winding < -1e-12;
  return { up, un, ang, edge, reflex };
}

// Largest corner radius whose tangent points stay within half of each edge.
export function maxCornerRadius(verts) {
  let rMax = Infinity;
  const winding = Math.sign(signedPolyArea(verts)) || 1;
  for (let i = 0; i < verts.length; i++) {
    const { ang, edge } = polyCorner(verts, i, winding);
    rMax = Math.min(rMax, Math.tan(ang / 2) * (edge / 2));
  }
  return Math.max(0, rMax * 0.999);
}

// Area of a polygon with rounded corners. Each rounded corner trades a kite of
// area r²·cot(α/2) for a circular sector of ½r²(π−α): a convex corner LOSES the
// difference (the corner of the hole is cut off), a reflex corner GAINS it (the
// corner of the metal poking into the hole is cut off instead).
export function roundedPolyArea(verts, holeRadius) {
  let area = polyArea(verts);
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r <= 0) return area;
  const winding = Math.sign(signedPolyArea(verts)) || 1;
  for (let i = 0; i < verts.length; i++) {
    const { ang, reflex } = polyCorner(verts, i, winding);
    const trade = (r * r) / Math.tan(ang / 2) - (r * r * (Math.PI - ang)) / 2;
    area += reflex ? trade : -trade;
  }
  return area;
}

// Trace a (possibly corner-rounded) polygon centred at (cx, cy). `arcTo` draws
// the fillet tangent to both edges on the narrow side of the corner, which is
// the hole side at a convex vertex and the metal side at a reflex one — the
// same fillet `roundedPolyArea` and `isInsideRoundedPoly` describe.
export function tracePolyPath(ctx, cx, cy, verts, holeRadius) {
  const n = verts.length;
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r > 0) {
    ctx.moveTo((verts[n - 1][0] + verts[0][0]) / 2 + cx, (verts[n - 1][1] + verts[0][1]) / 2 + cy);
    for (let i = 0; i < n; i++) {
      const v = verts[i],
        q = verts[(i + 1) % n];
      ctx.arcTo(v[0] + cx, v[1] + cy, q[0] + cx, q[1] + cy, r);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(verts[0][0] + cx, verts[0][1] + cy);
    for (let i = 1; i < n; i++) ctx.lineTo(verts[i][0] + cx, verts[i][1] + cy);
    ctx.closePath();
  }
}

// SVG path for the same rounded polygon, in absolute sheet coordinates.
export function roundedPolySVGPath(x, y, verts, holeRadius) {
  const n = verts.length;
  const f = v => v.toFixed(3);
  const abs = verts.map(([vx, vy]) => [vx + x, vy + y]);
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r <= 0) return `M ${abs.map(([px, py]) => `${f(px)} ${f(py)}`).join(" L ")} Z`;
  const winding = Math.sign(signedPolyArea(verts)) || 1;
  const tin = [],
    tout = [],
    sweep = [];
  for (let i = 0; i < n; i++) {
    const { up, un, ang, reflex } = polyCorner(verts, i, winding);
    const t = r / Math.tan(ang / 2);
    tin.push([abs[i][0] + up[0] * t, abs[i][1] + up[1] * t]);
    tout.push([abs[i][0] + un[0] * t, abs[i][1] + un[1] * t]);
    // Positive angle in SVG is clockwise on screen: the way a clockwise outline
    // turns at a convex corner, and the way round it turns at a reflex one.
    sweep.push(winding > 0 !== reflex ? 1 : 0);
  }
  let d = `M ${f(tin[0][0])} ${f(tin[0][1])}`;
  for (let i = 0; i < n; i++) {
    d += ` A ${f(r)} ${f(r)} 0 0 ${sweep[i]} ${f(tout[i][0])} ${f(tout[i][1])}`;
    const ni = tin[(i + 1) % n];
    d += ` L ${f(ni[0])} ${f(ni[1])}`;
  }
  return d + " Z";
}

export function isInsideConvexPoly(px, py, verts) {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = verts[i],
      [x2, y2] = verts[(i + 1) % n];
    if ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) < -1e-9) return false;
  }
  return true;
}

// Point in a simple polygon of any shape, by the even-odd rule: a ray to the
// right crosses the outline an odd number of times from inside. Convex or not,
// and whichever way round the outline runs.
export function isInsidePoly(px, py, verts) {
  const n = verts.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = verts[i],
      [xj, yj] = verts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// True when every turn of the outline goes the same way. A polygon this says no
// to is one the SAT clearance and the half-plane inset cannot be trusted on.
export function isConvexPoly(verts) {
  const n = verts.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const cross = orient2d(verts[i], verts[(i + 1) % n], verts[(i + 2) % n]);
    if (Math.abs(cross) < 1e-12) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

// The fillet at vertex i: the two tangent points, the arc's centre and the
// kite between them. Every point of the plane the fillet changes lies in that
// kite and outside the circle — on the hole side of the corner for a convex
// vertex (removed), on the metal side for a reflex one (added).
function cornerFillet(verts, i, r, winding) {
  const { up, un, ang } = polyCorner(verts, i, winding);
  const v = verts[i];
  const t = r / Math.tan(ang / 2);
  const bx = up[0] + un[0],
    by = up[1] + un[1];
  const len = Math.hypot(bx, by) || 1;
  const d = r / Math.sin(ang / 2);
  return {
    tin: [v[0] + up[0] * t, v[1] + up[1] * t],
    tout: [v[0] + un[0] * t, v[1] + un[1] * t],
    centre: [v[0] + (bx / len) * d, v[1] + (by / len) * d],
  };
}

// Rounded polygon: the sharp polygon, with each corner's kite ∖ disc flipped —
// taken away at a convex corner, given back at a reflex one. The kites of two
// corners never overlap, since a tangent length is at most half an edge, so the
// flips are independent and the rule reads the same for any simple polygon.
export function isInsideRoundedPoly(px, py, verts, holeRadius) {
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r <= 0) return isInsidePoly(px, py, verts);
  let inside = isInsidePoly(px, py, verts);
  const winding = Math.sign(signedPolyArea(verts)) || 1;
  for (let i = 0; i < verts.length; i++) {
    const { tin, tout, centre } = cornerFillet(verts, i, r, winding);
    if (Math.hypot(px - centre[0], py - centre[1]) < r) continue;
    // The kite is convex, so a quick containment against its four edges does.
    if (isInsidePoly(px, py, [verts[i], tin, centre, tout])) {
      inside = !inside;
      break;
    }
  }
  return inside;
}

// Absolute (rotated + translated) polygon vertices for a hole.
export function holePolyVerts(shape, x, y, w, h, angle) {
  const verts = basePolyVerts(shape, w, h);
  const a = angle || 0;
  if (!a) return verts.map(([vx, vy]) => [vx + x, vy + y]);
  const c = Math.cos(a),
    s = Math.sin(a);
  return verts.map(([vx, vy]) => [x + vx * c - vy * s, y + vx * s + vy * c]);
}

// Signed clearance between two simple polygons of any shape. Convex pairs take
// the exact SAT route below; anything else is settled by the two facts that hold
// for every simple polygon — disjoint outlines are as far apart as their closest
// vertex-to-edge pair, and overlapping ones either cross an edge or have one
// entirely inside the other. The overlap depth is then only estimated (the
// deepest a vertex of one sits inside the other), and never above −MIN_OVERLAP:
// nothing downstream reads the depth beyond its sign, but a crossing whose
// vertices all lie outside would otherwise report a depth of exactly zero and
// read as "touching" rather than as the overlap it is.
const MIN_OVERLAP = 0.01;
export function polyGap(A, B) {
  if (A.length < 3 || B.length < 3) return Infinity;
  if (isConvexPoly(A) && isConvexPoly(B)) return convexPolyGap(A, B);
  return simplePolyGap(A, B);
}

function simplePolyGap(A, B) {
  let crossed = false;
  for (let i = 0; i < A.length && !crossed; i++) {
    const a = A[i],
      b = A[(i + 1) % A.length];
    for (let j = 0; j < B.length; j++) {
      if (segmentsIntersect(a, b, B[j], B[(j + 1) % B.length])) {
        crossed = true;
        break;
      }
    }
  }
  const depthInside = (P, Q) => {
    let depth = 0;
    for (const [px, py] of P) {
      if (!isInsidePoly(px, py, Q)) continue;
      let d = Infinity;
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i],
          b = Q[(i + 1) % Q.length];
        d = Math.min(d, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
      }
      depth = Math.max(depth, d);
    }
    return depth;
  };
  const insideDepth = Math.max(depthInside(A, B), depthInside(B, A));
  if (crossed || insideDepth > 0) return -Math.max(insideDepth, MIN_OVERLAP);
  let dmin = Infinity;
  for (const [P, Q] of [
    [A, B],
    [B, A],
  ]) {
    for (const [px, py] of P) {
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i],
          b = Q[(i + 1) % Q.length];
        dmin = Math.min(dmin, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
      }
    }
  }
  return dmin;
}

// Signed clearance between two convex polygons: SAT separation when they
// overlap (negative), exact vertex↔edge distance when they are disjoint.
export function convexPolyGap(A, B) {
  let sep = -Infinity;
  const project = (P, nx, ny) => {
    let lo = Infinity,
      hi = -Infinity;
    for (const [px, py] of P) {
      const d = px * nx + py * ny;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    return [lo, hi];
  };
  for (const [P, Q] of [
    [A, B],
    [B, A],
  ]) {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i],
        [x2, y2] = P[(i + 1) % P.length];
      let nx = y2 - y1,
        ny = x1 - x2;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const [aLo, aHi] = project(P, nx, ny);
      const [bLo, bHi] = project(Q, nx, ny);
      sep = Math.max(sep, Math.max(bLo - aHi, aLo - bHi));
    }
  }
  if (sep < 0) return sep;
  let dmin = Infinity;
  for (const [P, Q] of [
    [A, B],
    [B, A],
  ]) {
    for (const [px, py] of P) {
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i],
          b = Q[(i + 1) % Q.length];
        dmin = Math.min(dmin, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
      }
    }
  }
  return dmin;
}
