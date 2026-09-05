// Fibonacci (Vogel / sunflower): hole n sits at the golden angle n·137.508° and
// a radius that grows so each hole claims the same area. Promoted here from the
// Radial mode's "Sunflower" sub-layout, which stays where it is: this one fills
// the perforation rectangle like the other top-level modes and reads the spacing
// channel, that one keeps its rings-and-gaps vocabulary.
//
// The classic form is r = c·√n. Written as the recurrence
//
//   r₀ = 0,   r_{n}² = r_{n−1}² + c²
//
// it is the same sequence — and now c can vary from hole to hole, because
// c² IS the area each hole claims. So scaling c by the spacing field at the
// previous hole makes the local density follow the field exactly, and with no
// field at all the recurrence reproduces c·√n to the last bit.

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// The nearest-neighbour distance of the Fermat point set is a little above 1.6·c
// for every n ≥ 1, so scaling by the lower bound keeps the requested edge gap
// intact. Shared with radial-engine.js, which needs the same constant for the
// same reason.
export const FERMAT_SAFE_SEPARATION = 1.6;
// More holes than this and the mode refuses outright — see the note in
// spiral.js, which faces the same choice for the same reason.
export const MAX_FIBONACCI_HOLES = 1_000_000;

export function generateFibonacciHoles({ bounds, spacing: field, minSpacing, holeAngle = 0 }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(minSpacing > 0)) return [];
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  const scale = minSpacing / FERMAT_SAFE_SEPARATION;
  const maxRadius = Math.hypot(xMax - xMin, yMax - yMin) / 2;

  // c² is the area each hole claims, so the disc the walk covers divided by the
  // smallest c the field can ask for is an upper bound on the holes it will
  // place. Refuse above the cap rather than stopping part-way: the walk grows
  // outward, so a truncated Fermat spiral is a disc of holes in the middle of a
  // blank sheet, which reads as a broken pattern rather than as a limit.
  const finest = scale * (field ? Math.max(1e-6, field.min) : 1);
  if (Math.PI * maxRadius * maxRadius > MAX_FIBONACCI_HOLES * finest * finest) return [];

  const holes = [];
  // Tracked as r² so the recurrence above is a plain sum and never takes a
  // square root of a value the previous step just squared.
  let radiusSq = 0;
  let x = cx,
    y = cy;
  for (let n = 1; holes.length < MAX_FIBONACCI_HOLES; n++) {
    const local = scale * (field ? field.sample(x, y) : 1);
    // Every other walk in the layouts guards its step; this one has to as well.
    // A sampler returning 0 or NaN leaves radiusSq where it was, so `radius >
    // maxRadius` never fires, nothing is pushed, and the hole cap in the loop
    // header is never reached either — a hang rather than an empty pattern.
    if (!(local > 0)) break;
    radiusSq += local * local;
    const radius = Math.sqrt(radiusSq);
    if (radius > maxRadius) break;
    // −π/2 puts hole 1 straight up, matching the Radial Sunflower layout.
    const angle = n * GOLDEN_ANGLE - Math.PI / 2;
    x = cx + radius * Math.cos(angle);
    y = cy + radius * Math.sin(angle);
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
      holes.push(holeAngle ? { x, y, angle: holeAngle } : { x, y });
    }
  }
  return holes;
}
