import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Check, ChevronDown, Download, Eye, EyeOff, Link2, Link2Off, Lock, Maximize,
  Moon, MoveHorizontal, MoveVertical, Plus, Redo2, Sparkles, SquarePen, Sun,
  TriangleAlert, Undo2, X,
} from "lucide-react";
import {
  BLEND_MODES,
  DEFAULT_VARIATION,
  FIELD_SPACES,
  SIZE_PROFILES,
  VARIATION_PRESETS,
  createVariationLayer,
  evaluateVariationField,
  randomizeVariationLayer,
  variationScaleAt,
} from "./variation-engine.js";
import {
  diamondFlatAngle,
  generateRadialHoles,
  getRadialShapeExtents,
  getRadialShapeOuterRadius,
} from "./radial-engine.js";

const PATTERN_TYPES = ["Straight", "Staggered 60°", "Staggered 45°", "Radial", "Custom Angle"];
const HOLE_SHAPES = ["Circle", "Rectangle", "Pill", "Hexagon", "Diamond", "Triangle"];
const CUSTOM_SIZE_SHAPES = ["Rectangle", "Pill", "Diamond", "Triangle"];
const DIAMOND_ORIENTATIONS = ["Point up", "Flat up"];
const RADIAL_LAYOUTS = ["Concentric", "Sunflower", "6k Rosette"];
const DIN_PRESETS = [
  { name: "Custom", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
  { name: "Rv 2-4 (60° staggered)", d: 2, pitchX: 4, pitchY: 3.46, pattern: "Staggered 60°" },
  { name: "Rv 3-5 (60° staggered)", d: 3, pitchX: 5, pitchY: 4.33, pattern: "Staggered 60°" },
  { name: "Rv 5-8 (60° staggered)", d: 5, pitchX: 8, pitchY: 6.93, pattern: "Staggered 60°" },
  { name: "Rv 6-9 (60° staggered)", d: 6, pitchX: 9, pitchY: 7.79, pattern: "Staggered 60°" },
  { name: "Rv 8-12 (60° staggered)", d: 8, pitchX: 12, pitchY: 10.39, pattern: "Staggered 60°" },
  { name: "Rv 10-15 (60° staggered)", d: 10, pitchX: 15, pitchY: 12.99, pattern: "Staggered 60°" },
  { name: "Rg 5-8 (straight)", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
  { name: "Rg 3-5 (straight)", d: 3, pitchX: 5, pitchY: 5, pattern: "Straight" },
  { name: "Rg 10-14 (straight)", d: 10, pitchX: 14, pitchY: 14, pattern: "Straight" },
  { name: "Rv 4-6 (45° staggered)", d: 4, pitchX: 6, pitchY: 6, pattern: "Staggered 45°" },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cloneVariation = variation => ({
  ...variation,
  layers: (variation.layers || []).map(layer => ({ ...layer })),
});

// ─── Variation gizmo geometry ─────────────────────────────────────────
// Four on-canvas handles, each mapping to ONE concept (sheet/mm space). Modelled
// on Photoshop's gradient + lens-blur tools so every drag does a single thing:
//   center -> centerX / centerY (origin = gradient start)
//   reach  -> angle (direction) + radius (length)  -- gradient end point
//   stop   -> position|phase, slides ALONG the gradient line only
//   curve  -> exponent, a rotary dial hugging the centre (lens-blur amount ring)
const GIZMO_EXP_K = 1.2;        // exponent <-> dial sweep (log scale)
const GIZMO_DIAL_R = 0.13;      // curve-dial radius as a fraction of minDim
const GIZMO_DIAL_SWEEP = 1.15;  // radians of knob travel per EXP_K log-unit

// ─── Handle snapping ──────────────────────────────────────────────────
// Range handles (reach spread, stop position/phase) snap to quarter steps;
// angle handles (reach direction, curve dial) snap to 45°. Holding Shift forces a
// hard snap to the nearest target; with the bare mouse the value moves freely but
// is gently pulled in as it approaches a snap point (a soft magnet).
const SNAP_QUARTERS = [0, 0.25, 0.5, 0.75, 1]; // 0/25/50/75/100%
const SNAP_CENTER = [0, 0.5, 1];               // panel centre, edge mids & corners (quadrant vertices)
const SNAP_ANGLE_STEP = 45;                    // degrees
const SOFT_SNAP_FRAC = 0.06;                   // capture radius for 0..1 ranges
const SOFT_SNAP_DEG = 7;                        // capture radius for angles (deg)
const RADIUS_MIN = 0.1, RADIUS_MAX = 2;         // reach spread bounds

function nearestSnap(value, snaps) {
  let snap = snaps[0], dist = Infinity;
  for (const s of snaps) {
    const d = Math.abs(value - s);
    if (d < dist) { dist = d; snap = s; }
  }
  return { snap, dist };
}

// Soft magnet: ease toward the nearest snap when within `radius`, fully reaching it
// at the centre. smoothstep keeps the pull gentle at the edge and firm at the point.
function magnetize(value, snaps, radius) {
  const { snap, dist } = nearestSnap(value, snaps);
  if (dist >= radius) return value;
  const t = 1 - dist / radius;       // 0 at edge → 1 at the snap point
  const pull = t * t * (3 - 2 * t);  // smoothstep easing
  return value + (snap - value) * pull;
}

// Apply snapping to a 0..1-style value: Shift → hard snap, otherwise soft magnet.
function applySnap(value, snaps, radius, shift) {
  return shift ? nearestSnap(value, snaps).snap : magnetize(value, snaps, radius);
}

// Angles wrap, so snap relative to the nearest multiple of `step`.
function snapAngleDeg(angle, step, radiusDeg, shift) {
  const nearest = Math.round(angle / step) * step;
  const diff = angle - nearest;
  if (shift) return nearest;
  if (Math.abs(diff) >= radiusDeg) return angle;
  const t = 1 - Math.abs(diff) / radiusDeg;
  const pull = t * t * (3 - 2 * t);
  return angle - diff * pull;
}

const gizmoUsesPosition = layer => layer.profile === "Peak" || layer.profile === "Valley";

function computeGizmo(layer, geom, minSep = 0) {
  const { marginLeft, marginTop, perfW, perfH } = geom;
  const minDim = Math.min(perfW, perfH);
  const cx = marginLeft + perfW * layer.centerX;
  const cy = marginTop + perfH * layer.centerY;
  const ang = (layer.angle * Math.PI) / 180;
  const dirX = Math.cos(ang), dirY = Math.sin(ang);
  const perpX = -dirY, perpY = dirX;
  const reachLen = Math.max(minDim * 0.06, 0.5 * minDim * (layer.radius || 1));
  const usesPosition = gizmoUsesPosition(layer);
  // Both position and phase ride 0..1 along the axis (center -> reach).
  const alongFrac = usesPosition
    ? clamp(layer.position ?? 0.5, 0, 1)
    : (((layer.phase || 0) % 1) + 1) % 1;
  // Position/phase stop lives strictly ON the gradient line (no perpendicular meaning).
  let along = alongFrac * reachLen;
  if (minSep > 0 && along < minSep) along = minSep; // keep it grabbable near the origin
  const stopX = cx + dirX * along, stopY = cy + dirY * along;
  // Curve dial: a rotary knob hugging the centre. Its sweep encodes the falloff exponent;
  // neutral (exponent = 1) points perpendicular to the axis, like a dial's 12-o'clock.
  const dialR = Math.max(minDim * 0.07, GIZMO_DIAL_R * minDim);
  const baseAngle = Math.atan2(perpY, perpX);
  const theta = (Math.log(clamp(layer.exponent || 1, 0.12, 5)) / GIZMO_EXP_K) * GIZMO_DIAL_SWEEP;
  const knobAngle = baseAngle + theta;
  return {
    minDim, reachLen, dirX, dirY, perpX, perpY, usesPosition, dialR, baseAngle,
    centerX: cx, centerY: cy,
    reachX: cx + dirX * reachLen, reachY: cy + dirY * reachLen,
    stopX, stopY,
    curveX: cx + Math.cos(knobAngle) * dialR,
    curveY: cy + Math.sin(knobAngle) * dialR,
  };
}

// Inverse maps: cursor in sheet space -> layer param patch, for the grabbed handle.
function gizmoPatchForCenter(mx, my, geom, shift) {
  // Each axis snaps to 0/50/100% so the origin clicks onto the panel centre,
  // the edge midpoints and the corners (the quadrant vertices).
  const x = clamp((mx - geom.marginLeft) / Math.max(1e-6, geom.perfW), 0, 1);
  const y = clamp((my - geom.marginTop) / Math.max(1e-6, geom.perfH), 0, 1);
  return {
    centerX: applySnap(x, SNAP_CENTER, SOFT_SNAP_FRAC, shift),
    centerY: applySnap(y, SNAP_CENTER, SOFT_SNAP_FRAC, shift),
  };
}

function gizmoPatchForReach(mx, my, layer, geom, lockRadius, shift) {
  const g = computeGizmo(layer, geom);
  const dx = mx - g.centerX, dy = my - g.centerY;
  // Direction snaps to 45° increments.
  const angle = snapAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI, SNAP_ANGLE_STEP, SOFT_SNAP_DEG, shift);
  const patch = { angle: Math.round(angle) };
  if (!lockRadius) {
    // Spread snaps to 0/25/50/75/100% of its range.
    const raw = clamp(Math.hypot(dx, dy) / (0.5 * g.minDim), RADIUS_MIN, RADIUS_MAX);
    const frac = applySnap((raw - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN), SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
    patch.radius = clamp(RADIUS_MIN + frac * (RADIUS_MAX - RADIUS_MIN), RADIUS_MIN, RADIUS_MAX);
  }
  return patch;
}

// Stop: project the cursor onto the gradient axis -> position|phase only.
function gizmoPatchForStop(mx, my, layer, geom, shift) {
  const g = computeGizmo(layer, geom);
  const dx = mx - g.centerX, dy = my - g.centerY;
  const alongFrac = (dx * g.dirX + dy * g.dirY) / Math.max(1e-6, g.reachLen);
  // Position/phase snaps to 0/25/50/75/100% along the gradient line.
  if (g.usesPosition) {
    const snapped = applySnap(clamp(alongFrac, 0, 1), SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
    return { position: clamp(snapped, 0.01, 0.99) };
  }
  const phase = ((alongFrac % 1) + 1) % 1;
  const snapped = applySnap(phase, SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
  return { phase: ((snapped % 1) + 1) % 1 }; // 100% wraps back to 0
}

// Curve: the knob's angle around the centre -> exponent (rotary dial).
function gizmoPatchForCurve(mx, my, layer, geom, shift) {
  const g = computeGizmo(layer, geom);
  let theta = Math.atan2(my - g.centerY, mx - g.centerX) - g.baseAngle;
  theta = Math.atan2(Math.sin(theta), Math.cos(theta)); // wrap to [-π, π]
  // The dial is angular, so it snaps to 45° steps (0° = neutral, exponent 1).
  const deg = snapAngleDeg((theta * 180) / Math.PI, SNAP_ANGLE_STEP, SOFT_SNAP_DEG, shift);
  theta = (deg * Math.PI) / 180;
  return { exponent: clamp(Math.exp((theta / GIZMO_DIAL_SWEEP) * GIZMO_EXP_K), 0.12, 5) };
}

// ─── Hole shape helpers (w = horizontal extent, h = vertical extent) ──
function calcHoleArea(shape, w, h, holeRadius) {
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    return r > 0 ? w * h - 4 * r * r + Math.PI * r * r : w * h;
  }
  if (shape === "Pill") {
    // Stadium: short side = min(w,h), long side = max(w,h)
    const s = Math.min(w, h), l = Math.max(w, h);
    const r = s / 2;
    return Math.PI * r * r + s * (l - s);
  }
  if (shape === "Hexagon") {
    const R = w / 2; // circumradius
    const sharp = (3 * Math.sqrt(3) / 2) * R * R;
    const cr = Math.min(holeRadius || 0, R * Math.sqrt(3) / 2); // clamp to apothem
    // Rounding each of the 6 corners removes (2√3 − π)·r² of area total.
    return cr > 0 ? sharp - (2 * Math.sqrt(3) - Math.PI) * cr * cr : sharp;
  }
  if (shape === "Diamond" || shape === "Triangle") {
    return roundedPolyArea(basePolyVerts(shape, w, h), holeRadius);
  }
  // Circle
  return Math.PI * (w / 2) ** 2;
}

// Pointy-top regular hexagon: distance from centre to its boundary in a given direction.
// Edge normals lie at multiples of 60°; apothem (centre→edge) = R·√3/2. Used for accurate
// hexagon gap/overlap so the honeycomb ligament reflects the true edge-to-edge spacing.
function hexEdgeReach(R, dirAngle) {
  const apothem = R * Math.sqrt(3) / 2;
  const sector = Math.PI / 3;
  let d = dirAngle % sector;
  if (d > sector / 2) d -= sector;
  else if (d < -sector / 2) d += sector;
  return apothem / Math.cos(d);
}

// Pointy-top regular hexagon vertices (circumradius R), oriented for honeycomb tiling.
function hexVertices(cx, cy, R) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return pts;
}

// Unit vector from point `from` toward point `to`.
function unitToward(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

// ─── Convex polygon helpers (Diamond & Triangle) ──────────────────────
// Isoceles triangle inradius (base w, height h): r = area / semiperimeter.
function triInradius(w, h) {
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
function basePolyVerts(shape, w, h) {
  if (shape === "Diamond") return [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]];
  const r = triInradius(w, h);
  return [[0, -(h - r)], [w / 2, r], [-w / 2, r]];
}

// Interior angle + shortest adjacent edge at vertex i (for corner rounding).
function polyCorner(verts, i) {
  const n = verts.length;
  const v = verts[i], p = verts[(i + n - 1) % n], q = verts[(i + 1) % n];
  const up = unitToward(v, p), un = unitToward(v, q);
  const ang = Math.acos(clamp(up[0] * un[0] + up[1] * un[1], -1, 1));
  const edge = Math.min(Math.hypot(p[0] - v[0], p[1] - v[1]), Math.hypot(q[0] - v[0], q[1] - v[1]));
  return { up, un, ang, edge };
}

// Largest corner radius whose tangent points stay within half of each edge.
function maxCornerRadius(verts) {
  let rMax = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const { ang, edge } = polyCorner(verts, i);
    rMax = Math.min(rMax, Math.tan(ang / 2) * (edge / 2));
  }
  return Math.max(0, rMax * 0.999);
}

// Area of a convex polygon with rounded corners. Each rounded corner removes a
// kite of area r²·cot(α/2) and gives back a circular sector of ½r²(π−α).
function roundedPolyArea(verts, holeRadius) {
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
function tracePolyPath(ctx, cx, cy, verts, holeRadius) {
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
function roundedPolySVGPath(x, y, verts, holeRadius) {
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

function distPointSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isInsideConvexPoly(px, py, verts) {
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = verts[i], [x2, y2] = verts[(i + 1) % n];
    if ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1) < -1e-9) return false;
  }
  return true;
}

// Rounded convex polygon = polygon inset by r, grown back by a disk of radius r.
function isInsideRoundedPoly(px, py, verts, holeRadius) {
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
function holePolyVerts(shape, x, y, w, h, angle) {
  const verts = basePolyVerts(shape, w, h);
  const a = angle || 0;
  if (!a) return verts.map(([vx, vy]) => [vx + x, vy + y]);
  const c = Math.cos(a), s = Math.sin(a);
  return verts.map(([vx, vy]) => [x + vx * c - vy * s, y + vx * s + vy * c]);
}

// Signed clearance between two convex polygons: SAT separation when they
// overlap (negative), exact vertex↔edge distance when they are disjoint.
function convexPolyGap(A, B) {
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

function rectHoleVerts(hole, w, h) {
  const hw = w / 2, hh = h / 2;
  const verts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const angle = hole.angle || 0, c = Math.cos(angle), s = Math.sin(angle);
  return verts.map(([x, y]) => [hole.x + x * c - y * s, hole.y + x * s + y * c]);
}

function roundedRectGap(h1, h2) {
  const r1 = Math.min(h1.holeRadius || 0, h1.w / 2, h1.h / 2);
  const r2 = Math.min(h2.holeRadius || 0, h2.w / 2, h2.h / 2);
  const core1 = rectHoleVerts(h1, Math.max(1e-6, h1.w - 2 * r1), Math.max(1e-6, h1.h - 2 * r1));
  const core2 = rectHoleVerts(h2, Math.max(1e-6, h2.w - 2 * r2), Math.max(1e-6, h2.h - 2 * r2));
  return convexPolyGap(core1, core2) - r1 - r2;
}

function pillAxis(hole) {
  const w = hole.w, h = hole.h;
  const horizontal = w >= h;
  const radius = Math.min(w, h) / 2;
  const halfSegment = Math.max(w, h) / 2 - radius;
  const angle = (hole.angle || 0) + (horizontal ? 0 : Math.PI / 2);
  const dx = Math.cos(angle) * halfSegment, dy = Math.sin(angle) * halfSegment;
  return { a: [hole.x - dx, hole.y - dy], b: [hole.x + dx, hole.y + dy], radius };
}

function orient2d(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(a, b, c, d) {
  const abC = orient2d(a, b, c), abD = orient2d(a, b, d);
  const cdA = orient2d(c, d, a), cdB = orient2d(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  const onSegment = (p, q, r) => Math.abs(orient2d(p, q, r)) < 1e-9
    && r[0] >= Math.min(p[0], q[0]) - 1e-9 && r[0] <= Math.max(p[0], q[0]) + 1e-9
    && r[1] >= Math.min(p[1], q[1]) - 1e-9 && r[1] <= Math.max(p[1], q[1]) + 1e-9;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function segmentGap(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distPointSeg(a[0], a[1], c[0], c[1], d[0], d[1]),
    distPointSeg(b[0], b[1], c[0], c[1], d[0], d[1]),
    distPointSeg(c[0], c[1], a[0], a[1], b[0], b[1]),
    distPointSeg(d[0], d[1], a[0], a[1], b[0], b[1])
  );
}

function pillGap(h1, h2) {
  const p1 = pillAxis(h1), p2 = pillAxis(h2);
  return segmentGap(p1.a, p1.b, p2.a, p2.b) - p1.radius - p2.radius;
}

function traceHolePath(ctx, x, y, shape, w, h, angle, holeRadius) {
  const hw = w / 2, hh = h / 2;
  // For rotated shapes, use transform (Diamond "Flat up" and point-down
  // Triangles are canonical polygons carrying a rotation angle).
  const needsRotation = angle && (shape === "Rectangle" || shape === "Pill" || shape === "Hexagon" || shape === "Diamond" || shape === "Triangle");
  if (needsRotation) {
    ctx.translate(x, y);
    ctx.rotate(angle);
  }
  const cx = needsRotation ? 0 : x, cy = needsRotation ? 0 : y;
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    if (r > 0) { ctx.roundRect(cx - hw, cy - hh, w, h, r); }
    else { ctx.rect(cx - hw, cy - hh, w, h); }
  } else if (shape === "Hexagon") {
    const R = hw;
    const pts = hexVertices(cx, cy, R);
    const cr = Math.min(holeRadius || 0, R * Math.sqrt(3) / 2);
    if (cr > 0) {
      // Rounded corners via arcTo: start at the midpoint of the last edge, then
      // round each vertex toward the next.
      const mid = [(pts[5][0] + pts[0][0]) / 2, (pts[5][1] + pts[0][1]) / 2];
      ctx.moveTo(mid[0], mid[1]);
      for (let i = 0; i < 6; i++) {
        const v = pts[i], n = pts[(i + 1) % 6];
        ctx.arcTo(v[0], v[1], n[0], n[1], cr);
      }
      ctx.closePath();
    } else {
      for (let i = 0; i < 6; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]); else ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.closePath();
    }
  } else if (shape === "Diamond" || shape === "Triangle") {
    tracePolyPath(ctx, cx, cy, basePolyVerts(shape, w, h), holeRadius);
  } else if (shape === "Pill") {
    if (w >= h) {
      const s = hw - hh;
      ctx.moveTo(cx - s, cy - hh);
      ctx.lineTo(cx + s, cy - hh);
      ctx.arc(cx + s, cy, hh, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx - s, cy + hh);
      ctx.arc(cx - s, cy, hh, Math.PI / 2, -Math.PI / 2);
    } else {
      const s = hh - hw;
      ctx.moveTo(cx + hw, cy - s);
      ctx.lineTo(cx + hw, cy + s);
      ctx.arc(cx, cy + s, hw, 0, Math.PI);
      ctx.lineTo(cx - hw, cy - s);
      ctx.arc(cx, cy - s, hw, Math.PI, 0);
    }
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, hw, 0, Math.PI * 2);
  }
  if (needsRotation) {
    ctx.rotate(-angle);
    ctx.translate(-x, -y);
  }
}

function holeSVGElement(x, y, shape, w, h, fill, extra, angle, holeRadius) {
  const hw = w / 2, hh = h / 2;
  const attrs = extra || '';
  const rotAttr = angle && (shape === "Rectangle" || shape === "Pill" || shape === "Hexagon" || shape === "Diamond" || shape === "Triangle") ? ` transform="rotate(${(angle * 180 / Math.PI).toFixed(2)} ${x.toFixed(3)} ${y.toFixed(3)})"` : '';
  if (shape === "Diamond" || shape === "Triangle") {
    const d = roundedPolySVGPath(x, y, basePolyVerts(shape, w, h), holeRadius);
    return `    <path d="${d}" ${fill} ${attrs}${rotAttr}/>\n`;
  }
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    const rxAttr = r > 0 ? ` rx="${r.toFixed(3)}" ry="${r.toFixed(3)}"` : '';
    return `    <rect x="${(x - hw).toFixed(3)}" y="${(y - hh).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"${rxAttr} ${fill} ${attrs}${rotAttr}/>\n`;
  }
  if (shape === "Hexagon") {
    const R = hw;
    const verts = hexVertices(x, y, R);
    const cr = Math.min(holeRadius || 0, R * Math.sqrt(3) / 2);
    if (cr > 0) {
      const t = cr / Math.sqrt(3); // tangent length from each vertex (120° interior angle)
      const tin = [], tout = [];
      for (let i = 0; i < 6; i++) {
        const v = verts[i], prev = verts[(i + 5) % 6], next = verts[(i + 1) % 6];
        const up = unitToward(v, prev), un = unitToward(v, next);
        tin.push([v[0] + up[0] * t, v[1] + up[1] * t]);
        tout.push([v[0] + un[0] * t, v[1] + un[1] * t]);
      }
      const f = n => n.toFixed(3);
      let d = `M ${f(tin[0][0])} ${f(tin[0][1])}`;
      for (let i = 0; i < 6; i++) {
        d += ` A ${f(cr)} ${f(cr)} 0 0 1 ${f(tout[i][0])} ${f(tout[i][1])}`;
        const ni = tin[(i + 1) % 6];
        d += ` L ${f(ni[0])} ${f(ni[1])}`;
      }
      d += ' Z';
      return `    <path d="${d}" ${fill} ${attrs}${rotAttr}/>\n`;
    }
    const pts = verts.map(v => `${v[0].toFixed(3)},${v[1].toFixed(3)}`).join(" ");
    return `    <polygon points="${pts}" ${fill} ${attrs}${rotAttr}/>\n`;
  }
  if (shape === "Pill") {
    if (w >= h) {
      const s = hw - hh, r = hh;
      return `    <path d="M ${(x - s).toFixed(3)} ${(y - r).toFixed(3)} L ${(x + s).toFixed(3)} ${(y - r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + s).toFixed(3)} ${(y + r).toFixed(3)} L ${(x - s).toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x - s).toFixed(3)} ${(y - r).toFixed(3)} Z" ${fill} ${attrs}${rotAttr}/>\n`;
    } else {
      const s = hh - hw, r = hw;
      return `    <path d="M ${(x + r).toFixed(3)} ${(y - s).toFixed(3)} L ${(x + r).toFixed(3)} ${(y + s).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x - r).toFixed(3)} ${(y + s).toFixed(3)} L ${(x - r).toFixed(3)} ${(y - s).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + r).toFixed(3)} ${(y - s).toFixed(3)} Z" ${fill} ${attrs}${rotAttr}/>\n`;
    }
  }
  return `    <circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${hw.toFixed(3)}" ${fill} ${attrs}/>\n`;
}

// Check if a point is inside a rounded rectangle
function isInsideRoundedRect(px, py, x1, y1, x2, y2, cr) {
  if (cr <= 0) return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  // Clamp corner radius
  const maxR = Math.min((x2 - x1) / 2, (y2 - y1) / 2);
  const r = Math.min(cr, maxR);
  // Check main cross regions first
  if (px >= x1 + r && px <= x2 - r && py >= y1 && py <= y2) return true;
  if (px >= x1 && px <= x2 && py >= y1 + r && py <= y2 - r) return true;
  // Check four corners
  const corners = [[x1 + r, y1 + r], [x2 - r, y1 + r], [x1 + r, y2 - r], [x2 - r, y2 - r]];
  for (const [cx, cy] of corners) {
    if (Math.hypot(px - cx, py - cy) <= r) return true;
  }
  return false;
}

// Area of a rounded rectangle
function roundedRectArea(w, h, cr) {
  if (cr <= 0) return w * h;
  const maxR = Math.min(w / 2, h / 2);
  const r = Math.min(cr, maxR);
  // Rectangle area minus 4 square corners plus 4 quarter-circle corners
  return w * h - 4 * r * r + Math.PI * r * r;
}

function tracePerfBoundary(ctx, params) {
  const {
    sheetW, sheetH,
    marginLeft = 0, marginRight = 0, marginTop = 0, marginBottom = 0,
    cornerRadius = 0, patternType, radialMode,
  } = params;
  const x = marginLeft, y = marginTop;
  const w = Math.max(0, sheetW - marginLeft - marginRight);
  const h = Math.max(0, sheetH - marginTop - marginBottom);
  ctx.beginPath();
  if (patternType === "Radial" && radialMode === "Circle") {
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(x, y, w, h, Math.min(cornerRadius, w / 2, h / 2));
  }
}

function perfBoundarySVG(params) {
  const {
    sheetW, sheetH,
    marginLeft = 0, marginRight = 0, marginTop = 0, marginBottom = 0,
    cornerRadius = 0, patternType, radialMode,
  } = params;
  const x = marginLeft, y = marginTop;
  const w = Math.max(0, sheetW - marginLeft - marginRight);
  const h = Math.max(0, sheetH - marginTop - marginBottom);
  if (patternType === "Radial" && radialMode === "Circle") {
    return `<circle cx="${(x + w / 2).toFixed(3)}" cy="${(y + h / 2).toFixed(3)}" r="${(Math.min(w, h) / 2).toFixed(3)}" />`;
  }
  const r = Math.min(cornerRadius, w / 2, h / 2);
  return `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" rx="${r.toFixed(3)}" ry="${r.toFixed(3)}" />`;
}

function isPointInsideHole(px, py, hole, shape, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const radius = useExit ? hole.exitHoleRadius : hole.holeRadius;
  if (w <= 0 || h <= 0) return false;
  const angle = hole.angle || 0;
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const dx = px - hole.x, dy = py - hole.y;
  const x = dx * cos - dy * sin, y = dx * sin + dy * cos;
  if (shape === "Rectangle") return isInsideRoundedRect(x, y, -w / 2, -h / 2, w / 2, h / 2, radius);
  if (shape === "Pill") {
    if (w >= h) {
      const segment = (w - h) / 2;
      const sx = Math.max(Math.abs(x) - segment, 0);
      return sx * sx + y * y <= (h / 2) ** 2;
    }
    const segment = (h - w) / 2;
    const sy = Math.max(Math.abs(y) - segment, 0);
    return x * x + sy * sy <= (w / 2) ** 2;
  }
  if (shape === "Hexagon") {
    const R = w / 2; // pointy-top: vertical corner-to-corner = 2R, flats on left/right
    const apothem = Math.sqrt(3) * R / 2;
    const cr = Math.min(radius || 0, apothem);
    if (cr <= 0) {
      return Math.abs(y) <= R && Math.abs(x) <= apothem && Math.sqrt(3) * Math.abs(y) + Math.abs(x) <= Math.sqrt(3) * R;
    }
    // Rounded hexagon = inner hexagon (shrunk inward by cr) grown by a disk of radius cr.
    // Inside iff distance from the point to that inner hexagon ≤ cr.
    const ai = apothem - cr;                 // inner apothem
    const Ri = ai * 2 / Math.sqrt(3);        // inner circumradius
    let inside = true;
    for (let k = 0; k < 6; k++) {
      const ang = k * Math.PI / 3;           // edge normals at 0,60,120,…
      if (x * Math.cos(ang) + y * Math.sin(ang) - ai > 1e-9) { inside = false; break; }
    }
    if (inside) return true;
    const iv = hexVertices(0, 0, Ri);
    let dmin = Infinity;
    for (let k = 0; k < 6; k++) {
      const a = iv[k], b = iv[(k + 1) % 6];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      let t = len2 > 0 ? ((x - a[0]) * dx + (y - a[1]) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      dmin = Math.min(dmin, Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)));
    }
    return dmin <= cr;
  }
  if (shape === "Diamond" || shape === "Triangle") {
    return isInsideRoundedPoly(x, y, basePolyVerts(shape, w, h), radius);
  }
  return (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2 <= 1;
}

function isPointInsidePerfBoundary(px, py, bounds) {
  const { xMin, xMax, yMin, yMax, cornerRadius: cr, circleMode } = bounds;
  if (circleMode) {
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    return Math.hypot(px - cx, py - cy) <= Math.min(xMax - xMin, yMax - yMin) / 2;
  }
  return isInsideRoundedRect(px, py, xMin, yMin, xMax, yMax, cr);
}

function estimateVisibleHoleArea(hole, shape, bounds, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const exactArea = useExit ? hole.exitArea : hole.area;
  if (w <= 0 || h <= 0) return 0;
  const angle = hole.angle || 0;
  let left, right, top, bottom;
  if (shape === "Diamond" || shape === "Triangle") {
    // Polygon shapes are not centred in their w×h box (triangle origin = incenter),
    // so take the exact bounding box of the rotated vertices.
    const verts = holePolyVerts(shape, hole.x, hole.y, w, h, angle);
    left = Math.min(...verts.map(v => v[0])); right = Math.max(...verts.map(v => v[0]));
    top = Math.min(...verts.map(v => v[1])); bottom = Math.max(...verts.map(v => v[1]));
  } else {
    const bw = Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h;
    const bh = Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
    left = hole.x - bw / 2; right = hole.x + bw / 2;
    top = hole.y - bh / 2; bottom = hole.y + bh / 2;
  }
  const boxW = right - left, boxH = bottom - top;

  if ([[left, top], [right, top], [left, bottom], [right, bottom]].every(([x, y]) => isPointInsidePerfBoundary(x, y, bounds))) return exactArea;
  if (bounds.circleMode) {
    const cx = (bounds.xMin + bounds.xMax) / 2, cy = (bounds.yMin + bounds.yMax) / 2;
    const panelRadius = Math.min(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin) / 2;
    if (Math.hypot(hole.x - cx, hole.y - cy) + Math.hypot(boxW, boxH) / 2 <= panelRadius) return exactArea;
  }

  const samples = 12;
  let inside = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const px = left + (sx + 0.5) * boxW / samples;
      const py = top + (sy + 0.5) * boxH / samples;
      if (isPointInsidePerfBoundary(px, py, bounds) && isPointInsideHole(px, py, hole, shape, useExit)) inside++;
    }
  }
  return boxW * boxH * inside / (samples * samples);
}

function generateHoles(params) {
  const { diameter, holeShape, holeW, holeH, patternType, pitchX, pitchY, sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, cornerRadius, customAngle, radialEdgeGap, circumEdgeGap, ringSpacing, circumSpacing, radialMode, radialLayout, centerHole, diamondOrient } = params;
  const hw = (holeW || diameter) / 2, hh = (holeH || diameter) / 2;
  const r = Math.max(hw, hh);
  const holes = [];
  const xMin = marginLeft, xMax = sheetW - marginRight;
  const yMin = marginTop, yMax = sheetH - marginBottom;
  if (xMin >= xMax || yMin >= yMax) return holes;

  // Diamond "Flat up" = canonical point-up rhombus rotated onto one of its edges.
  const flatTheta = holeShape === "Diamond" && diamondOrient === "Flat up" ? diamondFlatAngle(hw * 2, hh * 2) : 0;
  const clipToBoundary = pts => cornerRadius > 0
    ? pts.filter(p => isInsideRoundedRect(p.x, p.y, xMin, yMin, xMax, yMax, cornerRadius))
    : pts;

  if (patternType === "Radial") {
    return generateRadialHoles({
      shape: holeShape,
      w: hw * 2,
      h: hh * 2,
      bounds: { xMin, xMax, yMin, yMax },
      radialGap: radialEdgeGap,
      circumGap: circumEdgeGap,
      fillMode: radialMode,
      layout: radialLayout,
      ringSpacing,
      circumSpacing,
      center: radialLayout === "Concentric" ? { x: sheetW / 2, y: sheetH / 2 } : undefined,
      centerHole,
      cornerRadius,
      diamondOrient,
    });
  }

  // ─── Triangle: dedicated alternating ▲▽ row tiling ───────────────────
  // Triangles of base W × height H tile the plane exactly when up/down copies
  // alternate every half-base within a row and the alternation phase flips per
  // row. The edge gap becomes a uniform ligament by keeping that perfect
  // lattice for the EXPANDED triangle (offset outward by gap/2) and drawing
  // each actual triangle inset at the shared incenter — every facing pair of
  // edges then sits exactly `gap` apart, so gap 0 is a seamless fit.
  if (holeShape === "Triangle") {
    const w = hw * 2, h = hh * 2;
    const rIn = triInradius(w, h);
    const gap = Math.max(0, pitchX - w);
    const k = (rIn + gap / 2) / rIn;
    const cellW = w * k, cellH = h * k, rCell = rIn + gap / 2;
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    const rowsUp = Math.ceil((cy - yMin + r) / cellH) + 1;
    const rowsDown = Math.ceil((yMax + r - cy) / cellH) + 1;
    const cols = Math.ceil((Math.max(cx - xMin, xMax - cx) + r) / (cellW / 2)) + 1;
    for (let j = -rowsUp; j <= rowsDown; j++) {
      const rowTop = cy - cellH / 2 + j * cellH;
      if (rowTop > yMax + r || rowTop + cellH < yMin - r) continue;
      for (let i = -cols; i <= cols; i++) {
        const up = ((i + j) % 2 + 2) % 2 === 0;
        const x = cx + i * (cellW / 2);
        const y = up ? rowTop + cellH - rCell : rowTop + rCell;
        if (x < xMin - r || x > xMax + r) continue;
        holes.push({ x, y, angle: up ? 0 : Math.PI });
      }
    }
    return clipToBoundary(holes);
  }

  // ─── Diamond + Staggered 60°: interlocking rhombus lattice ───────────
  // Point-up rhombi tile edge-to-edge on the lattice u=(W,0), v=(W/2, H/2).
  // As with the triangle tiling, the gap is a uniform ligament: the lattice is
  // that of the expanded rhombus (offset outward by gap/2). "Flat up" rotates
  // the lattice together with the shapes so the tiling stays exact.
  if (holeShape === "Diamond" && patternType === "Staggered 60°") {
    const w = hw * 2, h = hh * 2;
    const rho = (w * h) / (2 * Math.hypot(w, h));
    const gap = Math.max(0, pitchX - w);
    const k = (rho + gap / 2) / rho;
    const cellW = w * k, cellH = h * k;
    const ct = Math.cos(flatTheta), st = Math.sin(flatTheta);
    const u = [cellW * ct, cellW * st];
    const v = [(cellW / 2) * ct - (cellH / 2) * st, (cellW / 2) * st + (cellH / 2) * ct];
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    const det = u[0] * v[1] - u[1] * v[0];
    let iMin = Infinity, iMax = -Infinity, jMin = Infinity, jMax = -Infinity;
    for (const [bx, by] of [[xMin - r, yMin - r], [xMax + r, yMin - r], [xMin - r, yMax + r], [xMax + r, yMax + r]]) {
      const dx = bx - cx, dy = by - cy;
      const fi = (dx * v[1] - dy * v[0]) / det;
      const fj = (u[0] * dy - u[1] * dx) / det;
      iMin = Math.min(iMin, fi); iMax = Math.max(iMax, fi);
      jMin = Math.min(jMin, fj); jMax = Math.max(jMax, fj);
    }
    for (let j = Math.floor(jMin) - 1; j <= Math.ceil(jMax) + 1; j++) {
      for (let i = Math.floor(iMin) - 1; i <= Math.ceil(iMax) + 1; i++) {
        const x = cx + i * u[0] + j * v[0];
        const y = cy + i * u[1] + j * v[1];
        if (x < xMin - r || x > xMax + r || y < yMin - r || y > yMax + r) continue;
        holes.push({ x, y, angle: flatTheta });
      }
    }
    return clipToBoundary(holes);
  }

  // For 45° staggered, pitchX is the nearest-neighbor (diagonal) distance t.
  // The actual in-row horizontal pitch = t√2, offset = t/√2, vertical pitch = t/√2.
  // This produces a true 45° angle: arctan((t/√2) / (t/√2)) = 45°.
  // For 60° staggered, pitchX = in-row pitch = nearest-neighbor distance (equilateral).
  const is45 = patternType === "Staggered 45°";
  const holeHeight = holeH || diameter;
  const holeWidth = holeW || diameter;

  // Hexagon + 60° staggered → true honeycomb. Pointy-top hexagons share an edge with all
  // six neighbours, so the requested edge gap becomes a uniform ligament between facing
  // parallel edges. Circumradius R = holeWidth/2 (corner-to-corner), apothem = R·√3/2;
  // touching centres sit 2·apothem apart, so centre spacing = 2·apothem + gap and rows
  // step by spacing·√3/2 to keep the lattice equilateral (every neighbour the same gap).
  const isHexHoneycomb = holeShape === "Hexagon" && patternType === "Staggered 60°";
  const hexGap = Math.max(0, pitchX - holeWidth);
  const hexSpacing = holeWidth * Math.sqrt(3) / 2 + hexGap;

  let inRowPitchX = is45 ? pitchX * Math.SQRT2 : pitchX;
  if (isHexHoneycomb) inRowPitchX = hexSpacing;

  let offsetFn = () => 0;
  if (patternType === "Staggered 60°" || is45) {
    offsetFn = (rowIdx) => (rowIdx % 2 !== 0 ? inRowPitchX / 2 : 0);
  } else if (patternType === "Custom Angle") {
    const angleRad = (customAngle * Math.PI) / 180;
    offsetFn = (rowIdx) => (rowIdx % 2 !== 0 ? pitchY * Math.tan(angleRad) : 0);
  }

  const minEdgeGap = Math.min(pitchX - holeWidth, pitchY - holeHeight);
  const safeMinGap = Math.max(0, minEdgeGap);

  let effPY = pitchY;
  if (isHexHoneycomb) {
    // Equilateral hex lattice: row spacing = inRowPitchX·√3/2 gives a uniform gap on every edge.
    effPY = inRowPitchX * Math.sqrt(3) / 2;
  } else if (patternType === "Staggered 60°" || is45) {
    // In staggered layouts, adjacent rows are offset by inRowPitchX/2 horizontally.
    // The nearest neighbor is diagonal, so use Euclidean distance for min gap check
    // instead of purely vertical distance which over-constrains the spacing.
    const halfPX = inRowPitchX / 2;
    const holeDim = Math.max(holeWidth, holeHeight);
    const minDist = holeDim + safeMinGap;
    const staggeredMinPY = Math.sqrt(Math.max(holeHeight * holeHeight, minDist * minDist - halfPX * halfPX));
    if (patternType === "Staggered 60°") {
      effPY = Math.max(pitchX * Math.sqrt(3) / 2, staggeredMinPY);
    } else {
      // 45°: vertical pitch = t/√2 where t = pitchX (nearest-neighbor distance)
      effPY = Math.max(pitchX / Math.SQRT2, staggeredMinPY);
    }
  }

  // Center-aligned: start from panel center, expand outward
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
  // How many rows above/below center
  const rowsUp = Math.ceil((cy - yMin + r) / effPY);
  const rowsDown = Math.ceil((yMax + r - cy) / effPY);

  for (let ri = -rowsUp; ri <= rowsDown; ri++) {
    const y = cy + ri * effPY;
    if (y < yMin - r || y > yMax + r) continue;
    // Row index for offset: center row = 0
    const rowIdx = Math.abs(ri);
    const off = offsetFn(rowIdx);
    // Expand columns from center
    const colsLeft = Math.ceil((cx - xMin + r) / inRowPitchX) + 1;
    const colsRight = Math.ceil((xMax + r - cx) / inRowPitchX) + 1;
    for (let ci = -colsLeft; ci <= colsRight; ci++) {
      const x = cx + ci * inRowPitchX + off;
      if (x >= xMin - r && x <= xMax + r) {
        holes.push(flatTheta ? { x, y, angle: flatTheta } : { x, y });
      }
    }
  }

  // Filter by corner radius if set
  if (cornerRadius > 0) {
    return holes.filter(h => isInsideRoundedRect(h.x, h.y, xMin, yMin, xMax, yMax, cornerRadius));
  }
  return holes;
}

// ─── Overlap & ligament: shape-aware (AABB for rect/pill, circle for others) ──
function checkShapeOverlap(h1, h2, shape) {
  const w1 = h1.w, h1h = h1.h, w2 = h2.w, h2h = h2.h;
  if (shape === "Diamond" || shape === "Triangle") {
    return convexPolyGap(
      holePolyVerts(shape, h1.x, h1.y, w1, h1h, h1.angle),
      holePolyVerts(shape, h2.x, h2.y, w2, h2h, h2.angle)
    ) < -0.001;
  }
  if (shape === "Rectangle") return roundedRectGap(h1, h2) < -0.001;
  if (shape === "Pill") return pillGap(h1, h2) < -0.001;
  const r1 = Math.max(w1, h1h) / 2, r2 = Math.max(w2, h2h) / 2;
  const dx = h2.x - h1.x, dy = h2.y - h1.y;
  const dist = Math.hypot(dx, dy);
  if (shape === "Hexagon") {
    // Edge-aware: use each hexagon's reach toward the other instead of the circumradius,
    // otherwise tightly-spaced honeycombs read as overlapping when they only share edges.
    if (dist < 1e-9) return true;
    const dir = Math.atan2(dy, dx);
    return dist < hexEdgeReach(r1, dir - (h1.angle || 0))
      + hexEdgeReach(r2, dir + Math.PI - (h2.angle || 0)) - 0.001;
  }
  // Circle: distance-based extent.
  return dist < r1 + r2 - 0.001;
}

function calcShapeGap(h1, h2, shape) {
  const w1 = h1.w, h1h = h1.h, w2 = h2.w, h2h = h2.h;
  if (shape === "Diamond" || shape === "Triangle") {
    return convexPolyGap(
      holePolyVerts(shape, h1.x, h1.y, w1, h1h, h1.angle),
      holePolyVerts(shape, h2.x, h2.y, w2, h2h, h2.angle)
    );
  }
  if (shape === "Rectangle") return roundedRectGap(h1, h2);
  if (shape === "Pill") return pillGap(h1, h2);
  const r1 = Math.max(w1, h1h) / 2, r2 = Math.max(w2, h2h) / 2;
  const dx = h2.x - h1.x, dy = h2.y - h1.y;
  const dist = Math.hypot(dx, dy);
  if (shape === "Hexagon") {
    if (dist < 1e-9) return -(r1 + r2);
    const dir = Math.atan2(dy, dx);
    return dist
      - hexEdgeReach(r1, dir - (h1.angle || 0))
      - hexEdgeReach(r2, dir + Math.PI - (h2.angle || 0));
  }
  return dist - r1 - r2;
}

function findOverlaps(holes, shape) {
  const overlaps = new Set();
  if (holes.length > 10000) return overlaps;
  const gridSize = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i && checkShapeOverlap(hole, holes[j], shape)) {
          overlaps.add(i); overlaps.add(j);
        }
      }
    }
  });
  return overlaps;
}

function calcMinLigament(holes, shape, nominalSpacing = 0) {
  if (holes.length < 2 || holes.length > 10000) return null;
  let minGap = Infinity;
  const maxExtent = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const gridSize = Math.max(maxExtent * 2, nominalSpacing * 1.5);
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i) {
          const g = calcShapeGap(hole, holes[j], shape);
          if (g < minGap) minGap = g;
        }
      }
    }
  });
  return minGap === Infinity ? null : Math.max(0, minGap);
}

// ─── Theoretical OAR (unit cell based, industry standard) ────────────
function calcTheoreticalOAR(patternType, pitchX, pitchY, holeArea) {
  let cellArea;
  if (patternType === "Staggered 60°") {
    cellArea = pitchX * (pitchX * Math.sqrt(3) / 2);
  } else if (patternType === "Staggered 45°") {
    cellArea = pitchX * pitchX;
  } else {
    // Straight, Custom Angle — rectangular cell
    cellArea = pitchX * pitchY;
  }
  if (cellArea <= 0) return 0;
  return Math.min((holeArea / cellArea) * 100, 100);
}

function generateSVGString(holes, params) {
  const { sheetW, sheetH, thickness, taperAngle, taperDirection, holeShape } = params;
  const shape = holeShape || "Circle";
  const taperActive = thickness > 0 && taperAngle > 0;
  const bgColor = params.bgColor || "#c0c0c0";
  const holeColor = params.holeColor || "#000000";
  const holeFill = `fill="${holeColor}"`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">\n`;
  svg += `  <rect width="${sheetW}" height="${sheetH}" fill="${bgColor}" />\n`;
  svg += `  <defs><clipPath id="perf-boundary">${perfBoundarySVG(params)}</clipPath></defs>\n`;
  svg += `  <g clip-path="url(#perf-boundary)">\n`;

  if (taperActive) {
    svg += `  <g id="entry-side">\n`;
    holes.forEach(pt => {
      const topW = taperDirection === "Top larger" ? pt.w : pt.exitW;
      const topH = taperDirection === "Top larger" ? pt.h : pt.exitH;
      if (topW > 0 && topH > 0) svg += holeSVGElement(pt.x, pt.y, shape, topW, topH, holeFill, '', pt.angle, pt.holeRadius);
    });
    svg += `  </g>\n  <g id="exit-side">\n`;
    holes.forEach(pt => {
      const botW = taperDirection === "Top larger" ? pt.exitW : pt.w;
      const botH = taperDirection === "Top larger" ? pt.exitH : pt.h;
      if (botW > 0 && botH > 0) svg += holeSVGElement(pt.x, pt.y, shape, botW, botH, 'fill="none"', 'stroke="#666" stroke-width="0.15"', pt.angle, pt.exitHoleRadius);
    });
    svg += `  </g>\n`;
  } else {
    holes.forEach(pt => { svg += holeSVGElement(pt.x, pt.y, shape, pt.w, pt.h, holeFill, '', pt.angle, pt.holeRadius); });
  }
  return svg + `  </g>\n</svg>`;
}

// ─── Slider Row (improved: empty input doesn't snap) ─────────────────
function SliderRow({ label, value, min, max, step, onChange, unit, dark }) {
  const [inputVal, setInputVal] = useState(String(value));
  const inputRef = useRef(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setInputVal(String(value));
  }, [value]);

  const commitInput = () => {
    isFocused.current = false;
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed)) { setInputVal(String(value)); return; }
    const clamped = clamp(parsed, min, max);
    onChange(clamped);
    setInputVal(String(clamped));
  };

  const trackBg = dark ? "#333" : "#d4d4d8";
  const trackFg = dark ? "#60a5fa" : "#2563eb";
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: dark ? "#ccc" : "#444", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            aria-label={label}
            value={inputVal}
            onFocus={() => { isFocused.current = true; inputRef.current?.select(); }}
            onBlur={commitInput}
            onKeyDown={e => { if (e.key === "Enter") { commitInput(); inputRef.current?.blur(); } }}
            onChange={e => setInputVal(e.target.value)}
            style={{
              width: 52, height: 24, fontSize: 11, textAlign: "right",
              background: dark ? "#131316" : "#fff", color: dark ? "#eee" : "#222",
              border: `1px solid ${dark ? "#333" : "#d0d0d0"}`,
              borderRadius: 4, padding: "0 4px", outline: "none",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
          {unit && <span style={{ fontSize: 10, color: dark ? "#666" : "#999", fontFamily: "'JetBrains Mono', monospace" }}>{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 4, appearance: "none", outline: "none", borderRadius: 2, cursor: "pointer",
          background: `linear-gradient(to right, ${trackFg} 0%, ${trackFg} ${pct}%, ${trackBg} ${pct}%, ${trackBg} 100%)`
        }}
      />
    </div>
  );
}

// ─── Tiny Toggle ─────────────────────────────────────────────────────
function Toggle({ value, onChange, dark, label }) {
  const accent = dark ? "#60a5fa" : "#2563eb";
  return (
    <div onClick={() => onChange(!value)} role="switch" aria-checked={value} aria-label={label} style={{
      width: 34, height: 18, borderRadius: 9, padding: 2, flexShrink: 0, cursor: "pointer",
      background: value ? accent : (dark ? "#333" : "#ccc"), transition: "background 0.2s",
      display: "flex", alignItems: "center",
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, background: "#fff",
        transform: value ? "translateX(16px)" : "translateX(0)",
        transition: "transform 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
      }} />
    </div>
  );
}

// ─── Custom dropdown (replaces native <select>, styled to match the GUI) ──
function Select({ value, options, onChange, dark, placeholder, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const btnRef = useRef(null);
  const border = dark ? "#27272a" : "#e0e0e5";
  const bg = dark ? "#131316" : "#ffffff";
  const menuBg = dark ? "#1b1b1f" : "#ffffff";
  const text = dark ? "#e4e4e7" : "#18181b";
  const accent = dark ? "#60a5fa" : "#2563eb";
  const current = options.find(o => String(o.value) === String(value));

  const openMenu = () => {
    const r = btnRef.current.getBoundingClientRect();
    const menuH = Math.min(options.length * 28 + 8, 264);
    const below = r.bottom + 4 + menuH <= window.innerHeight - 8;
    setMenuPos({ left: r.left, width: r.width, top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - menuH) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = e => { if (e.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }} onPointerDown={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={() => (open ? setOpen(false) : openMenu())} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
        style={{ width: "100%", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "0 8px 0 9px", fontSize: 11, background: bg, color: current ? text : "#71717a", border: `1px solid ${open ? accent : border}`, borderRadius: 5, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current ? current.label : (placeholder || "Select…")}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, color: "#71717a", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && menuPos && (
        <div style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: 264, overflowY: "auto", zIndex: 100, background: menuBg, border: `1px solid ${border}`, borderRadius: 8, padding: 4, boxShadow: dark ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 32px rgba(0,0,0,0.16)" }}>
          {options.map(o => {
            const selected = String(o.value) === String(value);
            return (
              <button key={String(o.value)} onClick={() => { onChange(o.value); setOpen(false); }} className="pg-menu-item"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", fontSize: 10.5, textAlign: "left", background: "transparent", color: selected ? accent : text, border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                {selected && <Check size={11} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Color helpers (hex <-> HSV) ─────────────────────────────────────
function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToHex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map(ch => Math.round((ch + m) * 255).toString(16).padStart(2, "0")).join("");
}

const PICKER_SWATCHES = ["#141418", "#000000", "#3f3f46", "#c8c8cd", "#ffffff", "#2563eb", "#ef4444", "#f59e0b", "#10b981"];

// Color field: swatch + hex input opening a custom HSV picker popover, styled to
// match the GUI (replaces the native <input type="color">). Partial hex text is
// held locally and only committed once it is a complete #rrggbb value.
function ColorField({ label, value, onChange, dark }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [text, setText] = useState(value);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const hsvRef = useRef(hsv);
  const dragging = useRef(false);
  const swatchRef = useRef(null);
  const border = dark ? "#27272a" : "#e0e0e5";
  const controlBg = dark ? "#131316" : "#ffffff";
  const textPrimary = dark ? "#e4e4e7" : "#18181b";
  const labelStyle = { fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#71717a", fontFamily: "'JetBrains Mono', monospace" };

  useEffect(() => {
    setText(value);
    if (!dragging.current) { const next = hexToHsv(value); hsvRef.current = next; setHsv(next); }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = () => { if (!dragging.current) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (h, s, v) => {
    const next = [h, s, v];
    hsvRef.current = next;
    setHsv(next);
    onChange(hsvToHex(h, s, v));
  };

  // Shared press-drag helper for the SV pad and hue bar.
  const dragWith = (e, apply) => {
    dragging.current = true;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    apply(e, el.getBoundingClientRect());
    const move = ev => apply(ev, el.getBoundingClientRect());
    const up = () => {
      dragging.current = false;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const openPicker = () => {
    const r = swatchRef.current.getBoundingClientRect();
    const w = 196, h = 172;
    const left = Math.min(r.left, window.innerWidth - w - 8);
    const top = r.bottom + 6 + h <= window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - h);
    setPos({ left, top });
    setOpen(true);
  };

  const [hue, sat, val] = hsv;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }} onPointerDown={e => e.stopPropagation()}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button ref={swatchRef} onClick={() => (open ? setOpen(false) : openPicker())} title="Open color picker"
          style={{ width: 28, height: 30, padding: 0, border: `1px solid ${open ? (dark ? "#60a5fa" : "#2563eb") : border}`, borderRadius: 6, background: value, cursor: "pointer", boxShadow: `inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}` }} />
        <input type="text" value={text}
          onChange={e => {
            const v = e.target.value;
            if (!/^#[0-9a-fA-F]{0,6}$/.test(v)) return;   // ignore non-hex keystrokes
            setText(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);  // commit only complete colors
          }}
          onBlur={() => setText(value)}                     // drop an incomplete edit
          style={{ width: 68, height: 30, fontSize: 10, background: controlBg, color: textPrimary, border: `1px solid ${border}`, borderRadius: 5, padding: "0 6px", outline: "none", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }} />
      </div>
      {open && pos && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, width: 196, zIndex: 120, padding: 10, background: dark ? "#1b1b1f" : "#ffffff", border: `1px solid ${border}`, borderRadius: 10, boxShadow: dark ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 8, cursor: "default" }}>
          {/* Saturation / value pad */}
          <div onPointerDown={e => dragWith(e, (ev, rect) => {
              const s = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
              const v = clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1);
              commit(hsvRef.current[0], s, v);
            })}
            style={{ position: "relative", height: 110, borderRadius: 6, cursor: "crosshair", touchAction: "none",
              background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))` }}>
            <div style={{ position: "absolute", left: `${sat * 100}%`, top: `${(1 - val) * 100}%`, width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 6, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", background: value, pointerEvents: "none" }} />
          </div>
          {/* Hue bar */}
          <div onPointerDown={e => dragWith(e, (ev, rect) => {
              const h = clamp((ev.clientX - rect.left) / rect.width, 0, 1) * 359.9;
              commit(h, hsvRef.current[1], hsvRef.current[2]);
            })}
            style={{ position: "relative", height: 10, borderRadius: 5, cursor: "ew-resize", touchAction: "none",
              background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
            <div style={{ position: "absolute", left: `${(hue / 360) * 100}%`, top: "50%", width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 6, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", background: `hsl(${hue}, 100%, 50%)`, pointerEvents: "none" }} />
          </div>
          {/* Preset swatches */}
          <div style={{ display: "flex", gap: 4 }}>
            {PICKER_SWATCHES.map(c => (
              <button key={c} onClick={() => onChange(c)} title={c.toUpperCase()}
                style={{ flex: 1, height: 16, padding: 0, borderRadius: 4, cursor: "pointer", background: c, border: `1px solid ${value.toLowerCase() === c ? (dark ? "#93c5fd" : "#2563eb") : (dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)")}` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileIcon({ type, active, dark }) {
  const stroke = active ? (dark ? "#93c5fd" : "#1d4ed8") : (dark ? "#777" : "#777");
  const paths = {
    Ramp: "M2 15 L22 3",
    Peak: "M2 16 L12 3 L22 16",
    Valley: "M2 3 L12 16 L22 3",
    Wave: "M2 10 C5 2 9 2 12 10 C15 18 19 18 22 10",
    Noise: "M2 13 L5 6 L8 11 L11 4 L14 15 L17 8 L20 12 L22 5",
    Steps: "M2 16 L7 16 L7 12 L12 12 L12 8 L17 8 L17 4 L22 4",
  };
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
      <path d="M2 18 H22" stroke={dark ? "#333" : "#ddd"} strokeWidth="1" />
      <path d={paths[type]} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Pitch Info Display (secondary info under edge gap slider) ────────
function PitchInfo({ label, value, dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: dark ? "#555" : "#aaa", marginTop: -6, marginBottom: 8, paddingLeft: 2, fontFamily: "'JetBrains Mono', monospace" }}>
      <MoveHorizontal size={9} style={{ flexShrink: 0 }} /> {label}: {value.toFixed(2)} mm
    </div>
  );
}

// ─── Link Icon (for pitch sync) ──────────────────────────────────────
function LinkIcon({ linked, dark }) {
  const c = linked ? (dark ? "#60a5fa" : "#2563eb") : (dark ? "#555" : "#aaa");
  return linked
    ? <Link2 size={13} color={c} style={{ display: "block" }} />
    : <Link2Off size={13} color={c} style={{ display: "block" }} />;
}

// ─── Main App ────────────────────────────────────────────────────────
export default function PerforationGenerator() {
  const [dark, setDark] = useState(true);
  const [showHud, setShowHud] = useState(true); // one switch for every on-canvas overlay (margins, removed-hole marks, stats, gizmos)
  const [diameter, setDiameter] = useState(5);
  const [holeShape, setHoleShape] = useState("Circle");
  const [holeW, setHoleW] = useState(5);   // for Rectangle & Pill (mm)
  const [holeH, setHoleH] = useState(5);   // for Rectangle & Pill (mm)
  const [holeRadius, setHoleRadius] = useState(0); // corner radius for Rectangle holes
  const [diamondOrient, setDiamondOrient] = useState("Point up"); // Diamond: point-up vs flat-side-up
  const [triEquilateral, setTriEquilateral] = useState(true);     // Triangle: lock H = W·√3/2
  const [patternType, setPatternType] = useState("Staggered 60°");
  const [edgeGapX, setEdgeGapX] = useState(3);
  const [edgeGapY, setEdgeGapY] = useState(3);
  const [gapLinked, setGapLinked] = useState(true);
  const [sheetW, setSheetW] = useState(200);
  const [sheetH, setSheetH] = useState(200);
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [marginLinked, setMarginLinked] = useState(true);
  const [customAngle, setCustomAngle] = useState(30);
  const [radialEdgeGap, setRadialEdgeGap] = useState(5);
  const [circumEdgeGap, setCircumEdgeGap] = useState(5);
  const [radialLinked, setRadialLinked] = useState(true);
  const [radialMode, setRadialMode] = useState("Full");  // "Full" | "Circle"
  const [radialLayout, setRadialLayout] = useState("Concentric");
  const [centerHole, setCenterHole] = useState(false);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [thickness, setThickness] = useState(0);
  const [taperAngle, setTaperAngle] = useState(0);
  const [taperDirection, setTaperDirection] = useState("Top larger");
  const [showTaper, setShowTaper] = useState(false); // reveal thickness & taper controls
  const [holeColor, setHoleColor] = useState("#141418"); // custom hole (foreground) color, shared by preview & export
  const [bgColor, setBgColor] = useState("#c8c8cd");      // custom sheet (background) color, shared by preview & export
  const [removedHoles, setRemovedHoles] = useState(new Set());
  const [holeRemovalMode, setHoleRemovalMode] = useState(false);
  const [variation, setVariation] = useState(() => cloneVariation(DEFAULT_VARIATION));
  const [variationEditMode, setVariationEditMode] = useState(false);
  const [variationAdvanced, setVariationAdvanced] = useState(false);
  const [variationHud, setVariationHud] = useState(null);
  const variationRef = useRef(variation);
  const variationPast = useRef([]);
  const variationFuture = useRef([]);
  const [variationHistoryVersion, setVariationHistoryVersion] = useState(0);
  const variationDrag = useRef(null);
  const gizmoRef = useRef(null);
  const spacePressed = useRef(false);

  const canvasRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => { variationRef.current = variation; }, [variation]);

  useEffect(() => {
    const handleKeyDown = e => { if (e.code === "Space") spacePressed.current = true; };
    const handleKeyUp = e => { if (e.code === "Space") spacePressed.current = false; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Effective hole extents (w = horizontal, h = vertical)
  const hasCustomSize = CUSTOM_SIZE_SHAPES.includes(holeShape);
  const effW = hasCustomSize ? holeW : diameter;
  const effH = holeShape === "Triangle" && triEquilateral
    ? holeW * Math.sqrt(3) / 2
    : hasCustomSize ? holeH : diameter;

  // Derived pitches (hole extent + edge gap)
  const pitchX = effW + edgeGapX;
  const pitchY = effH + edgeGapY;
  // Hexagon honeycomb (pointy-top, 60° staggered): the edge gap is a uniform ligament, so the
  // centre spacing is 2·apothem + gap (= effW·√3/2 + gap), not effW + gap.
  const isHexHoneycomb = holeShape === "Hexagon" && patternType === "Staggered 60°";
  const honeyPitchX = isHexHoneycomb ? effW * Math.sqrt(3) / 2 + edgeGapX : pitchX;
  const honeyPitchY = isHexHoneycomb ? honeyPitchX * Math.sqrt(3) / 2 : pitchY;
  // Triangle always fills via its alternating ▲▽ tiling (except Radial);
  // Diamond interlocks into a rhombus lattice under the staggered mode.
  // Both keep the edge gap as a uniform ligament, so the cell that tiles the
  // plane is the hole expanded outward by gap/2 (a scale about the incenter).
  const isTriTiling = holeShape === "Triangle" && patternType !== "Radial";
  const isDiamondLattice = holeShape === "Diamond" && patternType === "Staggered 60°";
  const uniformGapMode = isHexHoneycomb || isTriTiling || isDiamondLattice;
  const triIn = triInradius(effW, effH);
  const triCellK = (triIn + edgeGapX / 2) / triIn;
  const diaIn = (effW * effH) / (2 * Math.hypot(effW, effH));
  const diaCellK = (diaIn + edgeGapX / 2) / diaIn;
  const radialExtents = getRadialShapeExtents(holeShape, effW, effH, diamondOrient);
  const radialOuterRadius = getRadialShapeOuterRadius(holeShape, effW, effH);
  const ringSpacing = radialLayout === "Concentric"
    ? diameter + radialEdgeGap
    : radialExtents.radial + radialEdgeGap;
  const circumSpacing = radialLayout === "Concentric"
    ? diameter + circumEdgeGap
    : radialExtents.tangential + circumEdgeGap;
  const sunflowerGap = Math.max(radialEdgeGap, circumEdgeGap);
  const sunflowerSpacing = radialOuterRadius * 2 + sunflowerGap;

  // Shape change: sync dimensions
  const handleShapeChange = useCallback((s) => {
    if (CUSTOM_SIZE_SHAPES.includes(s) && !CUSTOM_SIZE_SHAPES.includes(holeShape)) {
      // Switching from Circle/Hex → custom size: init from diameter
      setHoleW(s === "Pill" ? diameter * 2 : diameter);
      setHoleH(s === "Triangle" ? diameter * Math.sqrt(3) / 2 : diameter);
    }
    setHoleShape(s);
  }, [holeShape, diameter]);

  // Edge gap handlers
  const handleEdgeGapX = useCallback((v) => {
    setEdgeGapX(v);
    if (gapLinked) setEdgeGapY(v);
    setSelectedPreset(0);
  }, [gapLinked]);

  const handleEdgeGapY = useCallback((v) => {
    setEdgeGapY(v);
    setSelectedPreset(0);
  }, []);

  const handleRadialEdgeGap = useCallback((v) => {
    setRadialEdgeGap(v);
    if (radialLinked) setCircumEdgeGap(v);
  }, [radialLinked]);

  const handleCircumEdgeGap = useCallback((v) => {
    setCircumEdgeGap(v);
  }, []);

  const handleSunflowerGap = useCallback((v) => {
    setRadialEdgeGap(v);
    setCircumEdgeGap(v);
  }, []);

  const handleMarginUniform = useCallback((v) => {
    setMarginTop(v); setMarginBottom(v); setMarginLeft(v); setMarginRight(v);
  }, []);
  const hasAnyMargin = marginTop > 0 || marginBottom > 0 || marginLeft > 0 || marginRight > 0;

  const commitVariation = useCallback((nextOrUpdater) => {
    const current = variationRef.current;
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(cloneVariation(current)) : nextOrUpdater;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    variationPast.current = [...variationPast.current.slice(-39), cloneVariation(current)];
    variationFuture.current = [];
    variationRef.current = next;
    setVariation(next);
    setVariationHistoryVersion(v => v + 1);
  }, []);

  const updateVariationLive = useCallback((nextOrUpdater) => {
    const current = variationRef.current;
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(cloneVariation(current)) : nextOrUpdater;
    variationRef.current = next;
    setVariation(next);
  }, []);

  const selectedVariationLayer = useMemo(
    () => variation.layers.find(layer => layer.id === variation.selectedLayerId) || variation.layers[0],
    [variation]
  );

  const updateSelectedVariationLayer = useCallback((patch, record = false) => {
    const apply = current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === current.selectedLayerId ? { ...layer, ...patch } : layer),
    });
    if (record) commitVariation(apply);
    else updateVariationLive(apply);
  }, [commitVariation, updateVariationLive]);

  const undoVariation = useCallback(() => {
    const previous = variationPast.current.pop();
    if (!previous) return;
    variationFuture.current.push(cloneVariation(variationRef.current));
    variationRef.current = previous;
    setVariation(previous);
    setVariationHistoryVersion(v => v + 1);
  }, []);

  const redoVariation = useCallback(() => {
    const next = variationFuture.current.pop();
    if (!next) return;
    variationPast.current.push(cloneVariation(variationRef.current));
    variationRef.current = next;
    setVariation(next);
    setVariationHistoryVersion(v => v + 1);
  }, []);

  const applyVariationPreset = useCallback((name) => {
    const preset = VARIATION_PRESETS[name];
    if (!preset) return;
    commitVariation(current => {
      const selectedId = current.selectedLayerId || current.layers[0]?.id || "layer-1";
      const baseLayer = current.layers.find(layer => layer.id === selectedId) || current.layers[0] || createVariationLayer(1);
      return {
        ...current,
        enabled: true,
        minScale: preset.minScale,
        maxScale: preset.maxScale,
        selectedLayerId: baseLayer.id,
        layers: [{ ...baseLayer, ...preset.layer, enabled: true }],
      };
    });
    setVariationEditMode(true);
  }, [commitVariation]);

  const addVariationLayer = useCallback(() => {
    if (variationRef.current.layers.length >= 3) return;
    commitVariation(current => {
      const layer = createVariationLayer(current.layers.length + 1);
      return { ...current, enabled: true, layers: [...current.layers, layer], selectedLayerId: layer.id };
    });
  }, [commitVariation]);

  const removeSelectedVariationLayer = useCallback(() => {
    if (variationRef.current.layers.length <= 1) return;
    commitVariation(current => {
      const layers = current.layers.filter(layer => layer.id !== current.selectedLayerId);
      return { ...current, layers, selectedLayerId: layers[0].id };
    });
  }, [commitVariation]);

  const randomizeVariation = useCallback(() => {
    commitVariation(current => ({
      ...current,
      enabled: true,
      layers: current.layers.map(layer => randomizeVariationLayer(layer)),
    }));
    setVariationEditMode(true);
  }, [commitVariation]);

  const params = useMemo(() => ({
    diameter, holeShape, holeW: effW, holeH: effH, holeRadius, diamondOrient, patternType, pitchX, pitchY, sheetW, sheetH,
    marginTop, marginBottom, marginLeft, marginRight, cornerRadius,
    customAngle, radialEdgeGap, circumEdgeGap, ringSpacing, circumSpacing, radialMode, radialLayout, centerHole,
    thickness: showTaper ? thickness : 0, taperAngle: showTaper ? taperAngle : 0, taperDirection
  }), [diameter, holeShape, effW, effH, holeRadius, diamondOrient, patternType, pitchX, pitchY, sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, cornerRadius, customAngle, radialEdgeGap, circumEdgeGap, ringSpacing, circumSpacing, radialMode, radialLayout, centerHole, showTaper, thickness, taperAngle, taperDirection]);

  const baseHoles = useMemo(() => generateHoles(params), [params]);
  // Reset removed holes when pattern params change
  useEffect(() => { setRemovedHoles(new Set()); }, [params]);
  const isRadialPattern = patternType === "Radial";
  const perfW = sheetW - marginLeft - marginRight, perfH = sheetH - marginTop - marginBottom;
  const taperActive = showTaper && thickness > 0 && taperAngle > 0;
  const taperInset = taperActive ? 2 * thickness * Math.tan((taperAngle * Math.PI) / 180) : 0;

  const holes = useMemo(() => baseHoles.map((hole, index) => {
    const nx = perfW > 0 ? clamp((hole.x - marginLeft) / perfW, 0, 1) : 0.5;
    const ny = perfH > 0 ? clamp((hole.y - marginTop) / perfH, 0, 1) : 0.5;
    const scale = variationScaleAt(nx, ny, variation, index + 1);
    const w = Math.max(0.01, effW * scale);
    const h = Math.max(0.01, effH * scale);
    const culled = variation.enabled && variation.cullBelow > 0 && Math.min(w, h) < variation.cullBelow;
    const scaledRadius = Math.min(holeRadius * scale, w / 2, h / 2);
    const exitW = taperActive ? Math.max(0, w - taperInset) : w;
    const exitH = taperActive ? Math.max(0, h - taperInset) : h;
    const exitHoleRadius = Math.max(0, Math.min(scaledRadius - taperInset / 2, exitW / 2, exitH / 2));
    return {
      ...hole,
      id: hole.id || `hole-${index}`,
      culled,
      fieldValue: variation.enabled ? evaluateVariationField(nx, ny, variation, index + 1) : 1,
      scale, w, h, holeRadius: scaledRadius,
      area: calcHoleArea(holeShape, w, h, scaledRadius),
      exitW, exitH, exitHoleRadius,
      exitArea: exitW > 0 && exitH > 0 ? calcHoleArea(holeShape, exitW, exitH, exitHoleRadius) : 0,
      isClosed: taperActive && (exitW <= 0 || exitH <= 0),
    };
  }), [baseHoles, perfW, perfH, marginLeft, marginTop, variation, effW, effH, holeRadius, taperActive, taperInset, holeShape]);

  const activeHoles = useMemo(() => holes.filter((hole, i) => !removedHoles.has(i) && !hole.culled), [holes, removedHoles]);
  const activeHoleCount = activeHoles.length;
  const culledHoleCount = useMemo(() => holes.reduce((n, hole, i) => n + (hole.culled && !removedHoles.has(i) ? 1 : 0), 0), [holes, removedHoles]);
  const overlaps = useMemo(() => findOverlaps(activeHoles, holeShape), [activeHoles, holeShape]);
  const hasOverlap = overlaps.size > 0;
  const holeCount = holes.length;
  const grossArea = sheetW * sheetH;
  const radialCircleRadius = Math.min(perfW, perfH) / 2;
  const perforatedArea = (isRadialPattern && radialMode === "Circle")
    ? Math.PI * radialCircleRadius * radialCircleRadius
    : roundedRectArea(perfW, perfH, cornerRadius);
  const perfBounds = useMemo(() => ({
    xMin: marginLeft,
    xMax: sheetW - marginRight,
    yMin: marginTop,
    yMax: sheetH - marginBottom,
    cornerRadius,
    circleMode: isRadialPattern && radialMode === "Circle",
  }), [marginLeft, marginRight, marginTop, marginBottom, sheetW, sheetH, cornerRadius, isRadialPattern, radialMode]);
  const visibleAreaTotals = useMemo(() => activeHoles.reduce((totals, hole) => ({
    nominal: totals.nominal + estimateVisibleHoleArea(hole, holeShape, perfBounds, false),
    exit: totals.exit + estimateVisibleHoleArea(hole, holeShape, perfBounds, true),
  }), { nominal: 0, exit: 0 }), [activeHoles, holeShape, perfBounds]);
  const totalHoleArea = visibleAreaTotals.nominal;
  const totalExitHoleArea = visibleAreaTotals.exit;
  const singleHoleArea = activeHoleCount > 0 ? totalHoleArea / activeHoleCount : 0;

  // OAR calculation: use counted OAR when holes removed or margins present; else theoretical
  const hasRemovedHoles = removedHoles.size > 0;
  const useCountedOAR = variation.enabled || hasRemovedHoles || hasAnyMargin || cornerRadius > 0 || isRadialPattern;
  const theoreticalHoleArea = calcHoleArea(holeShape, effW, effH, holeRadius);
  // Triangle tiling / diamond lattice: one hole per tiling cell (the hole
  // expanded by gap/2), so the unit cell is simply that cell's area.
  const uniformCellArea = isTriTiling ? (effW * effH / 2) * triCellK * triCellK
    : isDiamondLattice ? (effW * effH / 2) * diaCellK * diaCellK
    : null;
  const theoreticalOAR = uniformCellArea
    ? Math.min((theoreticalHoleArea / uniformCellArea) * 100, 100)
    : calcTheoreticalOAR(patternType, honeyPitchX, honeyPitchY, theoreticalHoleArea);
  const countedOAR = perforatedArea > 0 ? (totalHoleArea / perforatedArea) * 100 : 0;
  const nominalOAR = useCountedOAR ? countedOAR : theoreticalOAR;

  const closedHoleCount = activeHoles.filter(hole => hole.isClosed).length;
  const holeClosed = activeHoleCount > 0 && closedHoleCount === activeHoleCount;
  const hasClosedHoles = closedHoleCount > 0;
  const dExitValues = activeHoles.filter(hole => !hole.isClosed).map(hole => Math.min(hole.exitW, hole.exitH));
  const dExit = dExitValues.length ? dExitValues.reduce((sum, value) => sum + value, 0) / dExitValues.length : 0;
  const minExit = dExitValues.length ? Math.min(...dExitValues) : 0;
  const maxExit = dExitValues.length ? Math.max(...dExitValues) : 0;
  const theoreticalExitW = taperActive ? Math.max(0, effW - taperInset) : effW;
  const theoreticalExitH = taperActive ? Math.max(0, effH - taperInset) : effH;
  const theoreticalExitRadius = Math.max(0, Math.min(holeRadius - taperInset / 2, theoreticalExitW / 2, theoreticalExitH / 2));
  const theoreticalExitArea = theoreticalExitW > 0 && theoreticalExitH > 0 ? calcHoleArea(holeShape, theoreticalExitW, theoreticalExitH, theoreticalExitRadius) : 0;
  const theoreticalEffOAR = uniformCellArea
    ? Math.min((theoreticalExitArea / uniformCellArea) * 100, 100)
    : calcTheoreticalOAR(patternType, honeyPitchX, honeyPitchY, theoreticalExitArea);
  const countedEffOAR = perforatedArea > 0 ? (totalExitHoleArea / perforatedArea) * 100 : 0;
  const effectiveOAR = useCountedOAR ? countedEffOAR : theoreticalEffOAR;
  const oarDelta = taperActive ? effectiveOAR - nominalOAR : 0;
  const displayOAR = taperActive ? effectiveOAR : nominalOAR;
  const nominalNeighborSpacing = isRadialPattern ? Math.max(ringSpacing, circumSpacing) : Math.max(pitchX, pitchY);
  const minLigament = useMemo(() => calcMinLigament(activeHoles, holeShape, nominalNeighborSpacing), [activeHoles, holeShape, nominalNeighborSpacing]);
  const perfMode = holeCount > 10000;

  const applyPreset = useCallback((idx) => {
    setSelectedPreset(idx);
    if (idx === 0) return;
    const p = DIN_PRESETS[idx];
    setDiameter(p.d);
    setEdgeGapX(Math.max(0, p.pitchX - p.d));
    setEdgeGapY(Math.max(0, p.pitchY - p.d));
    setPatternType(p.pattern);
  }, []);

  // ─── Canvas rendering ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = rect.width, ch = rect.height;

    ctx.fillStyle = dark ? "#0f0f11" : "#e8e8ec";
    ctx.fillRect(0, 0, cw, ch);

    const fitScale = Math.min((cw - 80) / sheetW, (ch - 80) / sheetH);
    const baseScale = fitScale * zoom;
    const cx = cw / 2 + pan.x, cy = ch / 2 + pan.y;
    // Store the view transform so pointer handlers can convert client <-> sheet space.
    gizmoRef.current = { baseScale, originX: cx - baseScale * sheetW / 2, originY: cy - baseScale * sheetH / 2 };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(baseScale, baseScale);
    ctx.translate(-sheetW / 2, -sheetH / 2);

    // Sheet shadow
    ctx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 20 / baseScale;
    ctx.shadowOffsetX = 3 / baseScale; ctx.shadowOffsetY = 3 / baseScale;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, sheetW, sheetH);
    ctx.shadowColor = "transparent";

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, sheetW, sheetH);

    {
      const mx = marginLeft, my = marginTop;
      const mw = sheetW - marginLeft - marginRight, mh = sheetH - marginTop - marginBottom;
      const cr = Math.min(cornerRadius, mw / 2, mh / 2);
      const isCircleMode = isRadialPattern && radialMode === "Circle";
      const showBoundary = showHud && (hasAnyMargin || cornerRadius > 0 || isCircleMode);
      if (showBoundary) {
        ctx.strokeStyle = dark ? "rgba(100,160,250,0.15)" : "rgba(37,99,235,0.1)";
        ctx.lineWidth = 0.3; ctx.setLineDash([2, 2]);
        ctx.beginPath();
        if (isCircleMode) {
          const cRadius = Math.min(mw, mh) / 2;
          ctx.arc(mx + mw / 2, my + mh / 2, cRadius, 0, Math.PI * 2);
        } else {
          ctx.roundRect(mx, my, mw, mh, cr);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Shade outside
        ctx.fillStyle = dark ? "rgba(100,160,250,0.04)" : "rgba(37,99,235,0.03)";
        ctx.fillRect(0, 0, sheetW, sheetH);
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        if (isCircleMode) {
          const cRadius = Math.min(mw, mh) / 2;
          ctx.arc(mx + mw / 2, my + mh / 2, cRadius, 0, Math.PI * 2);
        } else {
          ctx.roundRect(mx, my, mw, mh, cr);
        }
        ctx.fill();
        ctx.restore();
      }
    }

    if (variation.enabled && variationEditMode && showHud) {
      const cols = 34, rows = Math.max(18, Math.round(cols * perfH / Math.max(1, perfW)));
      const cellW = perfW / cols, cellH = perfH / rows;
      ctx.save();
      ctx.globalCompositeOperation = dark ? "screen" : "multiply";
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const value = evaluateVariationField((gx + 0.5) / cols, (gy + 0.5) / rows, variation, gy * cols + gx + 1);
          const alpha = 0.015 + value * 0.075;
          ctx.fillStyle = dark ? `rgba(70,135,255,${alpha})` : `rgba(37,99,235,${alpha * 0.7})`;
          ctx.fillRect(marginLeft + gx * cellW, marginTop + gy * cellH, cellW + 0.05, cellH + 0.05);
        }
      }
      ctx.restore();
    }

    const showTaperRings = taperActive && !perfMode;

    // Clip holes to the actual perforation boundary so preview, OAR and exports agree.
    ctx.save();
    tracePerfBoundary(ctx, params);
    ctx.clip();

    if (perfMode) {
      ctx.fillStyle = holeColor;
      holes.forEach((h, i) => {
        if (removedHoles.has(i) || h.culled) return;
        ctx.fillRect(h.x - h.w * 0.35, h.y - h.h * 0.35, h.w * 0.7, h.h * 0.7);
      });
    } else {
      // Build overlap set based on active (non-removed, non-culled) holes mapping
      const activeIndices = [];
      holes.forEach((h, i) => { if (!removedHoles.has(i) && !h.culled) activeIndices.push(i); });
      const activeOverlapSet = new Set();
      overlaps.forEach((activeIdx) => {
        if (activeIdx < activeIndices.length) activeOverlapSet.add(activeIndices[activeIdx]);
      });

      holes.forEach((h, i) => {
        const isRemoved = removedHoles.has(i);
        const r = Math.max(h.w, h.h) / 2;
        if (h.culled && !isRemoved) {
          // Culled by the size floor: gone from the real pattern. Show a faint ghost only while editing.
          if (variation.enabled && variationEditMode && showHud) {
            ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(0.15, r), 0, Math.PI * 2);
            ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
            ctx.lineWidth = 0.2; ctx.setLineDash([0.6, 0.6]); ctx.stroke(); ctx.setLineDash([]);
          }
          return;
        }
        if (isRemoved) {
          if (!showHud) return; // HUD hidden: removed holes vanish entirely
          // Draw removed hole as faint outline
          ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
          ctx.strokeStyle = dark ? "rgba(255,100,100,0.25)" : "rgba(200,50,50,0.2)";
          ctx.lineWidth = 0.4;
          ctx.setLineDash([1, 1]); ctx.stroke(); ctx.setLineDash([]);
          // Draw X mark
          ctx.strokeStyle = dark ? "rgba(255,100,100,0.35)" : "rgba(200,50,50,0.3)";
          ctx.lineWidth = 0.3;
          const xr = r * 0.5;
          ctx.beginPath(); ctx.moveTo(h.x - xr, h.y - xr); ctx.lineTo(h.x + xr, h.y + xr); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(h.x + xr, h.y - xr); ctx.lineTo(h.x - xr, h.y + xr); ctx.stroke();
          return;
        }
        const isOverlap = activeOverlapSet.has(i);
        const isClosed = h.isClosed;
        // Draw hole shape
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
        ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
          : isOverlap ? (dark ? "rgba(220,50,50,0.7)" : "rgba(200,30,30,0.6)")
          : holeColor;
        ctx.fill();
        if (showTaperRings && !isClosed) {
          ctx.strokeStyle = dark ? "rgba(200,200,210,0.4)" : "rgba(60,60,70,0.35)";
          ctx.lineWidth = 0.25; ctx.stroke();
        }
        // Subtle gradient for non-circle only on circle (skip for complex shapes for perf)
        if (holeShape === "Circle" && !isOverlap && !isClosed && zoom > 0.5) {
          const grad = ctx.createRadialGradient(h.x - r * 0.2, h.y - r * 0.2, 0, h.x, h.y, r);
          grad.addColorStop(0, dark ? "rgba(40,40,45,0.3)" : "rgba(60,60,65,0.2)");
          grad.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
        // Taper ring: fill gap between entry and exit shapes
        if (showTaperRings && h.exitW > 0 && h.exitH > 0 && !isClosed) {
          ctx.beginPath();
          traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
          // Cut out the exit shape (reverse winding)
          ctx.save();
          ctx.clip();
          // Fill the entire clipped area, then clear the exit shape
          ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
          ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
          // Clear exit shape by drawing it with the hole color
          ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius);
          ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
            : holeColor;
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // End hole clipping
    ctx.restore();

    ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.5; ctx.strokeRect(0, 0, sheetW, sheetH);

    if (variation.enabled && variationEditMode && selectedVariationLayer && showHud) {
      const px = 1 / baseScale;                       // one screen pixel in sheet units
      const g = computeGizmo(selectedVariationLayer, { marginLeft, marginTop, perfW, perfH }, 12 * px);
      const accent = dark ? "#93c5fd" : "#2563eb";
      const dialColor = dark ? "#fbbf24" : "#d97706";
      const space = selectedVariationLayer.space;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, sheetW, sheetH); ctx.clip();

      // Spread ring (where the field reaches) — meaningful for radial-like spaces.
      if (space === "Radial" || space === "Spiral") {
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1 * px; ctx.setLineDash([4 * px, 4 * px]);
        ctx.beginPath(); ctx.arc(g.centerX, g.centerY, g.reachLen, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // Gradient line: center (start) -> reach (end).
      ctx.strokeStyle = accent; ctx.lineWidth = 1.4 * px;
      ctx.beginPath(); ctx.moveTo(g.centerX, g.centerY); ctx.lineTo(g.reachX, g.reachY); ctx.stroke();

      // Curve dial: rotary track + needle hugging the centre (lens-blur amount ring).
      ctx.strokeStyle = dialColor; ctx.globalAlpha = 0.35; ctx.lineWidth = 1 * px;
      ctx.beginPath(); ctx.arc(g.centerX, g.centerY, g.dialR, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(g.centerX, g.centerY); ctx.lineTo(g.curveX, g.curveY); ctx.stroke();
      ctx.globalAlpha = 1;

      // Reach handle (open ring) — gradient end point.
      ctx.strokeStyle = accent; ctx.lineWidth = 1.6 * px;
      ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
      ctx.beginPath(); ctx.arc(g.reachX, g.reachY, 5 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Position/phase stop (filled diamond) — slides along the gradient line.
      ctx.fillStyle = accent; ctx.strokeStyle = dark ? "#0f0f11" : "#ffffff"; ctx.lineWidth = 1 * px;
      ctx.save(); ctx.translate(g.stopX, g.stopY); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3.4 * px, -3.4 * px, 6.8 * px, 6.8 * px);
      ctx.strokeRect(-3.4 * px, -3.4 * px, 6.8 * px, 6.8 * px); ctx.restore();

      // Curve knob (filled dot on the dial).
      ctx.fillStyle = dialColor; ctx.strokeStyle = dark ? "#0f0f11" : "#ffffff"; ctx.lineWidth = 1 * px;
      ctx.beginPath(); ctx.arc(g.curveX, g.curveY, 4 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Center handle (filled dot with light core) — gradient start.
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(g.centerX, g.centerY, 5.5 * px, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
      ctx.beginPath(); ctx.arc(g.centerX, g.centerY, 2 * px, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    }
    ctx.restore();

    if (perfMode) {
      ctx.fillStyle = dark ? "rgba(220,160,40,0.85)" : "rgba(180,120,20,0.9)";
      ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText(`⚡ Performance mode (${holeCount.toLocaleString()} holes)`, 12, ch - 12);
    }
  }, [holes, overlaps, params, dark, pan, zoom, perfMode, holeCount, holeShape, pitchX, pitchY, patternType, marginTop, marginBottom, marginLeft, marginRight, hasAnyMargin, cornerRadius, radialMode, isRadialPattern, sheetW, sheetH, taperActive, thickness, taperAngle, taperDirection, removedHoles, variation, variationEditMode, selectedVariationLayer, perfW, perfH, holeColor, bgColor, showHud]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      canvas.style.width = containerRef.current.getBoundingClientRect().width + "px";
      canvas.style.height = containerRef.current.getBoundingClientRect().height + "px";
      setPan(p => ({ ...p }));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(z => {
      const nz = clamp(z * factor, 0.1, 20);
      const scale = nz / z;
      setPan(p => ({
        x: mx - scale * (mx - p.x - cx) - cx,
        y: my - scale * (my - p.y - cy) - cy,
      }));
      return nz;
    });
  }, []);

  const pointerDownPos = useRef(null);
  const clientToSheet = useCallback((clientX, clientY) => {
    const view = gizmoRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!view || !rect) return null;
    return {
      x: (clientX - rect.left - view.originX) / view.baseScale,
      y: (clientY - rect.top - view.originY) / view.baseScale,
    };
  }, []);
  const selectedLayerLive = useCallback(() => {
    const v = variationRef.current;
    return v.layers.find(l => l.id === v.selectedLayerId) || v.layers[0];
  }, []);
  const setShapeHud = useCallback((layer) => {
    const usesPosition = gizmoUsesPosition(layer);
    setVariationHud({
      positionLabel: usesPosition ? "Position" : "Phase",
      positionValue: usesPosition ? layer.position : layer.phase,
      exponent: layer.exponent,
    });
  }, []);
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    const view = gizmoRef.current;
    if (variation.enabled && variationEditMode && showHud && !spacePressed.current && selectedVariationLayer && view) {
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (sheet) {
        const geom = { marginLeft, marginTop, perfW, perfH };
        const g = computeGizmo(selectedVariationLayer, geom, 12 / view.baseScale);
        const candidates = [
          { handle: "stop", x: g.stopX, y: g.stopY },
          { handle: "curve", x: g.curveX, y: g.curveY },
          { handle: "reach", x: g.reachX, y: g.reachY },
          { handle: "center", x: g.centerX, y: g.centerY },
        ];
        let hit = null, hitDist = 16; // screen-px hit radius
        for (const c of candidates) {
          const d = Math.hypot(c.x - sheet.x, c.y - sheet.y) * view.baseScale;
          if (d < hitDist) { hit = c.handle; hitDist = d; }
        }
        if (hit) {
          variationDrag.current = { handle: hit, startVariation: cloneVariation(variationRef.current) };
          if (hit === "stop" || hit === "curve") setShapeHud(selectedVariationLayer); else setVariationHud(null);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan, variation.enabled, variationEditMode, showHud, selectedVariationLayer, marginLeft, marginTop, perfW, perfH, clientToSheet, setShapeHud]);
  const handlePointerMove = useCallback((e) => {
    if (variationDrag.current) {
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (!sheet) return;
      const layer = selectedLayerLive();
      if (!layer) return;
      const geom = { marginLeft, marginTop, perfW, perfH };
      const handle = variationDrag.current.handle;
      let patch;
      const shift = e.shiftKey;
      if (handle === "center") patch = gizmoPatchForCenter(sheet.x, sheet.y, geom, shift);
      else if (handle === "reach") patch = gizmoPatchForReach(sheet.x, sheet.y, layer, geom, layer.space === "Angular", shift);
      else if (handle === "stop") patch = gizmoPatchForStop(sheet.x, sheet.y, layer, geom, shift);
      else patch = gizmoPatchForCurve(sheet.x, sheet.y, layer, geom, shift);
      updateVariationLive(current => ({
        ...current,
        layers: current.layers.map(l => l.id === current.selectedLayerId ? { ...l, ...patch } : l),
      }));
      if (handle === "stop" || handle === "curve") setShapeHud({ ...layer, ...patch });
      return;
    }
    if (!isPanning) return;
    setPan({ x: panOrigin.current.x + (e.clientX - panStart.current.x), y: panOrigin.current.y + (e.clientY - panStart.current.y) });
  }, [isPanning, updateVariationLive, clientToSheet, selectedLayerLive, marginLeft, marginTop, perfW, perfH, setShapeHud]);
  const handlePointerUp = useCallback((e) => {
    if (variationDrag.current) {
      const startVariation = variationDrag.current.startVariation;
      variationDrag.current = null;
      if (JSON.stringify(startVariation) !== JSON.stringify(variationRef.current)) {
        variationPast.current = [...variationPast.current.slice(-39), startVariation];
        variationFuture.current = [];
        setVariationHistoryVersion(v => v + 1);
      }
      window.setTimeout(() => setVariationHud(null), 650);
      pointerDownPos.current = null;
      return;
    }
    setIsPanning(false);
    // Detect click (not drag) for hole removal
    if (holeRemovalMode && pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cw = rect.width, ch = rect.height;
        const fitScale = Math.min((cw - 80) / sheetW, (ch - 80) / sheetH);
        const baseScale = fitScale * zoom;
        const cx = cw / 2 + pan.x, cy = ch / 2 + pan.y;
        // Convert screen coords to sheet coords
        const sheetX = (clickX - cx) / baseScale + sheetW / 2;
        const sheetY = (clickY - cy) / baseScale + sheetH / 2;
        // Find closest hole using each hole's current, varied size.
        let closestIdx = -1, closestDist = Infinity;
        holes.forEach((h, i) => {
          if (h.culled) return; // already gone from the pattern
          const d = Math.hypot(h.x - sheetX, h.y - sheetY);
          const hitRadius = Math.max(1.5, Math.max(h.w, h.h) * 0.75);
          if (d < hitRadius && d < closestDist) { closestDist = d; closestIdx = i; }
        });
        if (closestIdx >= 0) {
          setRemovedHoles(prev => {
            const next = new Set(prev);
            if (next.has(closestIdx)) next.delete(closestIdx);
            else next.add(closestIdx);
            return next;
          });
        }
      }
    }
    pointerDownPos.current = null;
  }, [holeRemovalMode, holes, sheetW, sheetH, zoom, pan]);

  // Exports
  const exportSVG = useCallback(() => {
    const blob = new Blob([generateSVGString(activeHoles, { ...params, holeColor, bgColor })], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perforation_pattern.svg"; a.click();
  }, [activeHoles, params, holeColor, bgColor]);

  const exportPNG = useCallback(() => {
    const oc = document.createElement("canvas");
    oc.width = sheetW * 8; oc.height = sheetH * 8;
    const ctx = oc.getContext("2d");
    const s = Math.min(oc.width / sheetW, oc.height / sheetH);
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, oc.width, oc.height);
    ctx.save(); ctx.scale(s, s);
    tracePerfBoundary(ctx, params);
    ctx.clip();
    activeHoles.forEach(h => {
      ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
      ctx.fillStyle = h.isClosed ? "rgba(200,30,30,0.5)" : holeColor;
      ctx.fill();
      if (taperActive && h.exitW > 0 && h.exitH > 0 && !h.isClosed) {
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
        ctx.save(); ctx.clip();
        ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
        ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius);
        ctx.fillStyle = holeColor;
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
    oc.toBlob(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perforation_pattern.png"; a.click(); });
  }, [activeHoles, sheetW, sheetH, holeShape, dark, taperActive, holeColor, bgColor, params]);

  // Theme
  const sidebarBorder = dark ? "#27272a" : "#e0e0e5";
  const textPrimary = dark ? "#e4e4e7" : "#18181b";
  const textSecondary = dark ? "#71717a" : "#71717a";
  const sectionBorder = dark ? "#232327" : "#e8e8ee";
  const controlBg = dark ? "#131316" : "#ffffff";
  const btnBg = dark ? "#27272a" : "#e8e8ec";
  const accentColor = dark ? "#60a5fa" : "#2563eb";
  const warnColor = "#ef4444";
  const panelBg = dark ? "#161619" : "#ffffff";
  const cardBg = dark ? "#1d1d21" : "#f6f6f8";
  // Floating surfaces: layered transparent shadows instead of hard borders
  const floatShadow = dark
    ? "0 0 0 1px rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.35), 0 16px 32px rgba(0,0,0,0.28)"
    : "0 0 0 1px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.05), 0 12px 28px rgba(0,0,0,0.09)";
  // Sidebar sections render as cards: radius 8 + shell padding 8 keeps them concentric with the 16px shell
  const sectionStyle = { padding: 14, marginBottom: 8, background: cardBg, border: `1px solid ${sectionBorder}`, borderRadius: 8 };
  const sectionTitle = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: textSecondary, marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" };

  const isRadial = patternType === "Radial";
  const showGapY = patternType === "Straight" || patternType === "Custom Angle";
  // Effective pitchY for staggered patterns (auto-derived)
  // Uses diagonal distance check: in staggered layouts, nearest neighbor is at (pitchX/2, effPY)
  const _sHalfPX = pitchX / 2;
  const _sMinGap = Math.min(edgeGapX, edgeGapY);
  const _sHoleDim = Math.max(effW, effH);
  const _sMinDist = _sHoleDim + _sMinGap;
  const _sMinPY = Math.sqrt(Math.max(effH * effH, _sMinDist * _sMinDist - _sHalfPX * _sHalfPX));
  const effPitchX = honeyPitchX;
  const effPitchY = isHexHoneycomb
    ? honeyPitchY
    : patternType === "Staggered 60°"
      ? Math.max(pitchX * Math.sqrt(3) / 2, _sMinPY)
      : patternType === "Staggered 45°"
        ? Math.max(pitchX, _sMinPY)
        : pitchY;
  // Spacing readouts for the uniform-ligament modes (hex / triangle / diamond)
  const uniformColPitch = isTriTiling ? (effW * triCellK) / 2 : isDiamondLattice ? effW * diaCellK : effPitchX;
  const uniformRowPitch = isTriTiling ? effH * triCellK : isDiamondLattice ? (effH * diaCellK) / 2 : effPitchY;
  const polyCornerMax = (holeShape === "Diamond" || holeShape === "Triangle")
    ? Math.max(0.1, Math.floor(maxCornerRadius(basePolyVerts(holeShape, effW, effH)) * 10) / 10)
    : 0;
  const canUndoVariation = variationHistoryVersion >= 0 && variationPast.current.length > 0;
  const canRedoVariation = variationHistoryVersion >= 0 && variationFuture.current.length > 0;

  // Segmented button helper
  const SegBtn = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      flex: 1, padding: "6px 8px", fontSize: 10, borderRadius: 4,
      border: `1px solid ${active ? accentColor : sidebarBorder}`,
      background: active ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent",
      color: active ? accentColor : textSecondary,
      cursor: "pointer", fontFamily: "'JetBrains Mono', monospace"
    }}>{label}</button>
  );

  // Dropdown helper (label + custom Select), used in the sidebar's Pattern card
  const topLabelStyle = { fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: textSecondary, fontFamily: "'JetBrains Mono', monospace" };
  const dropdown = (label, value, onChange, options) => (
    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
      <span style={topLabelStyle}>{label}</span>
      <Select value={value} onChange={onChange} options={options} dark={dark} ariaLabel={label} />
    </div>
  );
  const topStat = (label, value, color) => (
    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2, whiteSpace: "nowrap" }}>
      <span style={topLabelStyle}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: color || textPrimary, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1 }}>{value}</span>
    </div>
  );
  // Small label/value row for the canvas HUD card
  const hudRow = (label, value, color, testId) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
      <span style={{ color: textSecondary }}>{label}</span>
      <span data-testid={testId} style={{ color: color || textPrimary, fontWeight: 500 }}>{value}</span>
    </div>
  );
  const topDivider = <div style={{ width: 1, alignSelf: "stretch", background: sectionBorder, margin: "10px 0" }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100vw", height: "100vh", padding: 10, background: dark ? "#0b0b0d" : "#dfdfe5", color: textPrimary, fontFamily: "'JetBrains Mono', -apple-system, sans-serif", overflow: "hidden", WebkitFontSmoothing: "antialiased", fontVariantNumeric: "tabular-nums" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Floating top bar — OAR info only */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, height: 54, flexShrink: 0, padding: "0 18px", background: panelBg, borderRadius: 12, boxShadow: floatShadow }}>
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.3 }}>Perf Pattern</div>
          <div style={{ fontSize: 8, color: textSecondary, marginTop: 1, letterSpacing: 0.5 }}>PERFORATION GENERATOR</div>
        </div>
        {topDivider}
        {/* Current OAR */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
          <span data-testid="stat-oar" style={{ fontSize: 24, fontWeight: 700, color: accentColor, lineHeight: 1 }}>{displayOAR.toFixed(1)}</span>
          <span style={{ fontSize: 10, color: textSecondary }}>% OAR</span>
          {taperActive && oarDelta < 0 && <span style={{ fontSize: 9, color: dark ? "#f87171" : "#dc2626" }}>({oarDelta.toFixed(1)}%p taper)</span>}
        </div>
        {taperActive && <>
          {topDivider}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {topStat("Surface OAR", `${nominalOAR.toFixed(1)}%`, dark ? "#999" : "#666")}
            {topStat("Effective OAR", `${effectiveOAR.toFixed(1)}%`, accentColor)}
          </div>
        </>}
        <div style={{ flex: 1 }} />
        {/* View controls: HUD toggle + reset, next to the theme toggle */}
        <button onClick={() => setShowHud(v => !v)}
          title="Show/hide all canvas overlays (margins, removed-hole marks, stats, gizmos)"
          style={{ height: 30, padding: "0 10px", borderRadius: 7, border: `1px solid ${showHud ? sidebarBorder : accentColor}`, background: controlBg, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: showHud ? textPrimary : accentColor, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
          {showHud ? <Eye size={12} /> : <EyeOff size={12} />} HUD
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          title="Reset zoom & pan"
          style={{ height: 30, padding: "0 10px", borderRadius: 7, border: `1px solid ${sidebarBorder}`, background: controlBg, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: textPrimary, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
          <Maximize size={12} /> Reset View
        </button>
        <button onClick={() => setDark(d => !d)} title="Toggle theme"
          style={{ width: 30, height: 30, borderRadius: 7, border: `1px solid ${sidebarBorder}`, background: controlBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: textPrimary, flexShrink: 0 }}>
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Body: floating sidebar (left) + floating canvas (right, via flex order) */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 10 }}>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", order: 2, borderRadius: 16, boxShadow: floatShadow, background: dark ? "#0f0f11" : "#e8e8ec" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", height: "100%", cursor: variation.enabled && variationEditMode ? "crosshair" : isPanning ? "grabbing" : holeRemovalMode ? "crosshair" : "grab", touchAction: "none" }}
          onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        />
        {/* Top-left HUD: key stats + warnings */}
        {showHud && (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          {/* Stats card */}
          <div style={{ background: dark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", padding: "8px 12px", borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}` }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>Holes <span data-testid="stat-holes" style={{ color: textPrimary, fontWeight: 500 }}>{activeHoleCount.toLocaleString()}</span>{hasRemovedHoles ? <span style={{ color: warnColor }}> / {holeCount.toLocaleString()}</span> : ""}</span>
              <span style={{ fontSize: 10, color: textSecondary }}>{zoom.toFixed(1)}x</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {hudRow(variation.enabled ? "Avg Hole Area" : "Hole Area", `${singleHoleArea.toFixed(2)} mm²`)}
              {hudRow("Open Area", `${totalHoleArea.toFixed(1)} mm²`)}
              {hudRow("Panel Area", `${grossArea.toFixed(0)} mm²`)}
              {hudRow("Perf. Area", `${perforatedArea.toFixed(0)} mm²`)}
              {minLigament !== null && hudRow("Min Ligament", `${minLigament.toFixed(2)} mm`, minLigament <= 0 ? warnColor : accentColor, "stat-ligament")}
            </div>
          </div>
          {/* Warning badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {hasOverlap && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#fff", background: warnColor, padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}><TriangleAlert size={10} /> Holes overlap</span>}
            {taperActive && hasClosedHoles && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#fff", background: warnColor, padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}><TriangleAlert size={10} /> {closedHoleCount}/{activeHoleCount} holes closed</span>}
            {holeRemovalMode && <span style={{ fontSize: 10, color: "#fff", background: dark ? "#7c3aed" : "#6d28d9", padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>HOLE REMOVAL MODE{removedHoles.size > 0 ? ` (${removedHoles.size} removed)` : ""}</span>}
            {variation.enabled && variationEditMode && <span style={{ fontSize: 10, color: "#fff", background: dark ? "#2563eb" : "#1d4ed8", padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>EDIT VARIATION · SPACE TO PAN</span>}
          </div>
        </div>
        )}
        {showHud && variationHud && (
          <div style={{ position: "absolute", right: 18, bottom: 18, width: 190, padding: "10px 12px", borderRadius: 7, background: dark ? "rgba(10,10,14,0.82)" : "rgba(255,255,255,0.88)", border: `1px solid ${dark ? "rgba(147,197,253,0.25)" : "rgba(37,99,235,0.2)"}`, backdropFilter: "blur(12px)", pointerEvents: "none", boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: textSecondary, marginBottom: 5 }}><span>{variationHud.positionLabel}</span><span style={{ color: accentColor }}>{variationHud.positionValue.toFixed(2)}</span></div>
            <div style={{ height: 2, borderRadius: 2, background: dark ? "#292933" : "#ddd", marginBottom: 8 }}><div style={{ width: `${variationHud.positionValue * 100}%`, height: "100%", background: accentColor }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: textSecondary, marginBottom: 5 }}><span>Curve</span><span style={{ color: accentColor }}>{variationHud.exponent.toFixed(2)}</span></div>
            <div style={{ height: 2, borderRadius: 2, background: dark ? "#292933" : "#ddd" }}><div style={{ width: `${clamp(variationHud.exponent / 5, 0, 1) * 100}%`, height: "100%", background: accentColor }} /></div>
          </div>
        )}
      </div>

      {/* Floating sidebar (left): uniform 8px padding on the shell; the inner scroller
          bleeds 5px into the right padding so the scrollbar overlays it — content stays
          inset 8px on every side. */}
      <div style={{ width: 440, minWidth: 440, height: "100%", order: 1, background: panelBg, borderRadius: 16, boxShadow: floatShadow, padding: 8, boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ height: "100%", overflowY: "auto", overflowX: "hidden", marginRight: -5, paddingRight: 5, scrollbarWidth: "thin", scrollbarColor: dark ? "#333 transparent" : "#ccc transparent" }}>

        {/* Pattern & hole options */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Pattern & Hole</div>
          {dropdown("Preset (DIN 24041)", selectedPreset, v => applyPreset(parseInt(v)), DIN_PRESETS.map((p, i) => ({ value: i, label: p.name })))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {dropdown("Type", patternType, v => { setPatternType(v); setSelectedPreset(0); }, PATTERN_TYPES.map(pt => ({ value: pt, label: pt })))}
            {dropdown("Hole Shape", holeShape, v => handleShapeChange(v), HOLE_SHAPES.map(s => ({ value: s, label: s })))}
          </div>
        </div>

        {/* Dimensions */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Dimensions</div>
          {holeShape === "Triangle" && !isRadial && (
            <div style={{ fontSize: 9, color: textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              ▲▽ Triangles fill in alternating up/down rows — a seamless fit at 0 gap. All grid types share this tiling; Radial places them on rings instead.
            </div>
          )}
          {isDiamondLattice && (
            <div style={{ fontSize: 9, color: textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              ◆ Staggered 60° interlocks diamonds into a rhombus lattice — a seamless fit at 0 gap.
            </div>
          )}
          {holeShape === "Diamond" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Diamond Orientation</div>
              <div style={{ display: "flex", gap: 5 }}>
                {DIAMOND_ORIENTATIONS.map(o => (
                  <SegBtn key={o} label={o === "Point up" ? "◆ Point up" : "◼ Flat up"} active={diamondOrient === o} onClick={() => setDiamondOrient(o)} />
                ))}
              </div>
            </div>
          )}
          {hasCustomSize ? (
            <>
              <SliderRow label={holeShape === "Triangle" ? "Base Width (W)" : holeShape === "Diamond" ? "Width (diagonal)" : "Width (W)"} value={holeW} min={0.5} max={30} step={0.1} onChange={v => { setHoleW(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
              {holeShape === "Triangle" && (
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: textSecondary }}>Equilateral (H = W·√3/2)</span>
                  <Toggle value={triEquilateral} onChange={setTriEquilateral} dark={dark} label="Equilateral" />
                </label>
              )}
              {holeShape === "Triangle" && triEquilateral ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: dark ? "#555" : "#aaa", marginTop: -4, marginBottom: 10, paddingLeft: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  <MoveVertical size={9} style={{ flexShrink: 0 }} /> Height (H): {effH.toFixed(2)} mm
                </div>
              ) : (
                <SliderRow label={holeShape === "Diamond" ? "Height (diagonal)" : "Height (H)"} value={holeH} min={0.5} max={30} step={0.1} onChange={v => { setHoleH(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
              )}
              {holeShape === "Rectangle" && <SliderRow label="Hole Corner R" value={holeRadius} min={0} max={Math.min(holeW, holeH) / 2} step={0.1} onChange={setHoleRadius} unit="mm" dark={dark} />}
              {(holeShape === "Diamond" || holeShape === "Triangle") && <SliderRow label="Hole Corner R" value={holeRadius} min={0} max={polyCornerMax} step={0.1} onChange={setHoleRadius} unit="mm" dark={dark} />}
            </>
          ) : (
            <SliderRow label="Hole Diameter" value={diameter} min={0.5} max={20} step={0.1} onChange={v => { setDiameter(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
          )}
          {holeShape === "Hexagon" && <SliderRow label="Hole Corner R" value={holeRadius} min={0} max={Math.sqrt(3) * diameter / 4} step={0.1} onChange={setHoleRadius} unit="mm" dark={dark} />}
          {patternType === "Custom Angle" && holeShape !== "Triangle" && <SliderRow label="Stagger Angle" value={customAngle} min={0} max={90} step={1} onChange={setCustomAngle} unit="°" dark={dark} />}

          {isRadial ? (
            <>
              <div style={{ marginBottom: 12 }}>
                {dropdown("Radial Pattern", radialLayout, v => { setRadialLayout(v); setSelectedPreset(0); }, RADIAL_LAYOUTS.map(layout => ({ value: layout, label: layout })))}
              </div>
              {radialLayout === "Sunflower" ? (
                <>
                  <SliderRow label="Edge Gap" value={sunflowerGap} min={0} max={50} step={0.1} onChange={handleSunflowerGap} unit="mm" dark={dark} />
                  <PitchInfo label="min center spacing" value={sunflowerSpacing} dark={dark} />
                  <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>Golden angle · Fermat spiral</div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Gap Link</span>
                    <button onClick={() => { setRadialLinked(v => !v); if (!radialLinked) setCircumEdgeGap(radialEdgeGap); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                      title={radialLinked ? "Unlink gap" : "Link gap"}>
                      <LinkIcon linked={radialLinked} dark={dark} />
                    </button>
                  </div>
                  <SliderRow label="Radial Edge Gap" value={radialEdgeGap} min={0} max={50} step={0.1} onChange={handleRadialEdgeGap} unit="mm" dark={dark} />
                  <PitchInfo label="nom. ring spacing" value={ringSpacing} dark={dark} />
                  {!radialLinked && <>
                    <SliderRow label="Circum. Edge Gap" value={circumEdgeGap} min={0} max={50} step={0.1} onChange={handleCircumEdgeGap} unit="mm" dark={dark} />
                    <PitchInfo label="min circum. spacing" value={circumSpacing} dark={dark} />
                  </>}
                  {radialLinked && <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>Circum. Edge Gap: {radialEdgeGap.toFixed(2)} mm (linked)</div>}
                  {radialLayout === "6k Rosette" && <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>Ring k · 6k holes · sixfold symmetry</div>}
                </>
              )}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Fill Mode</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Full", "Circle"].map(m => (
                    <SegBtn key={m} label={m} active={radialMode === m} onClick={() => setRadialMode(m)} />
                  ))}
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: textSecondary, cursor: "pointer", marginTop: 4 }}>
                <input type="checkbox" checked={centerHole} onChange={e => setCenterHole(e.target.checked)} style={{ accentColor }} />
                Center hole
              </label>
            </>
          ) : uniformGapMode ? (
            <>
              <SliderRow label="Edge Gap (all sides)" value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label={isTriTiling ? "column pitch" : "spacing"} value={uniformColPitch} dark={dark} />
              <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>
                Uniform ligament on all {isHexHoneycomb ? 6 : isDiamondLattice ? 4 : 3} edges
                <span style={{ marginLeft: 6, fontSize: 9, color: dark ? "#555" : "#aaa" }}>
                  row pitch {uniformRowPitch.toFixed(2)}
                </span>
              </div>
            </>
          ) : showGapY ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Gap Link (X = Y)</span>
                <button onClick={() => { setGapLinked(v => !v); if (!gapLinked) setEdgeGapY(edgeGapX); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                  title={gapLinked ? "Unlink gap" : "Link gap"}>
                  <LinkIcon linked={gapLinked} dark={dark} />
                </button>
              </div>
              <SliderRow label={gapLinked ? "Edge Gap (X = Y)" : "X Edge Gap"} value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label={gapLinked ? "pitch" : "X pitch"} value={pitchX} dark={dark} />
              {!gapLinked && <>
                <SliderRow label="Y Edge Gap" value={edgeGapY} min={0} max={50} step={0.1} onChange={handleEdgeGapY} unit="mm" dark={dark} />
                <PitchInfo label="Y pitch" value={pitchY} dark={dark} />
              </>}
            </>
          ) : (
            <>
              <SliderRow label="X Edge Gap" value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label="X pitch" value={effPitchX} dark={dark} />
              <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>
                Y Edge Gap: {(effPitchY - effH).toFixed(2)} mm (auto)
                <span style={{ marginLeft: 6, fontSize: 9, color: dark ? "#555" : "#aaa" }}>
                  pitch {effPitchY.toFixed(2)}
                </span>
              </div>
            </>
          )}
          <SliderRow label="Panel Width" value={sheetW} min={10} max={1000} step={1} onChange={setSheetW} unit="mm" dark={dark} />
          <SliderRow label="Panel Height" value={sheetH} min={10} max={1000} step={1} onChange={setSheetH} unit="mm" dark={dark} />
          {/* Margin section */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Margin {marginLinked ? "(Uniform)" : "(Per-side)"}</span>
              <button onClick={() => { setMarginLinked(v => !v); if (!marginLinked) { const m = marginTop; setMarginBottom(m); setMarginLeft(m); setMarginRight(m); } }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                title={marginLinked ? "Set per-side margins" : "Use uniform margin"}>
                <LinkIcon linked={marginLinked} dark={dark} />
              </button>
            </div>
            {marginLinked ? (
              <SliderRow label="Margin" value={marginTop} min={0} max={50} step={0.5} onChange={handleMarginUniform} unit="mm" dark={dark} />
            ) : (
              <>
                <SliderRow label="Margin Top" value={marginTop} min={0} max={50} step={0.5} onChange={setMarginTop} unit="mm" dark={dark} />
                <SliderRow label="Margin Bottom" value={marginBottom} min={0} max={50} step={0.5} onChange={setMarginBottom} unit="mm" dark={dark} />
                <SliderRow label="Margin Left" value={marginLeft} min={0} max={50} step={0.5} onChange={setMarginLeft} unit="mm" dark={dark} />
                <SliderRow label="Margin Right" value={marginRight} min={0} max={50} step={0.5} onChange={setMarginRight} unit="mm" dark={dark} />
              </>
            )}
          </div>
          <SliderRow label="Corner Radius" value={cornerRadius} min={0} max={Math.min(perfW / 2, perfH / 2)} step={0.5} onChange={setCornerRadius} unit="mm" dark={dark} />
        </div>

        {/* Size Variation */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span>Size Variation</span>
            <Toggle value={variation.enabled} onChange={enabled => {
              commitVariation(current => ({ ...current, enabled }));
              if (!enabled) setVariationEditMode(false);
            }} dark={dark} label="Size Variation" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 5, marginBottom: 8 }}>
            <Select value="" placeholder="Load a field preset…" onChange={name => applyVariationPreset(name)} dark={dark}
              options={Object.keys(VARIATION_PRESETS).map(name => ({ value: name, label: name }))} />
            <button onClick={undoVariation} disabled={!canUndoVariation} title="Undo variation" style={{ width: 30, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: canUndoVariation ? textPrimary : textSecondary, cursor: canUndoVariation ? "pointer" : "default", opacity: canUndoVariation ? 1 : 0.45 }}><Undo2 size={13} /></button>
            <button onClick={redoVariation} disabled={!canRedoVariation} title="Redo variation" style={{ width: 30, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: canRedoVariation ? textPrimary : textSecondary, cursor: canRedoVariation ? "pointer" : "default", opacity: canRedoVariation ? 1 : 0.45 }}><Redo2 size={13} /></button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            <button onClick={randomizeVariation} style={{ height: 31, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: textPrimary, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}><Sparkles size={11} /> Randomize</button>
            <button onClick={() => {
              const next = !variationEditMode;
              setVariationEditMode(next);
              if (next) { setHoleRemovalMode(false); if (!variation.enabled) commitVariation(current => ({ ...current, enabled: true })); }
            }} style={{ height: 31, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: `1px solid ${variationEditMode ? accentColor : sidebarBorder}`, borderRadius: 4, background: variationEditMode ? (dark ? "rgba(96,165,250,0.14)" : "rgba(37,99,235,0.08)") : controlBg, color: variationEditMode ? accentColor : textPrimary, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>{variationEditMode ? <><Check size={11} /> Editing Canvas</> : <><SquarePen size={11} /> Edit on Canvas</>}</button>
          </div>

          {variation.enabled && selectedVariationLayer && <>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
              {variation.layers.map((layer, index) => (
                <button key={layer.id} onClick={() => updateVariationLive(current => ({ ...current, selectedLayerId: layer.id }))}
                  style={{ flex: 1, height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, border: `1px solid ${variation.selectedLayerId === layer.id ? accentColor : sidebarBorder}`, borderRadius: 4, background: variation.selectedLayerId === layer.id ? (dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.07)") : "transparent", color: variation.selectedLayerId === layer.id ? accentColor : textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", opacity: layer.enabled ? 1 : 0.45 }}>
                  {layer.locked && <Lock size={8} style={{ flexShrink: 0 }} />} Layer {index + 1}
                </button>
              ))}
              <button onClick={addVariationLayer} disabled={variation.layers.length >= 3} title="Add layer" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: textPrimary, cursor: variation.layers.length >= 3 ? "default" : "pointer", opacity: variation.layers.length >= 3 ? 0.4 : 1 }}><Plus size={13} /></button>
              {variation.layers.length > 1 && <button onClick={removeSelectedVariationLayer} title="Remove selected layer" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: warnColor, cursor: "pointer" }}><X size={13} /></button>}
            </div>

            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, color: textSecondary, marginBottom: 6 }}>Field Space</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 13 }}>
              {FIELD_SPACES.map(space => <button key={space} onClick={() => updateSelectedVariationLayer({ space }, true)} style={{ padding: "6px 2px", border: `1px solid ${selectedVariationLayer.space === space ? accentColor : sidebarBorder}`, borderRadius: 4, background: selectedVariationLayer.space === space ? (dark ? "rgba(96,165,250,0.13)" : "rgba(37,99,235,0.07)") : "transparent", color: selectedVariationLayer.space === space ? accentColor : textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>{space}</button>)}
            </div>

            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, color: textSecondary, marginBottom: 6 }}>Size Profile</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 13 }}>
              {SIZE_PROFILES.map(profile => {
                const active = selectedVariationLayer.profile === profile;
                return <button key={profile} onClick={() => updateSelectedVariationLayer({ profile }, true)} style={{ height: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, border: `1px solid ${active ? accentColor : sidebarBorder}`, borderRadius: 5, background: active ? (dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.06)") : "transparent", color: active ? accentColor : textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}><ProfileIcon type={profile} active={active} dark={dark} />{profile}</button>;
              })}
            </div>

            {/* Geometry, position and curve live on the canvas handles. Only count-style knobs stay here. */}
            {selectedVariationLayer.space === "Spiral" && <SliderRow label="Spiral Turns" value={selectedVariationLayer.turns} min={0.25} max={8} step={0.05} onChange={turns => updateSelectedVariationLayer({ turns })} dark={dark} />}
            {["Wave", "Noise"].includes(selectedVariationLayer.profile) && <SliderRow label={selectedVariationLayer.profile === "Wave" ? "Frequency" : "Noise Scale"} value={selectedVariationLayer.frequency} min={0.25} max={10} step={0.05} onChange={frequency => updateSelectedVariationLayer({ frequency })} dark={dark} />}
            {selectedVariationLayer.profile === "Noise" && <SliderRow label="Noise Detail" value={selectedVariationLayer.detail} min={1} max={6} step={1} onChange={detail => updateSelectedVariationLayer({ detail })} dark={dark} />}
            {selectedVariationLayer.profile === "Steps" && <SliderRow label="Step Count" value={selectedVariationLayer.steps} min={2} max={16} step={1} onChange={steps => updateSelectedVariationLayer({ steps })} dark={dark} />}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {/* Whole-percent steps: round on both display and commit so slider drags never surface float artifacts */}
              <SliderRow label="Min Scale" value={Math.round(variation.minScale * 100)} min={1} max={200} step={1} onChange={value => updateVariationLive(current => ({ ...current, minScale: Math.min(Math.round(value) / 100, current.maxScale) }))} unit="%" dark={dark} />
              <SliderRow label="Max Scale" value={Math.round(variation.maxScale * 100)} min={5} max={250} step={1} onChange={value => updateVariationLive(current => ({ ...current, maxScale: Math.max(Math.round(value) / 100, current.minScale) }))} unit="%" dark={dark} />
            </div>
            <div style={{ marginTop: -5, marginBottom: 10, padding: "6px 8px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.06)" : "rgba(37,99,235,0.04)", fontSize: 9, color: textSecondary, display: "flex", justifyContent: "space-between" }}>
              <span>Actual extent</span><span style={{ color: accentColor }}>{(Math.min(effW, effH) * variation.minScale).toFixed(2)}–{(Math.max(effW, effH) * variation.maxScale).toFixed(2)} mm</span>
            </div>

            <SliderRow label="Remove Below ⌀" value={variation.cullBelow} min={0} max={Math.max(1, +Math.max(effW, effH).toFixed(1))} step={0.05} onChange={value => updateVariationLive(current => ({ ...current, cullBelow: value }))} unit={variation.cullBelow > 0 ? "mm" : "off"} dark={dark} />
            {culledHoleCount > 0 && <div style={{ marginTop: -5, marginBottom: 10, fontSize: 9, color: textSecondary, display: "flex", justifyContent: "space-between" }}>
              <span>Holes removed by size floor</span><span style={{ color: warnColor }}>{culledHoleCount.toLocaleString()}</span>
            </div>}

            <button onClick={() => setVariationAdvanced(value => !value)} style={{ width: "100%", height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", borderTop: `1px solid ${sectionBorder}`, background: "transparent", color: textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}><span>ADVANCED MODIFIERS</span><ChevronDown size={12} style={{ transform: variationAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /></button>
            {variationAdvanced && <div style={{ paddingTop: 9 }}>
              <div style={{ fontSize: 9, color: textSecondary, marginBottom: 11, lineHeight: 1.5 }}>Direction, origin, reach, position &amp; curve live on the canvas handles. These are the extra modifiers.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[['Mirror', selectedVariationLayer.mirror, 'mirror'], ['Invert', selectedVariationLayer.invert, 'invert'], ['Layer Enabled', selectedVariationLayer.enabled, 'enabled'], ['Lock Randomize', selectedVariationLayer.locked, 'locked']].map(([label, value, key]) => <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: textSecondary }}>{label}<Toggle value={value} onChange={next => updateSelectedVariationLayer({ [key]: next }, true)} dark={dark} /></label>)}
              </div>
              <SliderRow label="Jitter" value={selectedVariationLayer.jitter} min={0} max={0.5} step={0.01} onChange={jitter => updateSelectedVariationLayer({ jitter })} dark={dark} />
              <SliderRow label="Quantize Sizes" value={variation.quantize} min={0} max={12} step={1} onChange={quantize => updateVariationLive(current => ({ ...current, quantize }))} unit={variation.quantize >= 2 ? "levels" : "off"} dark={dark} />
              <SliderRow label="Layer Opacity" value={selectedVariationLayer.opacity * 100} min={0} max={100} step={1} onChange={opacity => updateSelectedVariationLayer({ opacity: opacity / 100 })} unit="%" dark={dark} />
              {variation.layers.length > 1 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: textSecondary, marginBottom: 5 }}>Blend Mode</div><Select value={selectedVariationLayer.blendMode} onChange={mode => updateSelectedVariationLayer({ blendMode: mode }, true)} dark={dark} options={BLEND_MODES.map(mode => ({ value: mode, label: mode }))} /></div>}
              {selectedVariationLayer.profile === "Noise" && <SliderRow label="Noise Seed" value={selectedVariationLayer.seed} min={0} max={99999} step={1} onChange={seed => updateSelectedVariationLayer({ seed })} dark={dark} />}
            </div>}
            {variationEditMode && <div style={{ padding: "7px 9px", borderRadius: 5, border: `1px solid ${dark ? "rgba(96,165,250,0.18)" : "rgba(37,99,235,0.14)"}`, background: dark ? "rgba(96,165,250,0.06)" : "rgba(37,99,235,0.04)", color: textSecondary, fontSize: 9, lineHeight: 1.6 }}>
              <div><span style={{ color: accentColor }}>●</span> center — drag to move the origin (gradient start).</div>
              <div><span style={{ color: accentColor }}>◯</span> reach — drag the end point to aim direction &amp; spread.</div>
              <div><span style={{ color: accentColor }}>◆</span> stop — slide along the line to set {gizmoUsesPosition(selectedVariationLayer) ? 'position' : 'phase'}.</div>
              <div><span style={{ color: dark ? "#fbbf24" : "#d97706" }}>⟳</span> curve — turn the dial to shape the falloff.</div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>Center snaps to the panel centre, edges &amp; corners; spread &amp; position to 0/25/50/75/100%; angles to 45°. Hold Shift to lock to a snap; otherwise it gently pulls in near one.</div>
              <div style={{ opacity: 0.8, marginTop: 2 }}>Drag empty space (or hold Space) to pan.</div>
            </div>}
          </>}
        </div>

        {/* Taper */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showTaper ? undefined : 0 }}>
            <span>Sheet Thickness & Hole Taper</span>
            <Toggle value={showTaper} onChange={setShowTaper} dark={dark} label="Sheet Thickness & Hole Taper" />
          </div>
          {showTaper && (
          <>
          <SliderRow label="Thickness (t)" value={thickness} min={0} max={10} step={0.1} onChange={setThickness} unit="mm" dark={dark} />
          <SliderRow label="Taper Angle (θ)" value={taperAngle} min={0} max={15} step={0.1} onChange={setTaperAngle} unit="°" dark={dark} />
          {taperActive && (
            <>
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Taper Direction</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["Top larger", "Bottom larger"].map(dir => <SegBtn key={dir} label={dir} active={taperDirection === dir} onClick={() => setTaperDirection(dir)} />)}
                </div>
              </div>
              <div style={{ marginTop: 8, padding: "5px 8px", borderRadius: 4, background: hasClosedHoles ? (dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)") : (dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: textSecondary }}>{variation.enabled ? "Exit Range" : "Exit Diameter"}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: hasClosedHoles ? warnColor : accentColor }}>{holeClosed ? "0 (all closed)" : variation.enabled ? `${minExit.toFixed(2)}–${maxExit.toFixed(2)} mm` : `${dExit.toFixed(2)} mm`}</span>
              </div>
            </>
          )}
          {!taperActive && <div style={{ fontSize: 9, color: dark ? "#444" : "#bbb", marginTop: 6, lineHeight: 1.4 }}>Set thickness and angle above 0 to enable taper compensation.</div>}
          </>
          )}
        </div>

        {/* Hole Removal */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Hole Removal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Click to Remove</span>
              <Toggle value={holeRemovalMode} onChange={setHoleRemovalMode} dark={dark} label="Click to Remove" />
            </label>
            {holeRemovalMode && <div style={{ fontSize: 9, color: dark ? "#888" : "#888", lineHeight: 1.4 }}>Click holes on the canvas to remove/restore them. OAR recalculates automatically.</div>}
            {removedHoles.size > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: dark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)" }}>
                  <span style={{ fontSize: 10, color: textSecondary }}>Removed</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: warnColor }}>{removedHoles.size} holes</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.05)" }}>
                  <span style={{ fontSize: 10, color: textSecondary }}>Active</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>{activeHoleCount} holes</span>
                </div>
                <button onClick={() => setRemovedHoles(new Set())}
                  style={{ padding: "5px 0", fontSize: 10, fontWeight: 500, background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", color: warnColor, border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`, borderRadius: 4, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
                  Restore All Holes
                </button>
              </>
            )}
          </div>
        </div>


        {/* Colors */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Colors</div>
          <div style={{ display: "flex", gap: 16 }}>
            <ColorField label="Hole Color" value={holeColor} onChange={setHoleColor} dark={dark} />
            <ColorField label="Background" value={bgColor} onChange={setBgColor} dark={dark} />
          </div>
        </div>

        {/* Export */}
        <div style={{ ...sectionStyle, marginBottom: 0 }}>
          <div style={sectionTitle}>Export</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["SVG", exportSVG], ["PNG 2x", exportPNG]].map(([label, fn]) => (
              <button key={label} onClick={fn} style={{
                flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 500,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: btnBg, color: textPrimary, border: "none", borderRadius: 5,
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace"
              }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? "#333338" : "#d4d4da"}
                onMouseLeave={e => e.currentTarget.style.background = btnBg}>
                <Download size={11} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${accentColor}; cursor: pointer; border: 2px solid ${dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${accentColor}; cursor: pointer; border: 2px solid ${dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        button { transition: background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.1s; }
        button:active { transform: scale(0.96); }
        .pg-menu-item:hover { background: ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} !important; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${dark ? "#333" : "#ccc"}; border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
