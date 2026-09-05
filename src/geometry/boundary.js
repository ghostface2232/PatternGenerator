// The perforation boundary: the region of the sheet that receives holes.
// Today it is a margin-inset rectangle with optional rounded corners, or the
// inscribed circle in Radial "Circle" fill mode. Everything that needs to know
// "is this point perforated?" goes through here so preview, stats and exports agree.
import { isInsideRoundedRect, roundedRectArea } from "./rounded-rect.js";
import { getShape, holeExitOutline, holeOutline, holeVertices, isPointInsideHole } from "./shapes.js";

// Normalised description of the boundary from generator params.
export function perfBoundsFromParams(params) {
  const {
    sheetW,
    sheetH,
    marginLeft = 0,
    marginRight = 0,
    marginTop = 0,
    marginBottom = 0,
    cornerRadius = 0,
    patternType,
    radialMode,
  } = params;
  return {
    xMin: marginLeft,
    xMax: sheetW - marginRight,
    yMin: marginTop,
    yMax: sheetH - marginBottom,
    cornerRadius,
    circleMode: patternType === "Radial" && radialMode === "Circle",
  };
}

export function perfBoundsArea(bounds) {
  const w = Math.max(0, bounds.xMax - bounds.xMin),
    h = Math.max(0, bounds.yMax - bounds.yMin);
  if (bounds.circleMode) {
    const r = Math.min(w, h) / 2;
    return Math.PI * r * r;
  }
  return roundedRectArea(w, h, bounds.cornerRadius || 0);
}

export function tracePerfBoundary(ctx, params) {
  const b = perfBoundsFromParams(params);
  const x = b.xMin,
    y = b.yMin;
  const w = Math.max(0, b.xMax - b.xMin);
  const h = Math.max(0, b.yMax - b.yMin);
  ctx.beginPath();
  if (b.circleMode) {
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(x, y, w, h, Math.min(b.cornerRadius, w / 2, h / 2));
  }
}

export function perfBoundarySVG(params) {
  const b = perfBoundsFromParams(params);
  const x = b.xMin,
    y = b.yMin;
  const w = Math.max(0, b.xMax - b.xMin);
  const h = Math.max(0, b.yMax - b.yMin);
  if (b.circleMode) {
    return `<circle cx="${(x + w / 2).toFixed(3)}" cy="${(y + h / 2).toFixed(3)}" r="${(Math.min(w, h) / 2).toFixed(3)}" />`;
  }
  const r = Math.min(b.cornerRadius, w / 2, h / 2);
  return `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" rx="${r.toFixed(3)}" ry="${r.toFixed(3)}" />`;
}

export function isPointInsidePerfBoundary(px, py, bounds) {
  const { xMin, xMax, yMin, yMax, cornerRadius: cr, circleMode } = bounds;
  if (circleMode) {
    const cx = (xMin + xMax) / 2,
      cy = (yMin + yMax) / 2;
    return Math.hypot(px - cx, py - cy) <= Math.min(xMax - xMin, yMax - yMin) / 2;
  }
  return isInsideRoundedRect(px, py, xMin, yMin, xMax, yMax, cr);
}

// Area of a hole that actually lies inside the boundary. Exact when the hole is
// fully inside; otherwise a 12×12 sample of its bounding box.
export function estimateVisibleHoleArea(hole, shape, bounds, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const exactArea = useExit ? hole.exitArea : hole.area;
  if (w <= 0 || h <= 0) return 0;
  // A shape that can measure itself against the boundary does. The box sampling
  // below assumes a hole fills a useful share of its own bounding box, and a Flow
  // Lines slot running corner to corner does not: it would land a handful of the
  // 144 samples on the metal and read the open area off the noise between them.
  const own = getShape(shape).visibleArea;
  if (own) {
    return own(hole, useExit ? holeExitOutline(hole) : holeOutline(hole), exactArea, (px, py) =>
      isPointInsidePerfBoundary(px, py, bounds)
    );
  }
  const angle = hole.angle || 0;
  const polyVerts = holeVertices(hole, shape, useExit);
  let left, right, top, bottom;
  if (polyVerts?.length) {
    // Polygon shapes are not centred in their w×h box (triangle origin = incenter,
    // Voronoi cell = wherever its site fell), so take the exact bounding box of
    // the vertices themselves.
    const verts = polyVerts;
    left = Math.min(...verts.map(v => v[0]));
    right = Math.max(...verts.map(v => v[0]));
    top = Math.min(...verts.map(v => v[1]));
    bottom = Math.max(...verts.map(v => v[1]));
  } else {
    const bw = Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h;
    const bh = Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
    left = hole.x - bw / 2;
    right = hole.x + bw / 2;
    top = hole.y - bh / 2;
    bottom = hole.y + bh / 2;
  }
  const boxW = right - left,
    boxH = bottom - top;

  if (
    [
      [left, top],
      [right, top],
      [left, bottom],
      [right, bottom],
    ].every(([x, y]) => isPointInsidePerfBoundary(x, y, bounds))
  )
    return exactArea;
  if (bounds.circleMode) {
    const cx = (bounds.xMin + bounds.xMax) / 2,
      cy = (bounds.yMin + bounds.yMax) / 2;
    const panelRadius = Math.min(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin) / 2;
    if (Math.hypot(hole.x - cx, hole.y - cy) + Math.hypot(boxW, boxH) / 2 <= panelRadius) return exactArea;
  }

  const samples = 12;
  let inside = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const px = left + ((sx + 0.5) * boxW) / samples;
      const py = top + ((sy + 0.5) * boxH) / samples;
      if (isPointInsidePerfBoundary(px, py, bounds) && isPointInsideHole(px, py, hole, shape, useExit)) inside++;
    }
  }
  return (boxW * boxH * inside) / (samples * samples);
}
