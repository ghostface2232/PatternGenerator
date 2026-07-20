const TAU = Math.PI * 2;
const EPS = 1e-9;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function diamondFlatAngle(w, h) {
  return -Math.atan2(h, w);
}

function triInradius(w, h) {
  const slant = Math.hypot(w / 2, h);
  return (w * h / 2) / (w / 2 + slant);
}

function shapeVertices(shape, w, h) {
  if (shape === "Hexagon") {
    const R = w / 2;
    return Array.from({ length: 6 }, (_, i) => {
      const angle = i * Math.PI / 3 + Math.PI / 6;
      return [R * Math.cos(angle), R * Math.sin(angle)];
    });
  }
  if (shape === "Diamond") return [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]];
  if (shape === "Triangle") {
    const r = triInradius(w, h);
    return [[0, -(h - r)], [w / 2, r], [-w / 2, r]];
  }
  return null;
}

function projectedVertexExtent(vertices, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  let lo = Infinity, hi = -Infinity;
  for (const [x, y] of vertices) {
    const projection = x * c + y * s;
    lo = Math.min(lo, projection);
    hi = Math.max(hi, projection);
  }
  return hi - lo;
}

export function getRadialShapeExtents(shape, w, h, diamondOrient = "Point up") {
  if (shape === "Triangle") return { radial: h, tangential: w };
  if (shape === "Hexagon") return { radial: w * Math.sqrt(3) / 2, tangential: w };
  if (shape === "Diamond") {
    const offset = diamondOrient === "Flat up" ? diamondFlatAngle(w, h) : 0;
    const vertices = shapeVertices(shape, w, h);
    return {
      radial: projectedVertexExtent(vertices, -offset),
      tangential: projectedVertexExtent(vertices, Math.PI / 2 - offset),
    };
  }
  if (shape === "Rectangle" || shape === "Pill") return { radial: w, tangential: h };
  return { radial: w, tangential: w };
}

export function maxRingPointCount(radius, minimumChord) {
  if (!(radius > 0) || !(minimumChord > 0)) return 0;
  if (minimumChord > radius * 2 + EPS) return 1;
  const ratio = clamp(minimumChord / (radius * 2), 0, 1);
  return Math.max(2, Math.floor(Math.PI / Math.asin(ratio) + EPS));
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
  const c = Math.cos(local), s = Math.sin(local);
  if (shape === "Circle") return w / 2;
  if (shape === "Rectangle") return Math.abs(c) * w / 2 + Math.abs(s) * h / 2;
  if (shape === "Pill") {
    if (w >= h) return Math.abs(c) * (w - h) / 2 + h / 2;
    return Math.abs(s) * (h - w) / 2 + w / 2;
  }
  const vertices = shapeVertices(shape, w, h);
  let support = -Infinity;
  for (const [x, y] of vertices) support = Math.max(support, x * c + y * s);
  return support;
}

export function projectedShapeGap(a, b, config) {
  const dx = b.x - a.x, dy = b.y - a.y;
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
  return distance
    - shapeSupport(shape, w, h, angleA, direction)
    - shapeSupport(shape, w, h, angleB, direction + Math.PI);
}

function ringHole(radius, count, phase, index, cx, cy, config) {
  const polarAngle = phase + TAU * index / count;
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

function ringPointCount(radius, circumSpacing, circumGap, config) {
  let count = Math.max(1, maxRingPointCount(radius, circumSpacing));
  while (count > 1 && minimumCircumferentialGap(radius, count, config) < circumGap - 1e-7) count--;
  return count;
}

function closestPreviousIndices(angle, previous) {
  if (previous.count === 1) return [0];
  const step = TAU / previous.count;
  const nearest = Math.round((angle - previous.phase) / step);
  return [-2, -1, 0, 1, 2].map(offset => ((nearest + offset) % previous.count + previous.count) % previous.count);
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
  let bestPhase = 0, bestGap = -Infinity;
  for (let i = 0; i < samples; i++) {
    const phase = period * i / samples;
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
  } = options;
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin)) return [];

  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
  const perfW = xMax - xMin, perfH = yMax - yMin;
  const extents = getRadialShapeExtents(shape, w, h, diamondOrient);
  const ringSpacing = Math.max(EPS, extents.radial + Math.max(0, radialGap));
  const circumSpacing = Math.max(EPS, extents.tangential + Math.max(0, circumGap));
  const circleRadius = Math.min(perfW, perfH) / 2;
  const boundaryPad = Math.max(w, h) / 2;
  const maxRadius = fillMode === "Circle"
    ? circleRadius
    : Math.hypot(perfW / 2, perfH / 2) + boundaryPad;
  const config = { shape, w, h, diamondOrient };
  const holes = [];

  let previous = null;
  if (centerHole) {
    const centerAngle = shape === "Diamond" && diamondOrient === "Flat up" ? diamondFlatAngle(w, h) : 0;
    holes.push({ x: cx, y: cy, angle: centerAngle });
    previous = { radius: 0, count: 1, phase: 0, centerAngle };
  }

  for (let ringRadius = ringSpacing; ringRadius <= maxRadius + EPS; ringRadius += ringSpacing) {
    let count = ringPointCount(ringRadius, circumSpacing, Math.max(0, circumGap), config);
    let optimized = optimizedPhase(ringRadius, count, previous, cx, cy, config);
    let adjustedRadius = ringRadius;

    for (let attempt = 0; previous && optimized.gap < radialGap - 1e-7 && attempt < 4; attempt++) {
      adjustedRadius += radialGap - optimized.gap + 1e-6;
      count = ringPointCount(adjustedRadius, circumSpacing, Math.max(0, circumGap), config);
      optimized = optimizedPhase(adjustedRadius, count, previous, cx, cy, config);
    }
    if (adjustedRadius > maxRadius + EPS) break;

    for (let i = 0; i < count; i++) {
      const hole = ringHole(adjustedRadius, count, optimized.phase, i, cx, cy, config);
      let inside;
      if (fillMode === "Circle") {
        inside = Math.hypot(hole.x - cx, hole.y - cy) <= circleRadius + EPS;
      } else if (cornerRadius > 0) {
        inside = isInsideRoundedRect(hole.x, hole.y, bounds, cornerRadius);
      } else {
        inside = hole.x >= xMin - boundaryPad && hole.x <= xMax + boundaryPad
          && hole.y >= yMin - boundaryPad && hole.y <= yMax + boundaryPad;
      }
      if (inside) holes.push({ x: hole.x, y: hole.y, angle: hole.angle });
    }
    previous = { radius: adjustedRadius, count, phase: optimized.phase };
    if (adjustedRadius > ringRadius + EPS) ringRadius = adjustedRadius;
  }
  return holes;
}
