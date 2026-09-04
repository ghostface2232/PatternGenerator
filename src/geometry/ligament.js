// Overlap detection and minimum ligament (narrowest bridge of material between
// two holes). Both use a coarse spatial hash so only nearby holes are compared.
import { PERF_MODE_HOLE_LIMIT } from "../core/constants.js";
import { calcShapeGap, checkShapeOverlap } from "./shapes.js";

function bucketize(holes, gridSize) {
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  return grid;
}

function forEachNeighbourPair(holes, gridSize, visit) {
  const grid = bucketize(holes, gridSize);
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i) visit(i, j);
      }
    }
  });
}

// Indices (into `holes`) of every hole that overlaps at least one neighbour.
export function findOverlaps(holes, shape) {
  const overlaps = new Set();
  if (holes.length > PERF_MODE_HOLE_LIMIT) return overlaps;
  const gridSize = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  forEachNeighbourPair(holes, gridSize, (i, j) => {
    if (checkShapeOverlap(holes[i], holes[j], shape)) { overlaps.add(i); overlaps.add(j); }
  });
  return overlaps;
}

// Smallest edge-to-edge clearance across all neighbouring pairs (clamped at 0),
// or null when it cannot be computed (fewer than 2 holes, or performance mode).
export function calcMinLigament(holes, shape, nominalSpacing = 0) {
  if (holes.length < 2 || holes.length > PERF_MODE_HOLE_LIMIT) return null;
  let minGap = Infinity;
  const maxExtent = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const gridSize = Math.max(maxExtent * 2, nominalSpacing * 1.5);
  forEachNeighbourPair(holes, gridSize, (i, j) => {
    const g = calcShapeGap(holes[i], holes[j], shape);
    if (g < minGap) minGap = g;
  });
  return minGap === Infinity ? null : Math.max(0, minGap);
}
