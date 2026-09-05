// Overlap detection and minimum ligament (narrowest bridge of material between
// two holes). Both use a coarse spatial hash so only nearby holes are compared.
import { PERF_MODE_HOLE_LIMIT } from "../core/constants.js";
import { forEachNeighbourPair } from "./spatial-hash.js";
import { calcShapeGap, checkShapeOverlap, holeVertices } from "./shapes.js";

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
