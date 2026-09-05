// Path: holes marched at equal spacing along curves the user draws on the sheet.
//
// The curve is a list of vertices, optionally closed into a loop and optionally
// smoothed. Smoothing is Catmull-Rom through the vertices rather than a Bézier
// with its own control points: the curve then passes through every point that
// can be dragged, so the only thing on the canvas is the thing being edited.
// A Bézier would put two handles between each pair of vertices, tripling what
// has to be drawn, hit-tested, stored and validated for a curve of the same
// shape.
//
// Marching is by arc length along the flattened polyline. Within a segment that
// is also the chord, so consecutive holes are exactly the step apart; across a
// corner the chord is shorter than the arc by however sharp the corner is, and
// the ligament readout reports that rather than the layout pretending otherwise.

// Flattening: one segment per SMOOTH_MM of span, bounded either way.
//
// A fixed count is the wrong shape of answer, because the error of a chord is
// its length squared over the curvature — so it grows with the span, and the
// span grows with the sheet. Twelve per span was 0.44 mm off the true curve on
// the default 200 mm document and 2.2 mm on a 1000 mm one, and this polyline is
// not merely what gets drawn: it is what the walk below measures, so that error
// lands in the holes. Two millimetres a segment holds it near a hundredth of a
// millimetre at any sheet the sliders allow, for a few thousand points at worst.
const SMOOTH_MM = 2;
const MIN_SMOOTH_SEGMENTS = 8;
const MAX_SMOOTH_SEGMENTS = 128;
const spanSegments = (a, b) =>
  Math.min(
    MAX_SMOOTH_SEGMENTS,
    Math.max(MIN_SMOOTH_SEGMENTS, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / SMOOTH_MM))
  );
export const MAX_PATH_HOLES = 1_000_000;

// Catmull-Rom through p1 and p2, with p0 and p3 setting the tangents.
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t,
    t3 = t2 * t;
  const at = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - 3 * c + d - a) * t3); // prettier-ignore
  return { x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) };
}

// A path's vertices as a polyline: the vertices themselves when `smooth` is off,
// a Catmull-Rom through them when it is on, with the loop closed when `closed`.
export function flattenPath(points, { closed = false, smooth = true } = {}) {
  const clean = points.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length < 2) return clean.slice();
  const loop = closed ? clean.concat([clean[0]]) : clean;
  if (!smooth) return loop;
  const at = i => {
    // Off the ends: reflect the neighbour on an open path, wrap on a closed one,
    // so a closed curve joins itself with no corner at the seam.
    const n = clean.length;
    if (closed) return clean[((i % n) + n) % n];
    if (i < 0) return { x: 2 * clean[0].x - clean[1].x, y: 2 * clean[0].y - clean[1].y };
    if (i > n - 1) return { x: 2 * clean[n - 1].x - clean[n - 2].x, y: 2 * clean[n - 1].y - clean[n - 2].y };
    return clean[i];
  };
  const out = [loop[0]];
  const spans = closed ? clean.length : clean.length - 1;
  for (let i = 0; i < spans; i++) {
    const segments = spanSegments(at(i), at(i + 1));
    for (let s = 1; s <= segments; s++) {
      out.push(catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2), s / segments));
    }
  }
  return out;
}

export function polylineLength(poly) {
  let total = 0;
  for (let i = 1; i < poly.length; i++) total += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  return total;
}

// A default curve for a region: a broad S across it, so switching to this mode
// draws something rather than nothing, and pressing Add Path in the panel starts
// from the same curve so the pattern does not jump when it becomes editable.
export function defaultPathPoints(bounds) {
  const { xMin, xMax, yMin, yMax } = bounds;
  const w = xMax - xMin,
    h = yMax - yMin;
  return [
    { x: xMin + w * 0.12, y: yMin + h * 0.74 },
    { x: xMin + w * 0.36, y: yMin + h * 0.22 },
    { x: xMin + w * 0.64, y: yMin + h * 0.78 },
    { x: xMin + w * 0.88, y: yMin + h * 0.26 },
  ];
}

export function generatePathHoles({ bounds, paths, smooth, alignToTangent, step, spacing, holeAngle = 0 }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(step > 0)) return [];
  const flattened = (paths?.length ? paths : [{ points: defaultPathPoints(bounds), closed: false }])
    .map(path => ({ poly: flattenPath(path.points, { closed: path.closed, smooth }), closed: !!path.closed }))
    .filter(entry => entry.poly.length >= 2);
  if (!flattened.length) return [];

  // Every hole claims `step` of curve, so the total length over the smallest
  // step the field can ask for bounds the count. Refuse above the cap rather
  // than stopping part-way down one path and leaving the rest of them bare.
  const finest = step * (spacing ? Math.max(1e-6, spacing.min) : 1);
  const total = flattened.reduce((sum, entry) => sum + polylineLength(entry.poly), 0);
  if (total > MAX_PATH_HOLES * finest) return [];

  const holes = [];
  for (const { poly, closed } of flattened) {
    // A closed curve comes back to where it started, so the step has to divide
    // the loop. Left alone it does not: the last hole lands wherever the
    // perimeter leaves over from the first, a seam gap that sweeps continuously
    // through zero as any vertex is dragged — measured, a square loop of side
    // 100.5 mm at a step of 8 put two holes 2 mm apart and overlapped them.
    //
    // `loopFit` is the number of holes the loop wants (Σ ds/step, which is the
    // step's own count) rounded to a whole number, and the ratio between the
    // two. Scaling the step by that ratio spreads the rounding evenly all the
    // way round instead of dumping it at the seam, and the count caps the walk
    // so a rounding at the far end cannot place one hole on top of the first.
    const fit = closed ? loopFit(poly, step, spacing) : null;
    const scale = fit ? fit.scale : 1;
    let placed = 0;
    // How much curve is left to cover before the next hole. Carried across
    // vertices, so the spacing runs continuously along the path rather than
    // restarting at every segment — which would bunch the holes at every corner
    // of a smoothed curve, where the segments are shortest.
    let remaining = 0;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1],
        b = poly[i];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (!(length > 0)) continue;
      const ux = dx / length,
        uy = dy / length;
      let at = 0;
      // Strictly less than, so a hole landing exactly on a vertex is placed once
      // — by the segment that starts there, not by both that end and this start.
      while (at + remaining < length) {
        if (fit && placed >= fit.count) break;
        at += remaining;
        const x = a.x + ux * at,
          y = a.y + uy * at;
        if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
          // Turning to the tangent turns the hole ON TOP OF the rotation the
          // shape already has, not instead of it: `holeAngle` is Diamond "Flat
          // up", and replacing it dropped the orientation dropdown on the floor
          // in the mode's default configuration. Radial composes the same way.
          const angle = alignToTangent ? Math.atan2(uy, ux) + holeAngle : holeAngle;
          holes.push(angle ? { x, y, angle } : { x, y });
          if (holes.length >= MAX_PATH_HOLES) return holes;
        }
        placed++;
        remaining = step * scale * (spacing ? spacing.sample(x, y) : 1);
        if (!(remaining > 0)) return holes;
      }
      remaining -= length - at;
    }
  }
  return holes;
}

// How a closed loop divides by its own step: `count` holes, and the factor the
// step is scaled by so that they land evenly all the way round. Measured at the
// midpoint of each segment, which is where a varying step best represents it.
function loopFit(poly, step, spacing) {
  let phase = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1],
      b = poly[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(length > 0)) continue;
    const local = step * (spacing ? spacing.sample((a.x + b.x) / 2, (a.y + b.y) / 2) : 1);
    if (!(local > 0)) return null;
    phase += length / local;
  }
  if (!(phase > 0)) return null;
  const count = Math.max(1, Math.round(phase));
  return { count, scale: phase / count };
}
