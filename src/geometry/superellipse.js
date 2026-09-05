// The superellipse |x/a|^n + |y/b|^n = 1 — the morph hole shape the `shape` field
// channel drives (Phase 2). One exponent walks the whole family:
//
//   n = 1   rhombus (diamond)
//   n = 2   ellipse (a circle when a = b)
//   n → ∞   rectangle
//
// Everything below assumes n >= 1, where the curve is convex. Convexity is what
// lets `superReach` stand in for a support function in the ligament computation,
// exactly as `hexEdgeReach` does for the hexagon.
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
// superellipse.test.js pins. OAR reads this, so it is closed form rather than a
// polygon estimate: a 64-gon would understate a circle's area by 0.08%.
export function superArea(a, b, n) {
  const exp = clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  const g1 = gamma(1 + 1 / exp);
  return (4 * a * b * (g1 * g1)) / gamma(1 + 2 / exp);
}

// Distance from the centre to the outline in direction `theta` (the shape's own,
// un-rotated frame). Closed form from the implicit equation.
export function superReach(a, b, n, theta) {
  const exp = clamp(n, SUPER_N_MIN, SUPER_N_MAX);
  const c = Math.abs(Math.cos(theta) / Math.max(1e-9, a));
  const s = Math.abs(Math.sin(theta) / Math.max(1e-9, b));
  const d = Math.pow(Math.pow(c, exp) + Math.pow(s, exp), 1 / exp);
  return d > 0 ? 1 / d : 0;
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
