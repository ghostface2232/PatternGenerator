// Cross-hatch: two families of parallel lines, a hole at every intersection.
//
// It is the general case of the grid family — angles 90° and 0° with the two
// pitches reproduce the Straight grid exactly, which layouts.test.js asserts —
// and unlike the grid it reads the spacing channel in BOTH directions. That is
// not a special case of the row-by-row rule in grid.js but the reason the mode
// exists: a line moves as a whole, so shifting the lines of each family
// independently varies the density in two dimensions while every line stays
// straight and every intersection stays an intersection. The grid family cannot
// do that (see the note above `rowPositions` in grid.js).
//
// A family is described by the direction its lines run (`angle`) and the
// perpendicular distance between them (`pitch`). Line k is the locus n·p = t_k
// for the unit normal n = (−sin angle, cos angle).
//
// Every guard below REFUSES — returns an empty pattern — rather than stopping
// part-way. Two of them used to truncate instead, and the result was not a
// coarser pattern but a strip of holes in one corner of a blank sheet: the line
// lists were cut at their cap and the hole loop returned mid-scan, both in
// line-A order. A mode that cannot draw what it was asked for has to say so.
import { strongestAlong } from "./field-sampling.js";

// Below this the two families are near enough to parallel that their lattice
// cell is a sliver: every cell is degenerate and no useful pattern comes out.
// (The hole COUNT falls rather than rises there — a sliver cell is a large one —
// so this is about the pattern being meaningless, not about cost.)
export const MIN_CROSS_SIN = Math.sin((2 * Math.PI) / 180);
// Holes the mode will draw, from the lattice cell the two families cut out. The
// same order as the grid family's own worst case: a 1000 mm panel of 0.5 mm
// holes at zero gap is four million holes there too.
export const MAX_CROSS_HOLES = 5_000_000;
// And a bound on the work, which is one pass per PAIR of lines. Slivers are why
// this is not implied by the cap above: at 2° apart the region's projections
// stay as long as its diagonal while the cell area grows, so the pair count can
// run fifty times ahead of the hole count.
const MAX_CROSS_PAIRS = 20_000_000;
// A backstop on the accumulating walk alone. Unreachable for any document:
// the widest span DOC_LIMITS allows is the diagonal of a 1000 mm panel padded by
// a hole radius, about 1459 mm, the finest pitch is 0.5 mm, and the spacing
// field bottoms out at 0.2× — 14 590 lines at the very worst.
const MAX_LINES = 100_000;
// Samples per line when the spacing field is read. See field-sampling.js.
const SPACING_SAMPLES = 32;

// The offsets t of one family's lines, covering [tMin, tMax] and always
// including the centre line t0. With no spacing field this is the arithmetic
// sequence t0 + k·pitch; with one, each step is the pitch scaled by the field
// read along the line it steps away from — the same "read the line, then step"
// rule the grid rows use, so the two modes agree wherever they overlap.
//
// The accumulation is anchored: it sums the dimensionless multipliers and
// multiplies by the pitch once, so a field that reads 1 gives back exactly
// t0 + k·pitch rather than k roundings of it.
function lineOffsets(t0, tMin, tMax, pitch, sampleLine) {
  if (!(pitch > 0) || !(tMax >= tMin)) return null;
  if (!sampleLine) {
    const kMin = Math.ceil((tMin - t0) / pitch);
    const kMax = Math.floor((tMax - t0) / pitch);
    if (kMax < kMin) return [];
    if (kMax - kMin + 1 > MAX_LINES) return null;
    const out = new Array(kMax - kMin + 1);
    for (let k = kMin; k <= kMax; k++) out[k - kMin] = t0 + k * pitch;
    return out;
  }
  const up = [];
  for (let t = t0, sum = 0; t <= tMax;) {
    if (t >= tMin) up.push(t);
    const advance = sampleLine(t);
    if (!(advance > 0)) break;
    sum += advance;
    t = t0 + pitch * sum;
    if (up.length >= MAX_LINES) return null;
  }
  const down = [];
  for (let t = t0, sum = 0; ;) {
    const advance = sampleLine(t);
    if (!(advance > 0)) break;
    sum += advance;
    t = t0 - pitch * sum;
    if (t < tMin) break;
    if (t <= tMax) down.push(t);
    if (down.length >= MAX_LINES) return null;
  }
  down.reverse();
  return down.concat(up);
}

// `bounds` is the region the holes may fall in (already padded by the caller),
// `spacing` the compiled spacing field or null, `holeAngle` the rotation every
// hole carries. Returns [] for a degenerate or impossibly fine pair of families.
export function generateCrosshatchHoles({ angleA, angleB, pitchA, pitchB, bounds, spacing, holeAngle = 0 }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin)) return [];
  if (!(pitchA > 0) || !(pitchB > 0)) return [];
  const radA = (angleA * Math.PI) / 180,
    radB = (angleB * Math.PI) / 180;
  const nA = [-Math.sin(radA), Math.cos(radA)];
  const nB = [-Math.sin(radB), Math.cos(radB)];
  const det = nA[0] * nB[1] - nA[1] * nB[0]; // = sin(angleB − angleA)
  if (Math.abs(det) < MIN_CROSS_SIN) return [];

  // One hole per lattice cell of area pitchA·pitchB/|sin Δ| — divided by the
  // spacing field's lower bound TWICE, once per family, because a field that
  // reads 0.2 everywhere puts five times as many lines in each direction. The
  // guard used to read the base pitches alone and under-counted by up to
  // twenty-five, which is how the loop ran into a cap it should never reach.
  const finest = spacing ? Math.max(1e-6, spacing.min) : 1;
  const cellArea = (pitchA * pitchB * finest * finest) / Math.abs(det);
  if ((xMax - xMin) * (yMax - yMin) > MAX_CROSS_HOLES * cellArea) return [];

  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  const corners = [
    [xMin, yMin],
    [xMax, yMin],
    [xMin, yMax],
    [xMax, yMax],
  ];
  const span = n => {
    let lo = Infinity,
      hi = -Infinity;
    for (const [x, y] of corners) {
      const t = n[0] * x + n[1] * y;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    return [lo, hi];
  };
  // What one line reads from the field: its strongest value along the chord it
  // cuts through the region (see field-sampling.js). Reading a single point
  // instead — the one closest to the centre, which is what this did first —
  // makes the mode blind along two whole directions: at the default 45°/−45°
  // those points trace the two diagonals, so a controller dropped on the
  // vertical axis moved nothing at all while the canvas heat map showed it
  // plainly. A mode documented as varying the density in two dimensions has to
  // read the field in two dimensions.
  const sampler = n => {
    if (!spacing) return null;
    const dx = -n[1],
      dy = n[0];
    const anchor = n[0] * cx + n[1] * cy;
    return t => {
      // The point of the line closest to the region's centre, then the run of s
      // for which `p + s·d` stays inside the region — a one-dimensional clip
      // against the four edges.
      const offset = t - anchor;
      const px = cx + offset * n[0],
        py = cy + offset * n[1];
      let sLo = -Infinity,
        sHi = Infinity;
      for (const [d, p, lo, hi] of [
        [dx, px, xMin, xMax],
        [dy, py, yMin, yMax],
      ]) {
        if (Math.abs(d) < 1e-12) {
          if (p < lo || p > hi) return spacing.sample(px, py); // the line misses that slab entirely
          continue;
        }
        const a = (lo - p) / d,
          b = (hi - p) / d;
        sLo = Math.max(sLo, Math.min(a, b));
        sHi = Math.min(sHi, Math.max(a, b));
      }
      // A line that misses the region still has to advance, or the walk never
      // reaches the lines beyond it.
      if (!(sHi > sLo)) return spacing.sample(px, py);
      return strongestAlong(spacing, px + sLo * dx, py + sLo * dy, px + sHi * dx, py + sHi * dy, SPACING_SAMPLES);
    };
  };

  const [aLo, aHi] = span(nA);
  const [bLo, bHi] = span(nB);
  const offsetsA = lineOffsets(nA[0] * cx + nA[1] * cy, aLo, aHi, pitchA, sampler(nA));
  const offsetsB = lineOffsets(nB[0] * cx + nB[1] * cy, bLo, bHi, pitchB, sampler(nB));
  if (!offsetsA || !offsetsB) return [];
  if (offsetsA.length * offsetsB.length > MAX_CROSS_PAIRS) return [];

  const holes = [];
  for (const tA of offsetsA) {
    for (const tB of offsetsB) {
      const x = (tA * nB[1] - nA[1] * tB) / det;
      const y = (nA[0] * tB - tA * nB[0]) / det;
      if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
      holes.push(holeAngle ? { x, y, angle: holeAngle } : { x, y });
    }
  }
  return holes;
}
