// From an SVG file to rings the document can hold: parsed (geometry/svg-path.js),
// scaled to millimetres, simplified to the roadmap's 0.05 mm and cut down to
// the document's caps. Pure; the file reading and the question to the user
// about an unknown scale are the UI's.
import { MAX_BOUNDARY_POINTS, MAX_BOUNDARY_RINGS, MAX_CUSTOM_POINTS, MAX_CUSTOM_RINGS } from "../core/constants.js";
import { ringsBBox, simplifyRing, unitRings } from "./rings.js";
import { parseSVGOutline } from "./svg-path.js";
import { resolveEvenOddRings } from "./offset.js";
import { signedPolyArea } from "./polygon.js";

export const IMPORT_TOLERANCE = 0.05;

// What the file says about itself before any scale is settled: whether it is
// an SVG at all, whether it holds a closed outline, the millimetres per user
// unit it states (or null), and the outline's extent in user units.
export function inspectSVG(text) {
  const parsed = parseSVGOutline(text, 1);
  const rings = parsed.shapes.flatMap(shape => shape.rings);
  const box = ringsBBox(rings);
  return {
    isSVG: parsed.isSVG,
    hasOutline: rings.length > 0,
    scale: parsed.scale,
    width: box.right - box.left,
    height: box.bottom - box.top,
  };
}

// Rings within the caps: at most `maxRings` (the largest kept) and at most
// `maxPoints` per ring, simplified at a growing tolerance until each fits.
export function fitRings(
  rings,
  { maxRings = MAX_BOUNDARY_RINGS, maxPoints = MAX_BOUNDARY_POINTS, tolerance = IMPORT_TOLERANCE } = {}
) {
  let kept = resolveEvenOddRings(rings);
  if (kept.length > maxRings) {
    kept = kept
      .map((ring, i) => ({ ring, i, area: Math.abs(signedPolyArea(ring)) }))
      .sort((a, b) => b.area - a.area)
      .slice(0, maxRings)
      .sort((a, b) => a.i - b.i)
      .map(entry => entry.ring);
  }
  return kept.map(ring => {
    let out = simplifyRing(ring, tolerance);
    for (let t = tolerance * 2; out.length > maxPoints && t < 1e6; t *= 2) out = simplifyRing(ring, t);
    return out.length > maxPoints ? out.slice(0, maxPoints) : out;
  });
}

// The file's outlines as rings in millimetres. `scale` is millimetres per user
// unit — the file's own where it states one, otherwise whatever the user
// answered. The result is centred on `centre` when one is given.
export function svgToRings(text, { scale, centre = null, ...caps } = {}) {
  const mm = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const parsed = parseSVGOutline(text, IMPORT_TOLERANCE / mm);
  let rings = parsed.shapes.flatMap(shape => shape.rings).map(ring => ring.map(([x, y]) => [x * mm, y * mm]));
  if (centre && rings.length) {
    const box = ringsBBox(rings);
    const dx = centre.x - (box.left + box.right) / 2,
      dy = centre.y - (box.top + box.bottom) / 2;
    rings = rings.map(ring => ring.map(([x, y]) => [x + dx, y + dy]));
  }
  return fitRings(rings, caps);
}

// The file's outlines as one custom HOLE shape: rings fitted to the unit
// square (bounding box exactly, proportions remembered in `aspect`), simplified
// at a share of the outline's own size since a hole has no size yet. The
// shape's name is the file's, without its extension.
export function svgToUnitShape(text, fileName = "", caps = {}) {
  const parsed = parseSVGOutline(text, 1e-3 * outlineSize(parseSVGOutline(text, 1).shapes));
  const rings = parsed.shapes.flatMap(shape => shape.rings);
  const size = outlineSize(parsed.shapes);
  const fitted = fitRings(rings, {
    maxRings: caps.maxRings ?? MAX_CUSTOM_RINGS,
    maxPoints: caps.maxPoints ?? MAX_CUSTOM_POINTS,
    tolerance: 0.002 * size,
  });
  const unit = unitRings(fitted);
  return {
    kind: "svg",
    name: String(fileName || "outline")
      .replace(/\.svg$/i, "")
      .slice(0, 60),
    rings: unit.rings,
    aspect: unit.aspect,
    lockAspect: true,
    layers: [],
  };
}

function outlineSize(shapes) {
  const box = ringsBBox(shapes.flatMap(shape => shape.rings));
  return Math.max(1e-9, box.right - box.left, box.bottom - box.top);
}
