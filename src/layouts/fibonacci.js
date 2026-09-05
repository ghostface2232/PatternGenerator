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
export const MAX_FIBONACCI_HOLES = 150_000;

export function generateFibonacciHoles({ bounds, spacing: field, minSpacing, holeAngle = 0 }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(minSpacing > 0)) return [];
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  const scale = minSpacing / FERMAT_SAFE_SEPARATION;
  const maxRadius = Math.hypot(xMax - xMin, yMax - yMin) / 2;

  const holes = [];
  // Tracked as r² so the recurrence above is a plain sum and never takes a
  // square root of a value the previous step just squared.
  let radiusSq = 0;
  let x = cx,
    y = cy;
  for (let n = 1; holes.length < MAX_FIBONACCI_HOLES; n++) {
    const local = scale * (field ? field.sample(x, y) : 1);
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
