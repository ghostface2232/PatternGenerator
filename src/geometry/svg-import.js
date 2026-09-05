// From an SVG file to rings the document can hold: parsed (geometry/svg-path.js),
// scaled to millimetres, simplified to the roadmap's 0.05 mm and cut down to
// the document's caps. Pure; the file reading and the question to the user
// about an unknown scale are the UI's.
import { MAX_BOUNDARY_POINTS, MAX_BOUNDARY_RINGS } from "../core/constants.js";
import { normalizeRings, ringsBBox, simplifyRing } from "./rings.js";
import { parseSVGOutline } from "./svg-path.js";
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
  let kept = normalizeRings(rings);
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
