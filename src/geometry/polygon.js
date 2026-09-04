// Convex-polygon helpers shared by the Diamond and Triangle hole shapes, plus the
// generic segment / point utilities used by the gap (ligament) computations.
// All coordinates are millimetres in sheet space (y down).
import { clamp } from "../core/math.js";

export function distPointSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Unit vector from point `from` toward point `to`.
export function unitToward(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

export function orient2d(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

export function segmentsIntersect(a, b, c, d) {
  const abC = orient2d(a, b, c), abD = orient2d(a, b, d);
  const cdA = orient2d(c, d, a), cdB = orient2d(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  const onSegment = (p, q, r) => Math.abs(orient2d(p, q, r)) < 1e-9
    && r[0] >= Math.min(p[0], q[0]) - 1e-9 && r[0] <= Math.max(p[0], q[0]) + 1e-9
    && r[1] >= Math.min(p[1], q[1]) - 1e-9 && r[1] <= Math.max(p[1], q[1]) + 1e-9;
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

// Isoceles triangle inradius (base w, height h): r = area / semiperimeter.
export function triInradius(w, h) {
  const slant = Math.hypot(w / 2, h);
  return (w * h / 2) / (w / 2 + slant);
}

// Canonical vertices relative to the hole centre, wound clockwise on screen.
// Diamond: w/h are the horizontal/vertical diagonals, point-up. "Flat up" is
// expressed downstream as a rotation (see diamondFlatAngle) so one canonical
// polygon serves both orientations.
// Triangle: base w, apex-up, origin = INCENTER (not centroid) so that shrinking
// a hole (gap, taper, size variation) keeps the ligament uniform on all 3 edges.
// A point-down triangle is the same polygon rotated by π.
export function basePolyVerts(shape, w, h) {
  if (shape === "Diamond") return [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]];
  const r = triInradius(w, h);
  return [[0, -(h - r)], [w / 2, r], [-w / 2, r]];
}

// Interior angle + shortest adjacent edge at vertex i (for corner rounding).
export function polyCorner(verts, i) {
  const n = verts.length;
  const v = verts[i], p = verts[(i + n - 1) % n], q = verts[(i + 1) % n];
  const up = unitToward(v, p), un = unitToward(v, q);
  const ang = Math.acos(clamp(up[0] * un[0] + up[1] * un[1], -1, 1));
  const edge = Math.min(Math.hypot(p[0] - v[0], p[1] - v[1]), Math.hypot(q[0] - v[0], q[1] - v[1]));
  return { up, un, ang, edge };
}

// Largest corner radius whose tangent points stay within half of each edge.
export function maxCornerRadius(verts) {
  let rMax = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const { ang, edge } = polyCorner(verts, i);
    rMax = Math.min(rMax, Math.tan(ang / 2) * (edge / 2));
  }
  return Math.max(0, rMax * 0.999);
}

// Area of a convex polygon with rounded corners. Each rounded corner removes a
// kite of area r²·cot(α/2) and gives back a circular sector of ½r²(π−α).
export function roundedPolyArea(verts, holeRadius) {
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % verts.length];
    area += x1 * y2 - x2 * y1;
  }
  area = Math.abs(area) / 2;
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r <= 0) return area;
  for (let i = 0; i < verts.length; i++) {
    const { ang } = polyCorner(verts, i);
    area -= r * r / Math.tan(ang / 2) - (r * r * (Math.PI - ang)) / 2;
  }
  return area;
}

// Trace a (possibly corner-rounded) convex polygon centred at (cx, cy).
export function tracePolyPath(ctx, cx, cy, verts, holeRadius) {
  const n = verts.length;
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r > 0) {
    ctx.moveTo((verts[n - 1][0] + verts[0][0]) / 2 + cx, (verts[n - 1][1] + verts[0][1]) / 2 + cy);
    for (let i = 0; i < n; i++) {
      const v = verts[i], q = verts[(i + 1) % n];
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
  const tin = [], tout = [];
  for (let i = 0; i < n; i++) {
    const { up, un, ang } = polyCorner(verts, i);
    const t = r / Math.tan(ang / 2);
    tin.push([abs[i][0] + up[0] * t, abs[i][1] + up[1] * t]);
    tout.push([abs[i][0] + un[0] * t, abs[i][1] + un[1] * t]);
  }
  let d = `M ${f(tin[0][0])} ${f(tin[0][1])}`;
  for (let i = 0; i < n; i++) {
    d += ` A ${f(r)} ${f(r)} 0 0 1 ${f(tout[i][0])} ${f(tout[i][1])}`;
    const ni = tin[(i + 1) % n];
    d += ` L ${f(ni[0])} ${f(ni[1])}`;
  }
  return d + " Z";
}

export function isInsideConvexPoly(px, py, verts) {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % n];
    if ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) < -1e-9) return false;
  }
  return true;
}

// Rounded convex polygon = polygon inset by r, grown back by a disk of radius r.
export function isInsideRoundedPoly(px, py, verts, holeRadius) {
  const r = Math.min(holeRadius || 0, maxCornerRadius(verts));
  if (r <= 0) return isInsideConvexPoly(px, py, verts);
  const inner = verts.map((v, i) => {
    const { up, un, ang } = polyCorner(verts, i);
    const bx = up[0] + un[0], by = up[1] + un[1];
    const len = Math.hypot(bx, by) || 1;
    const d = r / Math.sin(ang / 2);
    return [v[0] + (bx / len) * d, v[1] + (by / len) * d];
  });
  if (isInsideConvexPoly(px, py, inner)) return true;
  let dmin = Infinity;
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i], b = inner[(i + 1) % inner.length];
    dmin = Math.min(dmin, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
  }
  return dmin <= r;
}

// Absolute (rotated + translated) polygon vertices for a hole.
export function holePolyVerts(shape, x, y, w, h, angle) {
  const verts = basePolyVerts(shape, w, h);
  const a = angle || 0;
  if (!a) return verts.map(([vx, vy]) => [vx + x, vy + y]);
  const c = Math.cos(a), s = Math.sin(a);
  return verts.map(([vx, vy]) => [x + vx * c - vy * s, y + vx * s + vy * c]);
}

// Signed clearance between two convex polygons: SAT separation when they
// overlap (negative), exact vertex↔edge distance when they are disjoint.
export function convexPolyGap(A, B) {
  let sep = -Infinity;
  const project = (P, nx, ny) => {
    let lo = Infinity, hi = -Infinity;
    for (const [px, py] of P) {
      const d = px * nx + py * ny;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    return [lo, hi];
  };
  for (const [P, Q] of [[A, B], [B, A]]) {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      let nx = y2 - y1, ny = x1 - x2;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const [aLo, aHi] = project(P, nx, ny);
      const [bLo, bHi] = project(Q, nx, ny);
      sep = Math.max(sep, Math.max(bLo - aHi, aLo - bHi));
    }
  }
  if (sep < 0) return sep;
  let dmin = Infinity;
  for (const [P, Q] of [[A, B], [B, A]]) {
    for (const [px, py] of P) {
      for (let i = 0; i < Q.length; i++) {
        const a = Q[i], b = Q[(i + 1) % Q.length];
        dmin = Math.min(dmin, distPointSeg(px, py, a[0], a[1], b[0], b[1]));
      }
    }
  }
  return dmin;
}
