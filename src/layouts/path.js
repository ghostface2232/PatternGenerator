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
    // `loopFit` is the number of holes the loop wants (the walk's own count,
    // fraction and all) rounded to a whole number, and the factor the step is
    // scaled by so that the walk comes back to the start on exactly that hole.
    // Scaling spreads the rounding evenly all the way round instead of dumping
    // it at the seam, and the count caps the walk so a rounding at the far end
    // cannot place one hole on top of the first.
    const fit = closed ? loopFit(poly, step, spacing) : null;
    const done = march(poly, step, fit ? fit.scale : 1, spacing, fit ? fit.count : Infinity, (x, y, ux, uy) => {
      if (x < xMin || x > xMax || y < yMin || y > yMax) return true;
      // Turning to the tangent turns the hole ON TOP OF the rotation the shape
      // already has, not instead of it: `holeAngle` is Diamond "Flat up", and
      // replacing it dropped the orientation dropdown on the floor in the
      // mode's default configuration. Radial composes the same way.
      const angle = alignToTangent ? Math.atan2(uy, ux) + holeAngle : holeAngle;
      holes.push(angle ? { x, y, angle } : { x, y });
      return holes.length < MAX_PATH_HOLES;
    });
    if (!done) return holes;
  }
  return holes;
}

// The walk itself: holes along `poly`, each claiming step · scale · field of
// curve from where it sits, at most `cap` of them, handed to `visit` (which
// returns false to stop everything). Returns false when stopped that way, and
// otherwise how the walk ended: the holes it placed, the curve left after the
// last of them, and the step that hole had claimed — which is what a loop's fit
// needs to know, and why the fit runs this same walk rather than its own
// estimate of it.
function march(poly, step, scale, spacing, cap, visit) {
  let placed = 0;
  // How much curve is left to cover before the next hole. Carried across
  // vertices, so the spacing runs continuously along the path rather than
  // restarting at every segment — which would bunch the holes at every corner
  // of a smoothed curve, where the segments are shortest.
  let remaining = 0;
  let claimed = 0;
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
      if (placed >= cap) break;
      at += remaining;
      const x = a.x + ux * at,
        y = a.y + uy * at;
      if (visit && !visit(x, y, ux, uy)) return false;
      placed++;
      claimed = step * scale * (spacing ? spacing.sample(x, y) : 1);
      if (!(claimed > 0)) return { placed, tail: 0, claimed: 1 };
      remaining = claimed;
    }
    remaining -= length - at;
  }
  return { placed, tail: claimed - remaining, claimed };
}

// How a closed loop divides by its own step: `count` holes, and the factor the
// step is scaled by so that the walk comes back to the start on the last of
// them.
//
// The walk's count is not a quadrature of the field over the curve, because
// the walk is not one: each hole claims the step at its own position, and
// where it sits depends on every hole before it. An estimate of the loop's
// phase that samples the field anywhere else — once per authored segment, at
// its midpoint, as this used to — is off by however much the field varies
// between those samples and the holes: a 100 mm square at an 8 mm step with a
// 0.2× region 30 mm across on one corner came back 80 mm short of its start.
// So the fit is the walk itself, dry: its own fractional count of steps round
// the loop at a scale of 1 is rounded, and the scale that makes the walk come
// out at that count is solved for. With a uniform field one correction is
// exact (the count scales as 1/scale); with a varying one each correction
// moves the holes, and so the samples, a little, and a few rounds settle it.
// Never more than a handful: a discontinuity in the field (a hard falloff)
// can keep it from settling, and then the closest scale seen is kept and the
// cap on the count still guards the seam.
const FIT_ROUNDS = 8;
function loopFit(poly, step, spacing) {
  let scale = 1;
  let count = 0;
  let best = null;
  for (let round = 0; round < FIT_ROUNDS; round++) {
    const end = march(poly, step, scale, spacing, Infinity, null);
    if (!(end.placed > 0)) return null;
    // The steps the walk took round the loop: one fewer than the holes it
    // placed, plus how far into the last hole's claim the loop ran out. A
    // whole number means the next hole would land exactly on the first.
    const phase = end.placed - 1 + end.tail / end.claimed;
    if (round === 0) count = Math.max(1, Math.round(phase));
    const miss = Math.abs(phase - count);
    if (!best || miss < best.miss) best = { scale, miss };
    if (miss < 1e-9) break;
    scale *= phase / count;
  }
  return { count, scale: best.scale };
}
