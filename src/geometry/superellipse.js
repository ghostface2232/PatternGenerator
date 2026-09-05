// The superellipse |x/a|^n + |y/b|^n = 1 — the morph hole shape the `shape` field
// channel drives (Phase 2). One exponent walks the whole family:
//
//   n = 1   rhombus (diamond)
//   n = 2   ellipse (a circle when a = b)
//   n → ∞   rectangle
//
// Everything below assumes n >= 1, where the curve is convex.
//
// Two different "how far does this shape extend" functions live here, and the
// difference between them is not cosmetic. `superReach` is the RADIAL function:
// how far the outline is from the centre in direction θ. `superSupport` is the
// SUPPORT function: how far the outline extends when measured along θ, which is
// the radial distance to the tangent line perpendicular to θ. For a convex body
// ρ(θ) ≤ h(θ), with equality only where the outward normal happens to be
// parallel to θ — so a clearance built on ρ is systematically too optimistic,
// and clearance is the one statistic that must never be. Use `superSupport` for
// anything about gaps, `superReach` for anything about the outline itself.
import { clamp } from "../core/math.js";

export const SUPER_N_MIN = 1;
export const SUPER_N_MAX = 8;
// Vertex count for the traced / exported outline. The area, hit test and gap are
// all closed-form, so this only decides how smooth the drawn edge looks (and how
// many points an SVG export writes per hole).
export const SUPER_SEGMENTS = 64;

// mix 0 → diamond, 0.5 → ellipse, 1 → near-square. Two pieces meeting at n = 2 so
// the ellipse lands exactly in the middle of the slider; a single exponential
// through (0, 1) and (1, 8) would put it at n = 2.83 and hide the circle.
export function superNFromMix(mix) {
  const m = clamp(Number.isFinite(mix) ? mix : 0.5, 0, 1);
  return m <= 0.5 ? 1 + 2 * m : 2 * Math.pow(SUPER_N_MAX / 2, (m - 0.5) * 2);
}

export function superMixFromN(n) {
  const value = clamp(Number.isFinite(n) ? n : 2, SUPER_N_MIN, SUPER_N_MAX);
  return value <= 2 ? (value - 1) / 2 : 0.5 + Math.log(value / 2) / (2 * Math.log(SUPER_N_MAX / 2));
}

// Lanczos approximation (g = 7, n = 9). Accurate to ~1e-13 over the range the
// area formula needs (arguments 1..3), which is well inside the 3-decimal
// precision every dimension is reported at.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function gamma(z) {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const x = z - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i] / (x + i);
  const t = x + LANCZOS.length - 1.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * sum;
}

// Exact area of the superellipse with semi-axes a, b:
//   A = 4ab · Γ(1 + 1/n)² / Γ(1 + 2/n)
// n = 1 gives 2ab (the rhombus) and n = 2 gives πab (the ellipse), which is what
// superellipse.test.js pins.
//
// This is the area of the CURVE. What `svg` and `png` write is the inscribed
// SUPER_SEGMENTS-gon, which is smaller — 0.16% at n = 2, 0.08% at n = 8 — so the
// figure OAR reports is very slightly above what a cutter following the exported
// outline removes. On the default document that is 0.06 of an OAR point, below
// the 0.1 the readout resolves; the sagitta on a 10 mm hole is 0.006 mm, an
// order of magnitude under the 0.05 mm flattening tolerance the roadmap sets for
// curves. Raising SUPER_SEGMENTS is what closes it if that ever stops being true.
export function superArea(a, b, n) {
  const exp = clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  const g1 = gamma(1 + 1 / exp);
  return (4 * a * b * (g1 * g1)) / gamma(1 + 2 / exp);
}

// Distance from the centre to the OUTLINE in direction `theta` (the shape's own,
// un-rotated frame). Closed form from the implicit equation.
export function superReach(a, b, n, theta) {
  const exp = clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  const c = Math.abs(Math.cos(theta) / Math.max(1e-9, a));
  const s = Math.abs(Math.sin(theta) / Math.max(1e-9, b));
  const d = Math.pow(Math.pow(c, exp) + Math.pow(s, exp), 1 / exp);
  return d > 0 ? 1 / d : 0;
}

// Support function: how far the shape extends along `theta`, i.e. the distance
// from the centre to the tangent line whose normal is theta. Closed form too —
// maximising a·cos over the curve is Hölder's inequality with the conjugate
// exponent q = n/(n−1):
//
//   h(θ) = (|a·cos θ|^q + |b·sin θ|^q)^(1/q)
//
// n = 2 gives q = 2 and the ellipse's √(a²cos² + b²sin²); n → ∞ gives q → 1 and
// the rectangle's |a cos| + |b sin|; n = 1 is the limit q → ∞, the rhombus's
// max(|a cos|, |b sin|). Never below `superReach`, and equal to it only where
// the normal lines up with theta.
export function superSupport(a, b, n, theta) {
  return supportWith(conjugate(n), a * Math.cos(theta), b * Math.sin(theta));
}

// The Hölder conjugate, and the support evaluated with it already in hand — the
// clearance search below calls this a few dozen times per pair of holes and the
// exponent does not change between calls. q = 0 stands for the two limits that
// have no `pow` in them at all: the rhombus (n = 1) and the ellipse (n = 2).
function conjugate(n) {
  const exp = clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  if (exp <= 1 + 1e-9) return 0;
  if (Math.abs(exp - 2) < 1e-9) return 2;
  return exp / (exp - 1);
}

function supportWith(q, ax, by) {
  const x = Math.abs(ax),
    y = Math.abs(by);
  if (q === 0) return Math.max(x, y);
  if (q === 2) return Math.sqrt(x * x + y * y);
  // Factored as hi·(1 + (lo/hi)^q)^(1/q) rather than (x^q + y^q)^(1/q): two
  // calls to `pow` instead of three. The clearance search below is the hottest
  // arithmetic in the whole pipeline for this shape, so the third one is worth
  // removing.
  const hi = Math.max(x, y),
    lo = Math.min(x, y);
  return hi === 0 ? 0 : hi * Math.pow(1 + Math.pow(lo / hi, q), 1 / q);
}

// How many directions the clearance search below tries, and how many times it
// then narrows around the best of them. The optimum is never far from the centre
// line for two convex holes of comparable size, so the sweep spans ±60° rather
// than the full half-turn: with these numbers the search lands within 0.03 mm of
// the true clearance on every case in superellipse.test.js, which is inside what
// a two-decimal readout can show.
const GAP_DIRECTIONS = 7;
const GAP_REFINEMENTS = 2;
const GAP_WINDOW = Math.PI / 3;

// Clearance between two superellipses, each given by its semi-axes, exponent and
// rotation, with `dx, dy` the offset between their centres.
//
// For convex bodies the distance is the widest gap between their projections:
//
//   d(A, B) = max over directions u of [ u·(c_B − c_A) − h_A(u) − h_B(−u) ]
//
// Every direction gives a valid LOWER bound, so a search that stops early is
// conservative rather than wrong — the reported ligament can be tighter than the
// metal, never looser. The centre line alone (which is what `hexEdgeReach` uses
// for the hexagon, where its neighbours make it exact) is not enough here: two
// squircles on the default 60° lattice meet on a diagonal, where it understates
// the clearance by a third. A coarse sweep plus a few narrowings closes that to
// about a hundredth of a millimetre, well inside what the readout shows.
export function superellipseGap(dx, dy, a1, b1, n1, angle1, a2, b2, n2, angle2) {
  const q1 = conjugate(n1),
    q2 = conjugate(n2);
  // Two circles need no search at all: their support is the radius in every
  // direction, so the centre line is already the answer. This is the shape the
  // default mix (an ellipse) takes whenever the hole is as wide as it is tall,
  // which is most of the time.
  if (q1 === 2 && q2 === 2 && a1 === b1 && a2 === b2) return Math.hypot(dx, dy) - a1 - a2;

  // The rotations are fixed for the whole search, so their sine and cosine are
  // taken once and the angle difference is expanded rather than re-evaluated:
  // two trig calls per direction instead of six.
  const ca1 = Math.cos(angle1),
    sa1 = Math.sin(angle1),
    ca2 = Math.cos(angle2),
    sa2 = Math.sin(angle2);
  // Two holes of the same size, shape and rotation have the same support in
  // every direction — which is every pair in a plain lattice, so it is worth
  // halving the work for.
  const alike = a1 === a2 && b1 === b2 && q1 === q2 && angle1 === angle2;
  const at = t => {
    const c = Math.cos(t),
      s = Math.sin(t);
    const h1 = supportWith(q1, a1 * (c * ca1 + s * sa1), b1 * (s * ca1 - c * sa1));
    const h2 = alike ? h1 : supportWith(q2, a2 * (c * ca2 + s * sa2), b2 * (s * ca2 - c * sa2));
    return dx * c + dy * s - h1 - h2;
  };
  const dir = Math.atan2(dy, dx);
  const along = at(dir);
  // Searching costs about fifteen more evaluations, and the answer only matters
  // where holes are close: the ligament is the smallest gap in the pattern, and
  // an overlap is a negative one. Beyond one hole's own width the centre-line
  // bound is left as it stands — still a valid lower bound, just a loose one for
  // a pair that is neither the narrowest bridge nor touching. The callers sweep
  // every neighbour within two or three pitches, so most pairs land here.
  if (along > Math.max(a1, b1, a2, b2) * 2) return along;

  const step = (2 * GAP_WINDOW) / (GAP_DIRECTIONS - 1);
  let bestT = dir,
    best = along;
  for (let i = 0; i < GAP_DIRECTIONS; i++) {
    const t = dir - GAP_WINDOW + i * step;
    const value = at(t);
    if (value > best) {
      best = value;
      bestT = t;
    }
  }
  // Ternary search inside the bracket the sweep found. The result is taken as
  // the better of the two, so a non-unimodal bracket costs precision, not
  // soundness.
  let lo = bestT - step,
    hi = bestT + step;
  for (let i = 0; i < GAP_REFINEMENTS; i++) {
    const third = (hi - lo) / 3;
    if (at(lo + third) < at(hi - third)) lo += third;
    else hi -= third;
  }
  return Math.max(best, at((lo + hi) / 2));
}

export function superContains(x, y, a, b, n) {
  const exp = clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  if (a <= 0 || b <= 0) return false;
  return Math.pow(Math.abs(x / a), exp) + Math.pow(Math.abs(y / b), exp) <= 1 + 1e-9;
}

// Outline vertices centred on the origin, wound clockwise on screen (y down).
// Parametrised as x = a·sgn(cos t)|cos t|^(2/n), y = b·sgn(sin t)|sin t|^(2/n),
// which satisfies the implicit equation for every n.
export function superellipseVerts(w, h, n, segments = SUPER_SEGMENTS) {
  const a = w / 2,
    b = h / 2;
  const exp = 2 / clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  const steps = Math.max(8, Math.round(segments));
  const verts = new Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t),
      s = Math.sin(t);
    verts[i] = [Math.sign(c) * a * Math.pow(Math.abs(c), exp), Math.sign(s) * b * Math.pow(Math.abs(s), exp)];
  }
  return verts;
}
