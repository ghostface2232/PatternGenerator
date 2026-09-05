// Voronoi stone cracks: a Poisson-disk set of sites, each site's Voronoi cell
// clipped to the perforation boundary and then inset by half the edge gap. Two
// neighbouring cells share an edge and each pulls back by g/2 from it, so the
// metal left between them is exactly g — a constant ligament on a pattern that
// has no lattice at all, which is the whole appeal of the mode and the one
// property a stone-crack pattern otherwise makes hard to guarantee.
//
// The sites come from the same Bridson sampler the Scatter layout uses, seeded
// by the same `layout.scatter.seed`: the two modes are one point set drawn two
// different ways, so switching between them keeps the arrangement and Shuffle
// means the same thing in both.
//
// No triangulation. Each cell is built directly, by clipping a convex polygon
// with one half-plane per nearby site — no global structure that could disagree
// with the sampler about which points exist, and no dependency to carry. What
// "nearby" means is proved rather than assumed: see `reach` below.
//
// This is the only layout that hands each hole its own outline, in coordinates
// relative to its site. Everything downstream reads it through
// `holeOutline(hole)` and the SHAPES entry `Polygon` (geometry/shapes.js).
import { SpatialHash } from "../geometry/spatial-hash.js";
import { clipPolyHalfPlane, insetConvexPoly, isConvexPoly, polyArea, polyBBox, polyCentroid } from "../geometry/polygon.js"; // prettier-ignore
import { erodeRings, intersectPolygons } from "../geometry/offset.js";
import { ringsArea, ringsContains } from "../geometry/rings.js";
import { MAX_PACKING_DENSITY, generateScatterHoles } from "./scatter.js";

// Chords per rounded corner of the boundary. They cut just inside the true arc,
// so a cell clipped against them can never poke out past the boundary — the
// error is on the side that leaves metal, which is the only acceptable side.
const CORNER_SEGMENTS = 8;
// Past this the mode refuses outright rather than filling what it can, for the
// same reason Scatter does: the fill grows outward from the middle, so stopping
// at a cap leaves a disc of cells in a blank sheet, which reads as a broken
// pattern rather than as a limit. A fifth of Scatter's cap, because a cell costs
// a polygon clip against each of its neighbours where a scattered hole costs a
// point.
export const MAX_VORONOI_CELLS = 50_000;
// Cells below this survive the inset as numerical slivers rather than as
// geometry anyone could cut. In square millimetres, which makes it four orders
// of magnitude finer than the narrowest hole the sliders can describe.
const MIN_CELL_AREA = 1e-4;

// The perforation boundary as a convex polygon, which is the form the cell
// clipper needs. Rounded corners become chords; the circle fill mode does not
// reach here, since only Radial offers it.
export function boundaryPolygon({ xMin, xMax, yMin, yMax }, cornerRadius = 0) {
  const r = Math.min(Math.max(0, cornerRadius), (xMax - xMin) / 2, (yMax - yMin) / 2);
  if (!(r > 0)) {
    return [
      [xMin, yMin],
      [xMax, yMin],
      [xMax, yMax],
      [xMin, yMax],
    ];
  }
  const HALF = Math.PI / 2;
  // Clockwise on screen (y down), starting at the top of the top-right corner,
  // which is the winding `insetConvexPoly` and `isInsideConvexPoly` expect.
  const corners = [
    [xMax - r, yMin + r, -HALF],
    [xMax - r, yMax - r, 0],
    [xMin + r, yMax - r, HALF],
    [xMin + r, yMin + r, Math.PI],
  ];
  const verts = [];
  for (const [cx, cy, from] of corners) {
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = from + (HALF * i) / CORNER_SEGMENTS;
      const x = cx + Math.cos(a) * r,
        y = cy + Math.sin(a) * r;
      // At the full radius — a stadium, or a circle on a square panel — one
      // corner's last vertex IS the next one's first. A repeated vertex is a
      // zero-length edge, and `maxCornerRadius` reads one of those as "this
      // corner can take no radius at all", which quietly disabled the cell
      // corner slider for every cell that inherited the pair.
      const last = verts[verts.length - 1];
      if (last && Math.hypot(last[0] - x, last[1] - y) < 1e-9) continue;
      verts.push([x, y]);
    }
  }
  if (verts.length > 2 && Math.hypot(verts[0][0] - verts[verts.length - 1][0], verts[0][1] - verts[verts.length - 1][1]) < 1e-9) verts.pop(); // prettier-ignore
  return verts;
}

// One site's Voronoi cell, exactly.
//
// A site T can only cut this cell where the bisector of S and T reaches it, and
// the nearest point of that bisector to S is |ST|/2 away. So once every site
// within `reach` has been applied and no vertex of what is left is further than
// reach/2 from S, no site anywhere can cut it further and the cell is final.
// Failing that the reach doubles (at least to twice the furthest vertex) and the
// cell is rebuilt. The reach is capped at the boundary's own diameter, where
// every site there is has been considered and the answer is exact by exhaustion,
// so the loop always terminates — normally on the first pass.
function voronoiCell(siteIndex, sites, hash, frame, firstReach, limit) {
  const site = sites[siteIndex];
  let reach = Math.max(1e-6, Math.min(firstReach, limit));
  for (;;) {
    let cell = frame;
    hash.forEachNear(site.x, site.y, reach, index => {
      if (index === siteIndex || cell.length < 3) return false;
      const dx = sites[index].x - site.x,
        dy = sites[index].y - site.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-12) return false;
      // Keep the side closer to S: (p − midpoint)·(T − S) ≤ 0.
      const nx = dx / len,
        ny = dy / len;
      cell = clipPolyHalfPlane(cell, nx, ny, nx * (site.x + dx / 2) + ny * (site.y + dy / 2));
      return false;
    });
    if (cell.length < 3) return null;
    let far = 0;
    for (const [vx, vy] of cell) far = Math.max(far, Math.hypot(vx - site.x, vy - site.y));
    if (2 * far <= reach || reach >= limit) return cell;
    reach = Math.min(limit, Math.max(reach * 2, 2 * far));
  }
}

// One cell against a region that is not the plain rectangle: the part of it
// inside the region, eroded by half the gap, as the holes it leaves.
//
// The order is what the rectangle always did — clip, THEN inset — so a cell at
// the edge pulls back half the gap from the boundary as well as from its
// neighbours, and the metal rim round an ellipse or a cutout is the same width
// as every ligament. A cell wholly inside the region keeps the cheap convex
// route; one that straddles the outline goes through the polygon clipper, and
// its pieces (a cutout can cut a cell in two, or leave a bore through it) are
// eroded by the general route in geometry/offset.js. Each piece is a hole of
// its own, carrying its outline as a single ring where one ring says it all
// and as a ring list otherwise — see the Polygon entry in geometry/shapes.js.
function clipCellToRegion(cell, site, region, inset, holes) {
  const box = polyBBox(cell);
  const where = region.classifyBox(box.left, box.top, box.right, box.bottom);
  if (where === "outside") return;
  const pieces = where === "inside" ? [[cell]] : intersectPolygons([[cell]], region.polygons);
  for (const piece of pieces) {
    let eroded;
    if (piece.length === 1 && isConvexPoly(piece[0]))
      eroded = inset > 0 ? [[insetConvexPoly(piece[0], inset)]] : [piece[0].slice()].map(r => [r]); // prettier-ignore
    else eroded = erodeRings(piece, inset);
    for (const rings of eroded) {
      const kept = rings.filter(ring => ring.length >= 3);
      if (!kept.length || ringsArea(kept) < MIN_CELL_AREA) continue;
      // The hole's origin: the site when it is still in the piece's solid (not
      // in its bore, if a cutout left one), else a point that is — the outline
      // is stored relative to it, and the field controllers sample the hole
      // there. A vertex is the last resort, and is at least on the outline.
      const outer = kept[0];
      const solid = ([x, y]) => ringsContains(kept, x, y);
      const origin = [[site.x, site.y], polyCentroid(outer), ...outer].find(solid) ?? outer[0];
      const relative = kept.map(ring => ring.map(([x, y]) => [x - origin[0], y - origin[1]]));
      holes.push({ x: origin[0], y: origin[1], poly: relative.length === 1 ? relative[0] : relative });
    }
  }
}

export function generateVoronoiHoles({ bounds, cornerRadius = 0, region = null, minDist, gap, seed, spacing }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(minDist > 0)) return [];

  // Measured against the same packing bound the sampler uses, at the finest the
  // spacing field can ask for, so the refusal happens before a quarter of a
  // million cells are triangulated rather than after.
  const lowest = spacing ? Math.max(1e-6, spacing.min) : 1;
  const finest = minDist * lowest;
  if (MAX_PACKING_DENSITY * (xMax - xMin) * (yMax - yMin) > MAX_VORONOI_CELLS * finest * finest) return [];

  const sites = generateScatterHoles({ bounds, minDist, seed, spacing });
  if (sites.length < 1 || sites.length > MAX_VORONOI_CELLS) return [];

  // Against a region, the cells are built on the frame's plain rectangle and
  // clipped to the region afterwards; the rounded rectangle is the one outline
  // the half-plane clipper can take directly, and it always has.
  const frame = boundaryPolygon(bounds, region ? 0 : cornerRadius);
  const limit = Math.hypot(xMax - xMin, yMax - yMin);
  // Bridson stops only when no further dart fits, so every point of the sheet is
  // within one LOCAL radius of a site and a cell reaches about that far. Twice
  // the radius the field asks for AT THIS SITE is therefore a first reach that
  // usually finishes the cell in one pass, and the loop above is exact whether
  // it does or not.
  //
  // At this site, not the coarsest anywhere on the sheet: a field spanning the
  // slider's full 0.2× to 4× made every cell in the dense majority query at the
  // radius the sparse corner needed, which is (max/min)² times the area and was
  // 85 million half-plane clips where a Voronoi cell has six neighbours. One
  // 1000 mm document went from 1.3 s to 37 s on the strength of a second
  // controller that barely changed the pattern.
  const firstReach = (x, y) => minDist * (spacing ? Math.max(1e-6, spacing.sample(x, y)) : 1) * 2;
  const hash = new SpatialHash(minDist * Math.sqrt(lowest));
  sites.forEach((site, index) => hash.insert(site.x, site.y, index));

  const inset = Math.max(0, gap || 0) / 2;
  const holes = [];
  for (let i = 0; i < sites.length; i++) {
    const cell = voronoiCell(i, sites, hash, frame, firstReach(sites[i].x, sites[i].y), limit);
    if (!cell) continue;
    if (region) {
      clipCellToRegion(cell, sites[i], region, inset, holes);
      continue;
    }
    const kept = insetConvexPoly(cell, inset);
    if (kept.length < 3 || polyArea(kept) < MIN_CELL_AREA) continue;
    const site = sites[i];
    holes.push({ x: site.x, y: site.y, poly: kept.map(([x, y]) => [x - site.x, y - site.y]) });
  }
  return holes;
}
