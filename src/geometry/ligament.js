// Overlap detection and minimum ligament (narrowest bridge of material between
// two holes). Both use a coarse spatial hash so only nearby holes are compared.
import { PERF_MODE_HOLE_LIMIT } from "../core/constants.js";
import { forEachNeighbourPair } from "./spatial-hash.js";
import { calcShapeGap, checkShapeOverlap, getShape, holeOutline, holeVertices } from "./shapes.js";
import { segmentClearance } from "./stroke.js";

// A hole that is a curve rather than a blob — a Flow Lines slot — breaks the
// assumption both searches below rest on: that a hole's bounding box locates it.
// A slot's box can be the whole panel, so every pair looks like a neighbour and
// none of them can be rejected by a bounding circle.
//
// The fix is to search the SEGMENTS instead. Each is short (the integration step)
// and local, so one grid over them finds the same neighbours the point search
// finds for ordinary holes, at the same cost — and the clearance between two
// slots is by definition the clearance between their closest pair of segments.
function collectSegments(holes, shape) {
  const segmentsOf = getShape(shape).segments;
  if (!segmentsOf) return null;
  const segments = [];
  let longest = 0,
    widest = 0;
  holes.forEach((hole, index) => {
    for (const segment of segmentsOf(hole, holeOutline(hole))) {
      longest = Math.max(longest, Math.hypot(segment.bx - segment.ax, segment.by - segment.ay));
      widest = Math.max(widest, segment.r);
      segments.push({ ...segment, hole: index, x: (segment.ax + segment.bx) / 2, y: (segment.ay + segment.by) / 2 });
    }
  });
  return { segments, longest, widest };
}

// Every pair of segments from DIFFERENT holes whose clearance could be below
// `within`, at a grid sized for exactly that question.
//
// Midpoints are what the grid holds, so two segments whose capsules come within
// `within` of each other are at most `within + both widths + one segment` apart
// at their middles — that is the bound, and it is why the caller has to say what
// distance it cares about. The old spelling passed the layout's nominal spacing
// instead, which is neither an upper bound (it does not track the spacing field)
// nor a cheap one: on a 200 mm panel of 1 mm slots it made every cell hold about
// 150 segments and cost 6.8 s in the ligament search and another 7.1 s in the
// overlap search, on a pattern of 199 holes that nothing downstream throttles.
function forEachSegmentPair({ segments, longest, widest }, within, visit) {
  const cellSize = Math.max(0.001, Math.max(0, within) + 2 * widest + longest);
  forEachNeighbourPair(segments, cellSize, (i, j) => {
    const a = segments[i],
      b = segments[j];
    // A slot is not measured against itself. It is ONE continuous cut, so two
    // pieces of it never have metal between them — the space is filled by the
    // rest of the slot, which a pairwise test of two capsules cannot see: two
    // pieces 8 mm apart along a nearly straight line read as 2.73 mm of
    // "ligament" through the middle of a 3 mm one. Keeping a line away from
    // itself is the generator's job and it does it (flowlines.js), the same way
    // no other shape here measures its own two ends against each other.
    if (a.hole === b.hole) return;
    // One hypot to reject a pair the exact test would only confirm is far: the
    // same bounding-circle bound the point search uses, with the segment's own
    // half length standing in for its extent.
    if (Math.hypot(b.x - a.x, b.y - a.y) - longest - a.r - b.r > within) return;
    visit(a, b);
  });
}

// The diagonal of everything in a list, which is the distance past which a
// neighbour search has visited every pair there is.
function extentOf(items) {
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const item of items) {
    if (item.x < xMin) xMin = item.x;
    if (item.x > xMax) xMax = item.x;
    if (item.y < yMin) yMin = item.y;
    if (item.y > yMax) yMax = item.y;
  }
  return Math.hypot(xMax - xMin, yMax - yMin);
}

// A radius about each hole's own origin that contains the whole of it, so that
// `distance − reachᵢ − reachⱼ` is a lower bound on the clearance between two
// holes, computable in one hypot.
//
// Both searches below are grids of candidate pairs refined by an exact test, and
// the exact test is the expensive half — for a polygon it is every vertex of one
// against every edge of the other, twice over. The Voronoi cells are where that
// bites: their outlines carry a dozen vertices each, the grid has to be sized
// for the largest cell on the sheet, and most of the pairs it then visits are
// nowhere near touching. The bound rejects those without measuring them.
//
// A hole with no polygon outline falls back to the half-diagonal of its w × h
// box, which contains every shape here at any rotation.
function holeReaches(holes, shape) {
  return holes.map(hole => {
    const verts = holeVertices(hole, shape);
    if (!verts?.length) return Math.hypot(hole.w, hole.h) / 2;
    let reach = 0;
    for (const [x, y] of verts) reach = Math.max(reach, Math.hypot(x - hole.x, y - hole.y));
    return reach;
  });
}

// How far apart the holes actually are, from the holes themselves. The layout
// modes each report a nominal pitch, but Scatter, Spiral and Fibonacci can be
// spread several times further apart than their nominal figure wherever a
// spacing controller thins them out — and a search grid narrower than the real
// neighbour distance finds no pairs at all, which reads as "no ligament" rather
// than as a wide one.
//
// Two bounds on the closest pair, because neither covers the other. For n points
// in a box of area A the closest pair is at most about 1.075·√(A/n), so √(A/n)
// with the caller's ×2 covers any spread-out set. That bound says nothing when
// the box is flat — a row of holes along one line has zero area — so the second
// takes the box's longer side over the gaps between n points, which is exact for
// a collinear set and slack (harmlessly) otherwise. Two holes on one row of a
// spiral, 85 mm apart on a 200×15 sheet, reported no ligament under the first
// bound alone.
function neighbourDistanceFloor(holes) {
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const hole of holes) {
    if (hole.x < xMin) xMin = hole.x;
    if (hole.x > xMax) xMax = hole.x;
    if (hole.y < yMin) yMin = hole.y;
    if (hole.y > yMax) yMax = hole.y;
  }
  const width = Math.max(0, xMax - xMin),
    height = Math.max(0, yMax - yMin);
  const spread = Math.sqrt((width * height) / holes.length);
  const along = Math.max(width, height) / Math.max(1, holes.length - 1);
  return Math.max(spread, along);
}

// Indices (into `holes`) of every hole that overlaps at least one neighbour.
export function findOverlaps(holes, shape) {
  const overlaps = new Set();
  if (holes.length > PERF_MODE_HOLE_LIMIT) return overlaps;
  const curved = collectSegments(holes, shape);
  if (curved) {
    // Overlap is a clearance below zero, so the interaction distance is zero and
    // the grid can be as small as the segments themselves.
    forEachSegmentPair(curved, 0, (p, q) => {
      if (segmentClearance(p, q) < -0.001) {
        overlaps.add(p.hole);
        overlaps.add(q.hole);
      }
    });
    return overlaps;
  }
  const gridSize = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const reach = holeReaches(holes, shape);
  forEachNeighbourPair(holes, gridSize, (i, j) => {
    const a = holes[i],
      b = holes[j];
    if (Math.hypot(b.x - a.x, b.y - a.y) - reach[i] - reach[j] > 0) return;
    if (checkShapeOverlap(a, b, shape)) {
      overlaps.add(i);
      overlaps.add(j);
    }
  });
  return overlaps;
}

// Smallest edge-to-edge clearance across all neighbouring pairs (clamped at 0),
// or null when it cannot be computed (fewer than 2 holes, or performance mode).
export function calcMinLigament(holes, shape, nominalSpacing = 0) {
  if (holes.length < 2 || holes.length > PERF_MODE_HOLE_LIMIT) return null;
  let minGap = Infinity;
  const curved = collectSegments(holes, shape);
  if (curved) {
    // The narrowest bridge is not known before the search, so the distance the
    // grid is sized for is PROVED rather than guessed: search at one, and if the
    // answer that comes back is inside it, no pair the grid left out could have
    // beaten it. Otherwise widen and search again. Dense patterns — the ones
    // where the cost is — settle on the first pass; only a sparse one grows, and
    // a sparse one is cheap. Capped at the extent of the whole set, where every
    // pair has been visited and the answer is exact by exhaustion, so the loop
    // always ends.
    if (curved.segments.length < 2) return null;
    const span = extentOf(curved.segments);
    for (let within = Math.max(1e-6, curved.longest + 2 * curved.widest); ; within *= 4) {
      minGap = Infinity;
      forEachSegmentPair(curved, within, (p, q) => {
        const g = segmentClearance(p, q);
        if (g < minGap) minGap = g;
      });
      if (minGap <= within || within >= span) return minGap === Infinity ? null : Math.max(0, minGap);
    }
  }
  const maxExtent = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const gridSize = Math.max(maxExtent * 2, nominalSpacing * 1.5, neighbourDistanceFloor(holes) * 2);
  const reach = holeReaches(holes, shape);
  forEachNeighbourPair(holes, gridSize, (i, j) => {
    const a = holes[i],
      b = holes[j];
    // Only pairs that could still beat the narrowest bridge found so far are
    // measured exactly. The bound is a lower one, so a pair it skips was never
    // the answer — the result is the same figure, reached without the work.
    if (Math.hypot(b.x - a.x, b.y - a.y) - reach[i] - reach[j] >= minGap) return;
    const g = calcShapeGap(a, b, shape);
    if (g < minGap) minGap = g;
  });
  return minGap === Infinity ? null : Math.max(0, minGap);
}
