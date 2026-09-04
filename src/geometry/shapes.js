// Hole shape registry. Every shape implements the same five operations so the
// generator, stats, canvas and exporters never branch on the shape name:
//
//   area(w, h, holeRadius)                 exact area (drives OAR)
//   trace(ctx, cx, cy, w, h, holeRadius)   canvas Path2D drawing, centred at (cx, cy)
//   svg(x, y, w, h, holeRadius)            SVG element body (without fill/attrs)
//   contains(x, y, w, h, holeRadius)       hit test in the hole's local, un-rotated frame
//   gap(h1, h2)                            signed clearance between two holes (< 0 overlaps)
//
// w = horizontal extent, h = vertical extent, both in mm. Rotation is a per-hole
// `angle` (radians) applied by the callers below, so shape code stays canonical.
import {
  basePolyVerts, convexPolyGap, holePolyVerts, isInsideRoundedPoly, roundedPolyArea,
  roundedPolySVGPath, segmentGap, tracePolyPath, unitToward,
} from "./polygon.js";
import { hexEdgeReach, hexVertices } from "./hexagon.js";
import { isInsideRoundedRect } from "./rounded-rect.js";

const f3 = n => n.toFixed(3);

// ─── Rectangle ────────────────────────────────────────────────────────
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

const Rectangle = {
  area(w, h, holeRadius) {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    return r > 0 ? w * h - 4 * r * r + Math.PI * r * r : w * h;
  },
  trace(ctx, cx, cy, w, h, holeRadius) {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    if (r > 0) ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
    else ctx.rect(cx - w / 2, cy - h / 2, w, h);
  },
  svg(x, y, w, h, holeRadius) {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    const rxAttr = r > 0 ? ` rx="${f3(r)}" ry="${f3(r)}"` : "";
    return `<rect x="${f3(x - w / 2)}" y="${f3(y - h / 2)}" width="${f3(w)}" height="${f3(h)}"${rxAttr}`;
  },
  contains(x, y, w, h, holeRadius) {
    return isInsideRoundedRect(x, y, -w / 2, -h / 2, w / 2, h / 2, holeRadius);
  },
  gap: roundedRectGap,
  rotates: true,
};

// ─── Pill (stadium) ───────────────────────────────────────────────────
function pillAxis(hole) {
  const w = hole.w, h = hole.h;
  const horizontal = w >= h;
  const radius = Math.min(w, h) / 2;
  const halfSegment = Math.max(w, h) / 2 - radius;
  const angle = (hole.angle || 0) + (horizontal ? 0 : Math.PI / 2);
  const dx = Math.cos(angle) * halfSegment, dy = Math.sin(angle) * halfSegment;
  return { a: [hole.x - dx, hole.y - dy], b: [hole.x + dx, hole.y + dy], radius };
}

const Pill = {
  area(w, h) {
    const s = Math.min(w, h), l = Math.max(w, h);
    const r = s / 2;
    return Math.PI * r * r + s * (l - s);
  },
  trace(ctx, cx, cy, w, h) {
    const hw = w / 2, hh = h / 2;
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
  },
  svg(x, y, w, h) {
    const hw = w / 2, hh = h / 2;
    if (w >= h) {
      const s = hw - hh, r = hh;
      return `<path d="M ${f3(x - s)} ${f3(y - r)} L ${f3(x + s)} ${f3(y - r)} A ${f3(r)} ${f3(r)} 0 0 1 ${f3(x + s)} ${f3(y + r)} L ${f3(x - s)} ${f3(y + r)} A ${f3(r)} ${f3(r)} 0 0 1 ${f3(x - s)} ${f3(y - r)} Z"`;
    }
    const s = hh - hw, r = hw;
    return `<path d="M ${f3(x + r)} ${f3(y - s)} L ${f3(x + r)} ${f3(y + s)} A ${f3(r)} ${f3(r)} 0 0 1 ${f3(x - r)} ${f3(y + s)} L ${f3(x - r)} ${f3(y - s)} A ${f3(r)} ${f3(r)} 0 0 1 ${f3(x + r)} ${f3(y - s)} Z"`;
  },
  contains(x, y, w, h) {
    if (w >= h) {
      const segment = (w - h) / 2;
      const sx = Math.max(Math.abs(x) - segment, 0);
      return sx * sx + y * y <= (h / 2) ** 2;
    }
    const segment = (h - w) / 2;
    const sy = Math.max(Math.abs(y) - segment, 0);
    return x * x + sy * sy <= (w / 2) ** 2;
  },
  gap(h1, h2) {
    const p1 = pillAxis(h1), p2 = pillAxis(h2);
    return segmentGap(p1.a, p1.b, p2.a, p2.b) - p1.radius - p2.radius;
  },
  rotates: true,
};

// ─── Hexagon (pointy-top, w = corner-to-corner) ───────────────────────
const Hexagon = {
  area(w, h, holeRadius) {
    const R = w / 2;
    const sharp = (3 * Math.sqrt(3) / 2) * R * R;
    const cr = Math.min(holeRadius || 0, R * Math.sqrt(3) / 2);
    // Rounding each of the 6 corners removes (2√3 − π)·r² of area total.
    return cr > 0 ? sharp - (2 * Math.sqrt(3) - Math.PI) * cr * cr : sharp;
  },
  trace(ctx, cx, cy, w, h, holeRadius) {
    const R = w / 2;
    const pts = hexVertices(cx, cy, R);
    const cr = Math.min(holeRadius || 0, R * Math.sqrt(3) / 2);
    if (cr > 0) {
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
  },
  svg(x, y, w, h, holeRadius) {
    const R = w / 2;
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
      let d = `M ${f3(tin[0][0])} ${f3(tin[0][1])}`;
      for (let i = 0; i < 6; i++) {
        d += ` A ${f3(cr)} ${f3(cr)} 0 0 1 ${f3(tout[i][0])} ${f3(tout[i][1])}`;
        const ni = tin[(i + 1) % 6];
        d += ` L ${f3(ni[0])} ${f3(ni[1])}`;
      }
      return `<path d="${d} Z"`;
    }
    const pts = verts.map(v => `${f3(v[0])},${f3(v[1])}`).join(" ");
    return `<polygon points="${pts}"`;
  },
  contains(x, y, w, h, holeRadius) {
    const R = w / 2; // pointy-top: vertical corner-to-corner = 2R, flats on left/right
    const apothem = Math.sqrt(3) * R / 2;
    const cr = Math.min(holeRadius || 0, apothem);
    if (cr <= 0) {
      return Math.abs(y) <= R && Math.abs(x) <= apothem && Math.sqrt(3) * Math.abs(y) + Math.abs(x) <= Math.sqrt(3) * R;
    }
    // Rounded hexagon = inner hexagon (shrunk inward by cr) grown by a disk of radius cr.
    const ai = apothem - cr;
    const Ri = ai * 2 / Math.sqrt(3);
    let inside = true;
    for (let k = 0; k < 6; k++) {
      const ang = k * Math.PI / 3;
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
  },
  gap(h1, h2) {
    // Edge-aware: use each hexagon's reach toward the other instead of the circumradius,
    // otherwise tightly-spaced honeycombs read as overlapping when they only share edges.
    const r1 = Math.max(h1.w, h1.h) / 2, r2 = Math.max(h2.w, h2.h) / 2;
    const dx = h2.x - h1.x, dy = h2.y - h1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-9) return -(r1 + r2);
    const dir = Math.atan2(dy, dx);
    return dist
      - hexEdgeReach(r1, dir - (h1.angle || 0))
      - hexEdgeReach(r2, dir + Math.PI - (h2.angle || 0));
  },
  rotates: true,
};

// ─── Diamond & Triangle (convex polygons) ─────────────────────────────
const polyShape = name => ({
  area(w, h, holeRadius) {
    return roundedPolyArea(basePolyVerts(name, w, h), holeRadius);
  },
  trace(ctx, cx, cy, w, h, holeRadius) {
    tracePolyPath(ctx, cx, cy, basePolyVerts(name, w, h), holeRadius);
  },
  svg(x, y, w, h, holeRadius) {
    return `<path d="${roundedPolySVGPath(x, y, basePolyVerts(name, w, h), holeRadius)}"`;
  },
  contains(x, y, w, h, holeRadius) {
    return isInsideRoundedPoly(x, y, basePolyVerts(name, w, h), holeRadius);
  },
  gap(h1, h2) {
    return convexPolyGap(
      holePolyVerts(name, h1.x, h1.y, h1.w, h1.h, h1.angle),
      holePolyVerts(name, h2.x, h2.y, h2.w, h2.h, h2.angle)
    );
  },
  rotates: true,
  polygon: true,
});

// ─── Circle ───────────────────────────────────────────────────────────
const Circle = {
  area(w) { return Math.PI * (w / 2) ** 2; },
  trace(ctx, cx, cy, w) { ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); },
  svg(x, y, w) { return `<circle cx="${f3(x)}" cy="${f3(y)}" r="${f3(w / 2)}"`; },
  contains(x, y, w, h) { return (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2 <= 1; },
  gap(h1, h2) {
    const r1 = Math.max(h1.w, h1.h) / 2, r2 = Math.max(h2.w, h2.h) / 2;
    return Math.hypot(h2.x - h1.x, h2.y - h1.y) - r1 - r2;
  },
  rotates: false,
};

export const SHAPES = {
  Circle,
  Rectangle,
  Pill,
  Hexagon,
  Diamond: polyShape("Diamond"),
  Triangle: polyShape("Triangle"),
};

export const getShape = name => SHAPES[name] || SHAPES.Circle;

// ─── Shape-agnostic entry points (the API the rest of the app uses) ───
export function calcHoleArea(shape, w, h, holeRadius) {
  return getShape(shape).area(w, h, holeRadius);
}

// Trace a hole into the current canvas path, honouring its rotation.
export function traceHolePath(ctx, x, y, shape, w, h, angle, holeRadius) {
  const def = getShape(shape);
  const needsRotation = angle && def.rotates;
  if (needsRotation) {
    ctx.translate(x, y);
    ctx.rotate(angle);
  }
  def.trace(ctx, needsRotation ? 0 : x, needsRotation ? 0 : y, w, h, holeRadius);
  if (needsRotation) {
    ctx.rotate(-angle);
    ctx.translate(-x, -y);
  }
}

// Full SVG element string (with trailing newline) for one hole.
export function holeSVGElement(x, y, shape, w, h, fill, extra, angle, holeRadius) {
  const def = getShape(shape);
  const attrs = extra || "";
  const rotAttr = angle && def.rotates
    ? ` transform="rotate(${(angle * 180 / Math.PI).toFixed(2)} ${f3(x)} ${f3(y)})"`
    : "";
  return `    ${def.svg(x, y, w, h, holeRadius)} ${fill} ${attrs}${rotAttr}/>\n`;
}

// Hit test against a hole's entry (default) or exit profile, in sheet space.
export function isPointInsideHole(px, py, hole, shape, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const radius = useExit ? hole.exitHoleRadius : hole.holeRadius;
  if (w <= 0 || h <= 0) return false;
  const angle = hole.angle || 0;
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const dx = px - hole.x, dy = py - hole.y;
  const x = dx * cos - dy * sin, y = dx * sin + dy * cos;
  return getShape(shape).contains(x, y, w, h, radius);
}

// Signed clearance between two holes of the same shape (< 0 when they overlap).
export function calcShapeGap(h1, h2, shape) {
  return getShape(shape).gap(h1, h2);
}

export function checkShapeOverlap(h1, h2, shape) {
  return calcShapeGap(h1, h2, shape) < -0.001;
}
