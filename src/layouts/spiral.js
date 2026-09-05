// Spiral: holes marched along an Archimedean spiral r = b·θ, where
// b = turnGap / 2π puts consecutive turns exactly `turnGap` apart in the radial
// direction — at every radius, which is the property that makes this spiral
// (rather than a logarithmic one) the right curve for a perforation. So the two
// spacings are independent and both are honest: `turnGap` is the clearance
// between turns and `alongStep` the clearance along one.
//
// Each step solves for the Δθ whose CHORD is the requested step, not the one
// whose arc length is. The two agree wherever the spiral is nearly straight and
// differ where it is not, which is exactly the inner turns — and there it is the
// chord that decides whether two holes touch. Marching by arc length instead put
// the innermost pair 7.66 mm apart on a document asking for 8, a tenth of the
// ligament gone at the one place a spiral is already at its tightest.
//
// The spacing channel scales the step along the curve, so a controller thins or
// crowds the beads on the arm without bending the arm itself. Varying `turnGap`
// as well would make b a function of θ, and then r = b(θ)·θ is no longer a
// spiral whose turn clearance anyone can state.

const TWO_PI = Math.PI * 2;
export const MAX_SPIRAL_HOLES = 150_000;

// |p(θ + delta) − p(θ)| on r = b·θ, squared. Strictly increasing in delta over
// (0, π] — the next point turns away and recedes at once — which is what makes
// the bisection below safe without a derivative or a bracketing search.
function chordSquared(b, theta, delta) {
  const r1 = b * theta,
    r2 = b * (theta + delta);
  return r1 * r1 + r2 * r2 - 2 * r1 * r2 * Math.cos(delta);
}

// The Δθ that puts the next hole exactly `step` from this one. Bisection rather
// than Newton: the interval is fixed, the function is monotone on it, and 40
// halvings of π land well inside the last bit of a millimetre coordinate.
function deltaForChord(b, theta, step) {
  const target = step * step;
  if (chordSquared(b, theta, Math.PI) <= target) return Math.PI;
  let lo = 0,
    hi = Math.PI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (chordSquared(b, theta, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function generateSpiralHoles({ bounds, alongStep, turnGap, spacing, holeAngle = 0 }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(alongStep > 0) || !(turnGap > 0)) return [];
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  const b = turnGap / TWO_PI;
  const maxRadius = Math.hypot(xMax - xMin, yMax - yMin) / 2;

  // The spiral crowds against itself near the origin: the perpendicular distance
  // between successive turns is turnGap·sin α with tan α = θ, so it only reaches
  // the full turnGap once the curve has unwound. Starting one pitch out leaves a
  // small open eye and holds the innermost pair within about 1% of the gap the
  // document asked for; starting at the origin loses a quarter of it.
  let theta = Math.max(alongStep, turnGap) / b;
  const holes = [];
  while (holes.length < MAX_SPIRAL_HOLES) {
    const radius = b * theta;
    if (radius > maxRadius) break;
    const x = cx + radius * Math.cos(theta),
      y = cy + radius * Math.sin(theta);
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
      holes.push(holeAngle ? { x, y, angle: holeAngle } : { x, y });
    }
    const step = alongStep * (spacing ? spacing.sample(x, y) : 1);
    if (!(step > 0)) break;
    const delta = deltaForChord(b, theta, step);
    if (!(delta > 0)) break;
    theta += delta;
  }
  return holes;
}
