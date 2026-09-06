// For n >= 1, consecutive golden-angle Fermat points have a normalized
// nearest-neighbour distance slightly above 1.6. Using the lower bound keeps
// the requested edge gap intact after the spiral is scaled to the hole size.
// The top-level Fibonacci mode scales its own point set by the same fact, so the
// constant lives there and both read the one copy.
import { FERMAT_SAFE_SEPARATION } from "./fibonacci.js";
import { convexPolyGap } from "../geometry/polygon.js";

const TAU = Math.PI * 2;
const EPS = 1e-9;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function diamondFlatAngle(w, h) {
  return -Math.atan2(h, w);
}

function triInradius(w, h) {
  const slant = Math.hypot(w / 2, h);
  return (w * h) / 2 / (w / 2 + slant);
}

function shapeVertices(shape, w, h) {
  if (shape === "Hexagon") {
    const R = w / 2;
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (i * Math.PI) / 3 + Math.PI / 6;
      return [R * Math.cos(angle), R * Math.sin(angle)];
    });
  }
  if (shape === "Diamond")
    return [
      [0, -h / 2],
      [w / 2, 0],
      [0, h / 2],
      [-w / 2, 0],
    ];
  if (shape === "Triangle") {
    const r = triInradius(w, h);
    return [
      [0, -(h - r)],
      [w / 2, r],
      [-w / 2, r],
    ];
  }
  return null;
}

function projectedVertexExtent(vertices, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  let lo = Infinity,
    hi = -Infinity;
  for (const [x, y] of vertices) {
    const projection = x * c + y * s;
    lo = Math.min(lo, projection);
    hi = Math.max(hi, projection);
  }
  return hi - lo;
}

export function getRadialShapeExtents(shape, w, h, diamondOrient = "Point up") {
  if (shape === "Triangle") return { radial: h, tangential: w };
  if (shape === "Hexagon") return { radial: (w * Math.sqrt(3)) / 2, tangential: w };
  if (shape === "Diamond") {
    const offset = diamondOrient === "Flat up" ? diamondFlatAngle(w, h) : 0;
    const vertices = shapeVertices(shape, w, h);
    return {
      radial: projectedVertexExtent(vertices, -offset),
      tangential: projectedVertexExtent(vertices, Math.PI / 2 - offset),
    };
  }
  // Superellipse joins the axis-aligned family: the hole is turned so its own
  // x axis points outward, so w is the radial extent and h the tangential one.
  if (shape === "Rectangle" || shape === "Pill" || shape === "Superellipse") return { radial: w, tangential: h };
  return { radial: w, tangential: w };
}

export function getRadialShapeOuterRadius(shape, w, h) {
  if (shape === "Circle") return w / 2;
  // Bounding-box corner: exact at n → ∞ and conservative below it, which is the
  // safe direction — it only ever spaces the rings further apart.
  if (shape === "Rectangle" || shape === "Superellipse") return Math.hypot(w, h) / 2;
  if (shape === "Pill") return Math.max(w, h) / 2;
  const vertices = shapeVertices(shape, w, h);
  // A shape this file does not know (a preset or custom outline) is read as
  // its box, which only ever spaces the rings further apart.
  if (!vertices) return Math.hypot(w, h) / 2;
  return Math.max(...vertices.map(([x, y]) => Math.hypot(x, y)));
}

function actualHoleAngle(shape, polarAngle, index, w, h, diamondOrient) {
  if (shape === "Triangle") return polarAngle + Math.PI / 2 + (index % 2) * Math.PI;
  if (shape === "Diamond" && diamondOrient === "Flat up") {
    return polarAngle + diamondFlatAngle(w, h);
  }
  return polarAngle;
}

function shapeSupport(shape, w, h, orientation, direction) {
  const local = direction - orientation;
  const c = Math.cos(local),
    s = Math.sin(local);
  if (shape === "Circle") return w / 2;
  if (shape === "Rectangle" || shape === "Superellipse") return (Math.abs(c) * w) / 2 + (Math.abs(s) * h) / 2;
  if (shape === "Pill") {
    if (w >= h) return (Math.abs(c) * (w - h)) / 2 + h / 2;
    return (Math.abs(s) * (h - w)) / 2 + w / 2;
  }
  const vertices = shapeVertices(shape, w, h);
  // A per-hole outline or anything unknown: the box it fits in, which only ever
  // measures the hole wide and so leaves more metal, never less.
  if (!vertices) return (Math.abs(c) * w) / 2 + (Math.abs(s) * h) / 2;
  let support = -Infinity;
  for (const [x, y] of vertices) support = Math.max(support, x * c + y * s);
  return support;
}

// The width of a hole measured along `direction` — its shadow when lit from the
// side — for a hole turned by `orientation`. Superellipses read as their box,
// the same conservative reading the radial modes make of them.
export function shapeExtent(shape, w, h, orientation, direction) {
  return (
    shapeSupport(shape, w, h, orientation, direction) + shapeSupport(shape, w, h, orientation, direction + Math.PI)
  );
}

// The centre distance, along `direction`, at which two holes of this shape are
// exactly `gap` apart — what a layout that places neighbours along a direction
// other than the hole's own axes needs to leave the edge gap it was asked for.
//
// This is not the extent above plus the gap, except for a circle or a
// direction along the hole's own axis: two 20 × 2 mm slots at 45° pass each
// other after a horizontal shift of well under their 15.6 mm horizontal
// extent, and spacing them by the extent leaves metal nobody asked for. What
// is wanted is the shift at which the hole's clearance from its own translate
// first reaches the gap. That clearance is the distance from the shift to the
// hole's difference body (a convex set containing the origin), which never
// decreases along a ray out of the origin — so the shift can be bisected on.
// Circle and pill have closed forms; the polygonal shapes (superellipse as its
// box, which only ever leaves more metal) use the exact convex-polygon
// clearance. Bounded above by extent + gap, which is always enough.
export function shapeReach(shape, w, h, orientation, direction, gap) {
  const g = Math.max(0, gap);
  if (shape === "Circle") return w + g;
  const local = direction - orientation;
  const c = Math.cos(local),
    s = Math.sin(local);
  if (shape === "Pill") {
    // A stadium of radius r about a straight run of half-length a; its
    // difference body grown by the gap is the stadium of half-length 2a and
    // radius 2r + gap, and the ray out of the centre leaves it either through
    // the straight side or round one of the end caps.
    const r = Math.min(w, h) / 2,
      a = Math.max(w, h) / 2 - r,
      R = 2 * r + g;
    const along = Math.abs(w >= h ? c : s),
      across = Math.abs(w >= h ? s : c);
    if (across > 0 && (R / across) * along <= 2 * a) return R / across;
    return 2 * a * along + Math.sqrt(Math.max(0, R * R - 4 * a * a * across * across));
  }
  const vertices = shapeVertices(shape, w, h) ?? [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  const shifted = t => vertices.map(([x, y]) => [x + t * c, y + t * s]);
  let lo = 0,
    hi = shapeExtent(shape, w, h, orientation, direction) + g;
  for (let i = 0; i < 64 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (convexPolyGap(vertices, shifted(mid)) >= g) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function projectedShapeGap(a, b, config) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  if (distance < EPS) return -Infinity;
  const direction = Math.atan2(dy, dx);
  const { shape, w, h, diamondOrient = "Point up" } = config;
  const angleA = Number.isFinite(a.angle)
    ? a.angle
    : actualHoleAngle(shape, a.polarAngle || 0, a.index || 0, w, h, diamondOrient);
  const angleB = Number.isFinite(b.angle)
    ? b.angle
    : actualHoleAngle(shape, b.polarAngle || 0, b.index || 0, w, h, diamondOrient);
  return (
    distance - shapeSupport(shape, w, h, angleA, direction) - shapeSupport(shape, w, h, angleB, direction + Math.PI)
  );
}

function ringHole(radius, count, phase, index, cx, cy, config) {
  const polarAngle = phase + (TAU * index) / count;
  return {
    x: cx + radius * Math.cos(polarAngle),
    y: cy + radius * Math.sin(polarAngle),
    polarAngle,
    index,
    angle: actualHoleAngle(config.shape, polarAngle, index, config.w, config.h, config.diamondOrient),
  };
}

function minimumCircumferentialGap(radius, count, config) {
  if (count <= 1) return Infinity;
  let minimum = Infinity;
  for (let i = 0; i < count; i++) {
    const a = ringHole(radius, count, 0, i, 0, 0, config);
    const b = ringHole(radius, count, 0, (i + 1) % count, 0, 0, config);
    minimum = Math.min(minimum, projectedShapeGap(a, b, config));
  }
  return minimum;
}

function closestPreviousIndices(angle, previous) {
  if (previous.count === 1) return [0];
  const step = TAU / previous.count;
  const nearest = Math.round((angle - previous.phase) / step);
  return [-2, -1, 0, 1, 2].map(offset => (((nearest + offset) % previous.count) + previous.count) % previous.count);
}

function minimumInterRingGap(radius, count, phase, previous, cx, cy, config) {
  if (!previous) return Infinity;
  let minimum = Infinity;
  for (let i = 0; i < count; i++) {
    const current = ringHole(radius, count, phase, i, cx, cy, config);
    for (const j of closestPreviousIndices(current.polarAngle, previous)) {
      const prior = ringHole(previous.radius, previous.count, previous.phase, j, cx, cy, config);
      if (previous.radius === 0 && Number.isFinite(previous.centerAngle)) prior.angle = previous.centerAngle;
      minimum = Math.min(minimum, projectedShapeGap(prior, current, config));
    }
  }
  return minimum;
}

function optimizedPhase(radius, count, previous, cx, cy, config) {
  if (!previous) return { phase: 0, gap: Infinity };
  const period = TAU / count;
  const samples = 48;
  let bestPhase = 0,
    bestGap = -Infinity;
  for (let i = 0; i < samples; i++) {
    const phase = (period * i) / samples;
    const gap = minimumInterRingGap(radius, count, phase, previous, cx, cy, config);
    if (gap > bestGap + EPS) {
      bestGap = gap;
      bestPhase = phase;
    }
  }
  return { phase: bestPhase, gap: bestGap };
}

function isInsideRoundedRect(x, y, bounds, cornerRadius) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (cornerRadius <= 0) return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
  const radius = Math.min(cornerRadius, (xMax - xMin) / 2, (yMax - yMin) / 2);
  const qx = Math.max(xMin + radius, Math.min(xMax - radius, x));
  const qy = Math.max(yMin + radius, Math.min(yMax - radius, y));
  return Math.hypot(x - qx, y - qy) <= radius + EPS;
}

export function generateRadialHoles(options) {
  const {
    shape,
    w,
    h,
    bounds,
    radialGap,
    circumGap,
    fillMode = "Full",
    centerHole = false,
    cornerRadius = 0,
    diamondOrient = "Point up",
    layout = "Concentric",
    ringSpacing: legacyRingSpacing,
    circumSpacing: legacyCircumSpacing,
    center,
    region = null,
  } = options;
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin)) return [];

  const cx = center?.x ?? (xMin + xMax) / 2;
  const cy = center?.y ?? (yMin + yMax) / 2;
  const perfW = xMax - xMin,
    perfH = yMax - yMin;
  const extents = getRadialShapeExtents(shape, w, h, diamondOrient);
  const ringSpacing = Math.max(
    EPS,
    layout === "Concentric" && legacyRingSpacing > 0 ? legacyRingSpacing : extents.radial + Math.max(0, radialGap)
  );
  const circumSpacing = Math.max(
    EPS,
    layout === "Concentric" && legacyCircumSpacing > 0
      ? legacyCircumSpacing
      : extents.tangential + Math.max(0, circumGap)
  );
  const circleRadius = Math.min(perfW, perfH) / 2;
  const boundaryPad = Math.max(w, h) / 2;
  const maxRadius = fillMode === "Circle" ? circleRadius : Math.hypot(perfW / 2, perfH / 2) + boundaryPad;
  const config = { shape, w, h, diamondOrient };
  const holes = [];

  const appendIfInside = hole => {
    let inside;
    if (region) {
      // A region that is not the plain rectangle answers for itself, the
      // circle fill included: it was compiled with that mode.
      inside = region.contains(hole.x, hole.y);
    } else if (fillMode === "Circle") {
      inside = Math.hypot(hole.x - cx, hole.y - cy) <= circleRadius + EPS;
    } else if (cornerRadius > 0) {
      inside = isInsideRoundedRect(hole.x, hole.y, bounds, cornerRadius);
    } else {
      inside =
        hole.x >= xMin - boundaryPad &&
        hole.x <= xMax + boundaryPad &&
        hole.y >= yMin - boundaryPad &&
        hole.y <= yMax + boundaryPad;
    }
    if (inside) holes.push({ x: hole.x, y: hole.y, angle: hole.angle });
    return inside;
  };

  let previous = null;
  if (centerHole) {
    const centerAngle = shape === "Diamond" && diamondOrient === "Flat up" ? diamondFlatAngle(w, h) : 0;
    if (appendIfInside({ x: cx, y: cy, angle: centerAngle })) {
      previous = { radius: 0, count: 1, phase: 0, centerAngle };
    }
  }

  if (layout === "Concentric") {
    // Preserve the original Radial layout: ring populations use the simple
    // circumference approximation and every ring starts on the positive x
    // axis. This intentionally keeps the visual rhythm of the pre-engine
    // implementation instead of optimizing phases and projected gaps.
    const legacyMaxRadius = fillMode === "Circle" ? circleRadius : Math.hypot(perfW, perfH) / 2 + ringSpacing;
    const ringCount = Math.max(0, Math.floor(legacyMaxRadius / ringSpacing));
    for (let ring = 1; ring <= ringCount; ring++) {
      const radius = ring * ringSpacing;
      const count = Math.max(1, Math.floor((TAU * radius) / circumSpacing));
      for (let i = 0; i < count; i++) {
        const hole = ringHole(radius, count, 0, i, cx, cy, config);
        // Hexagon rotation was ignored by the original renderer.
        if (shape === "Hexagon") hole.angle = 0;
        appendIfInside(hole);
      }
    }
    return holes;
  }

  if (layout === "Sunflower") {
    const outerRadius = getRadialShapeOuterRadius(shape, w, h);
    const requestedGap = Math.max(0, radialGap, circumGap);
    const minimumCenterDistance = outerRadius * 2 + requestedGap;
    // A centre hole makes n=0 -> n=1 the limiting pair. Without it, the
    // tighter n=1 -> n=4 Fermat pair determines the scale.
    const spiralScale = minimumCenterDistance / (previous ? 1 : FERMAT_SAFE_SEPARATION);
    for (let n = 1; ; n++) {
      const radius = spiralScale * Math.sqrt(n);
      if (radius > maxRadius + EPS) break;
      const polarAngle = n * GOLDEN_ANGLE - Math.PI / 2;
      const hole = {
        x: cx + radius * Math.cos(polarAngle),
        y: cy + radius * Math.sin(polarAngle),
        angle: actualHoleAngle(shape, polarAngle, n, w, h, diamondOrient),
      };
      appendIfInside(hole);
    }
    return holes;
  }

  if (layout === "6k Rosette") {
    for (let k = 1; ; k++) {
      const count = 6 * k;
      let adjustedRadius = Math.max(k * ringSpacing, previous ? previous.radius + ringSpacing : ringSpacing);
      if (adjustedRadius > maxRadius + EPS) break;

      const chordSlope = 2 * Math.sin(Math.PI / count);
      for (let attempt = 0; attempt < 4; attempt++) {
        const gap = minimumCircumferentialGap(adjustedRadius, count, config);
        if (gap >= circumGap - 1e-7) break;
        adjustedRadius += (circumGap - gap) / chordSlope + EPS;
      }

      let optimized = optimizedPhase(adjustedRadius, count, previous, cx, cy, config);
      for (let attempt = 0; previous && optimized.gap < radialGap - 1e-7 && attempt < 4; attempt++) {
        adjustedRadius += radialGap - optimized.gap + 1e-4;
        optimized = optimizedPhase(adjustedRadius, count, previous, cx, cy, config);
      }
      if (adjustedRadius > maxRadius + EPS) break;

      for (let i = 0; i < count; i++) {
        appendIfInside(ringHole(adjustedRadius, count, optimized.phase, i, cx, cy, config));
      }
      previous = { radius: adjustedRadius, count, phase: optimized.phase };
    }
    return holes;
  }

  return holes;
}
