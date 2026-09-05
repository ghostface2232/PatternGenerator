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

// Flattening segments per span between vertices. Twelve keeps the error of a
// smoothed curve under a hundredth of a millimetre at the sheet sizes DOC_LIMITS
// allows, and the walk below only ever sees the polyline.
const SMOOTH_SEGMENTS = 12;
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
    for (let s = 1; s <= SMOOTH_SEGMENTS; s++) {
      out.push(catmullRom(at(i - 1), at(i), at(i + 1), at(i + 2), s / SMOOTH_SEGMENTS));
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
    .map(path => flattenPath(path.points, { closed: path.closed, smooth }))
    .filter(poly => poly.length >= 2);
  if (!flattened.length) return [];

  // Every hole claims `step` of curve, so the total length over the smallest
  // step the field can ask for bounds the count. Refuse above the cap rather
  // than stopping part-way down one path and leaving the rest of them bare.
  const finest = step * (spacing ? Math.max(1e-6, spacing.min) : 1);
  const total = flattened.reduce((sum, poly) => sum + polylineLength(poly), 0);
  if (total > MAX_PATH_HOLES * finest) return [];

  const holes = [];
  for (const poly of flattened) {
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
        at += remaining;
        const x = a.x + ux * at,
          y = a.y + uy * at;
        if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
          const angle = alignToTangent ? Math.atan2(uy, ux) : holeAngle;
          holes.push(angle ? { x, y, angle } : { x, y });
          if (holes.length >= MAX_PATH_HOLES) return holes;
        }
        remaining = step * (spacing ? spacing.sample(x, y) : 1);
        if (!(remaining > 0)) return holes;
      }
      remaining -= length - at;
    }
  }
  return holes;
}
