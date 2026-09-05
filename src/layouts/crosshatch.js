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

// Below this the two families are near enough to parallel that the lattice cell
// is a sliver: the hole count explodes, every cell is degenerate, and no useful
// pattern comes out. The panel says so rather than letting a slider drag hang.
export const MIN_CROSS_SIN = Math.sin((2 * Math.PI) / 180);
// Lines per family. The widest span DOC_LIMITS allows is the diagonal of a
// 1000 mm panel, about 1414 mm, and the finest pitch a 0.5 mm hole at zero gap,
// so 2829 lines is the most any document can ask for and this clears it. What it
// buys is a bound on the loop below, which is one pass per PAIR of lines.
const MAX_LINES = 4000;
// And a bound on the holes themselves, from the lattice cell the two families
// cut out — the same order as the grid family's own worst case (a 1000 mm panel
// of 0.5 mm holes at zero gap is four million holes there too).
export const MAX_CROSS_HOLES = 5_000_000;

// The offsets t of one family's lines, covering [tMin, tMax] and always
// including the centre line t0. With no spacing field this is the arithmetic
// sequence t0 + k·pitch; with one, each step is the pitch scaled by the field
// sampled on the line it steps away from — the same "sample the line, then step"
// rule the grid rows use, so the two modes agree wherever they overlap.
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
  for (let t = t0; t <= tMax && up.length < MAX_LINES;) {
    if (t >= tMin) up.push(t);
    const step = pitch * sampleLine(t);
    if (!(step > 0)) break;
    t += step;
  }
  const down = [];
  for (let t = t0; down.length < MAX_LINES;) {
    const step = pitch * sampleLine(t);
    if (!(step > 0)) break;
    t -= step;
    if (t < tMin) break;
    if (t <= tMax) down.push(t);
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
  const radA = (angleA * Math.PI) / 180,
    radB = (angleB * Math.PI) / 180;
  const nA = [-Math.sin(radA), Math.cos(radA)];
  const nB = [-Math.sin(radB), Math.cos(radB)];
  const det = nA[0] * nB[1] - nA[1] * nB[0]; // = sin(angleB − angleA)
  if (Math.abs(det) < MIN_CROSS_SIN) return [];
  if (!(pitchA > 0) || !(pitchB > 0)) return [];
  // One hole per lattice cell of area pitchA·pitchB/|sin Δ|.
  if ((xMax - xMin) * (yMax - yMin) * Math.abs(det) > MAX_CROSS_HOLES * pitchA * pitchB) return [];

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
  // The point of a line closest to the region centre, which is where the
  // spacing field is read for that line.
  const sampler = n =>
    spacing
      ? t => {
          const offset = t - (n[0] * cx + n[1] * cy);
          return spacing.sample(cx + offset * n[0], cy + offset * n[1]);
        }
      : null;

  const [aLo, aHi] = span(nA);
  const [bLo, bHi] = span(nB);
  const offsetsA = lineOffsets(nA[0] * cx + nA[1] * cy, aLo, aHi, pitchA, sampler(nA));
  const offsetsB = lineOffsets(nB[0] * cx + nB[1] * cy, bLo, bHi, pitchB, sampler(nB));
  if (!offsetsA || !offsetsB) return [];

  const holes = [];
  for (const tA of offsetsA) {
    for (const tB of offsetsB) {
      const x = (tA * nB[1] - nA[1] * tB) / det;
      const y = (nA[0] * tB - tA * nB[0]) / det;
      if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
      holes.push(holeAngle ? { x, y, angle: holeAngle } : { x, y });
      if (holes.length >= MAX_CROSS_HOLES) return holes;
    }
  }
  return holes;
}
