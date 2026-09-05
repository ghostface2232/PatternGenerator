// Random Scatter: Bridson Poisson-disk sampling with a radius the spacing field
// varies across the sheet.
//
// Every draw comes from a generator seeded by `layout.scatter.seed`, so the
// pattern is a function of the document like every other layout here: reload it,
// share it, export it, and the same holes are in the same places. Nothing in
// this file reads Math.random.
//
// The guarantee it makes is `distance(i, j) ≥ min(r_i, r_j)`, where r is the
// minimum centre distance the spacing field asks for at that point. A candidate
// is accepted only when nothing already placed lies within ITS OWN radius, and
// since min(r_i, r_j) ≤ r_later ≤ distance, the pair is covered whichever of the
// two was placed second. With no spacing field every r is the same and this
// reduces to the usual "no two centres closer than minDist", i.e. the minimum
// ligament is at least the configured edge gap — which is what layouts.test.js
// checks.
//
// `min` rather than `max` is the deliberate choice for the mixed case. Under
// max, a sparse point would cast a shadow that no dense point could enter, and
// the boundary between two densities would open into a visible seam; under min,
// the dense side simply packs up to the edge of the sparse one, which is what a
// density gradient should look like.
import { mulberry32 } from "../core/rng.js";
import { SpatialHash } from "../geometry/spatial-hash.js";

const TAU = Math.PI * 2;
// Candidate darts per active point — Bridson's k. Thirty is the usual value:
// below about twenty the packing visibly loosens, above it the cost rises
// without changing the result.
const CANDIDATES = 30;
// Past this the mode refuses outright rather than filling what it can. The fill
// grows outward from the middle, so stopping at a cap leaves a disc of holes in
// a blank sheet — which reads as a broken pattern, not as a limit. Every other
// layout here is closed-form and can afford the sliders' full range; a
// dart-throwing sampler cannot, and this is roughly a square metre at a 2.2 mm
// centre distance, well past any panel a person would draw this way.
export const MAX_SCATTER_HOLES = 250_000;
// Discs of radius r/2 pack at most π/(2√3) of the plane, so no dart-throwing can
// place more than this many centres per unit area at minimum distance r. The
// bound is what the refusal above is measured against; Bridson in practice lands
// around 0.7/r², well under it. The Voronoi layout draws its sites from this same
// sampler and measures its own, lower cap against the same bound.
export const MAX_PACKING_DENSITY = 1.16;

export function generateScatterHoles({ bounds, minDist, seed, spacing, holeAngle = 0 }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(minDist > 0)) return [];

  const lowest = spacing ? spacing.min : 1;
  const finest = minDist * Math.max(1e-6, lowest);
  if (MAX_PACKING_DENSITY * (xMax - xMin) * (yMax - yMin) > MAX_SCATTER_HOLES * finest * finest) return [];
  const radiusAt = spacing ? (x, y) => minDist * spacing.sample(x, y) : () => minDist;
  // Only speed depends on this: every query rounds its own radius up to whole
  // cells, so a cell smaller or larger than ideal changes how much of the map is
  // walked and nothing else.
  //
  // A cell of r/√2 holds at most one point and is the textbook choice, but there
  // is no single r here: the field spans `spacing.min` to `spacing.max`, and a
  // document can use the whole range. Sizing to the minimum makes a query in the
  // SPARSE part of the sheet walk hundreds of empty cells (a controller reaching
  // over a twentieth of a large panel cost twenty-seven seconds that way);
  // sizing to the neutral value makes a query in the DENSE part test dozens of
  // points per cell. The geometric mean of the two splits the difference, and
  // neither end degrades worse than quadratically from it. `spacing.max` is
  // deliberately not in this: a sparse REGION is cheap however it is sized,
  // because it holds few points to query from.
  const hash = new SpatialHash((minDist * Math.sqrt(lowest)) / Math.SQRT2);
  const random = mulberry32(seed);
  const points = [];
  const active = [];

  const place = (x, y, r) => {
    hash.insert(x, y, points.length);
    active.push(points.length);
    points.push({ x, y, r });
  };
  const conflicts = (x, y, r) =>
    hash.forEachNear(x, y, r, index => {
      const other = points[index];
      const dx = x - other.x,
        dy = y - other.y;
      return dx * dx + dy * dy < r * r;
    });

  // A fixed first point rather than a random one: the seed decides the pattern,
  // and the pattern should not also depend on which corner the fill started in.
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  place(cx, cy, radiusAt(cx, cy));

  while (active.length > 0 && points.length < MAX_SCATTER_HOLES) {
    const slot = Math.floor(random() * active.length);
    const from = points[active[slot]];
    let placed = false;
    for (let attempt = 0; attempt < CANDIDATES && !placed; attempt++) {
      const angle = random() * TAU;
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      // The annulus is normally [r, 2r) of the point being grown from. Where the
      // field asks for a LARGER radius further out, that annulus lands entirely
      // inside the candidate's own exclusion disc and every dart is rejected —
      // the fill stalls at the foot of the gradient and the sparse side of the
      // sheet stays empty. Probing outward first lets the annulus grow to meet
      // the radius it is heading into. Two steps handle any gradient the field
      // can produce over one hole pitch; a third changes nothing measurable.
      let reach = from.r;
      for (let step = 0; step < 2; step++) {
        const ahead = radiusAt(from.x + cos * reach, from.y + sin * reach);
        if (ahead <= reach) break;
        reach = ahead;
      }
      const distance = reach * (1 + random());
      const x = from.x + cos * distance,
        y = from.y + sin * distance;
      if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
      const r = radiusAt(x, y);
      if (conflicts(x, y, r)) continue;
      place(x, y, r);
      placed = true;
    }
    if (!placed) {
      // Retire the point: swapping with the last keeps the removal O(1) and,
      // unlike splice, leaves the order a deterministic function of the seed.
      active[slot] = active[active.length - 1];
      active.pop();
    }
  }

  return points.map(({ x, y }) => (holeAngle ? { x, y, angle: holeAngle } : { x, y }));
}
