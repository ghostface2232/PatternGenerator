// A uniform-grid spatial hash over points in sheet millimetres.
//
// Two very different callers need the same structure, which is why it lives here
// rather than inside either of them:
//
//   layouts/scatter.js   asks "is anything already within r of this candidate?"
//                        millions of times while a Poisson-disk pattern grows
//   geometry/ligament.js walks every neighbouring pair to find the narrowest
//                        bridge and the overlaps
//
// The grid is a Map keyed by cell, so memory follows the number of points rather
// than the area of the sheet: a 1000 mm panel of 0.5 mm holes would need tens of
// millions of dense-array cells and needs none of them here.
//
// Correctness never depends on the cell size — every query rounds its radius up
// to whole cells and the caller still does the exact distance test. The cell
// size only decides how much of the map a query walks, so an approximate guess
// at the typical spacing is a perfectly good one.

// Cell indices are packed into one number instead of a "gx,gy" string, which is
// what this replaced: the scatter sampler makes millions of lookups and building
// a string for each dominated its cost. ±2²⁰ cells reach 1 km at a 1 mm cell —
// far outside anything DOC_LIMITS can describe — and indices are clamped rather
// than allowed to wrap, so a point beyond that shares a cell with the rim
// instead of colliding with one on the far side.
const SPAN = 1 << 20;
const STRIDE = 2 * SPAN + 1;
const clampIndex = i => (i < -SPAN ? -SPAN : i > SPAN ? SPAN : i);
const cellKey = (gx, gy) => (clampIndex(gx) + SPAN) * STRIDE + (clampIndex(gy) + SPAN);

export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = Math.max(1e-6, cellSize);
    this.cells = new Map();
  }

  insert(x, y, value) {
    const key = cellKey(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(value);
    else this.cells.set(key, [value]);
  }

  // Visit every value stored in a cell that the query square [x±radius, y±radius]
  // touches — a superset of the values within `radius`, so the caller measures.
  // `visit` may return true to stop the walk early, which is what the scatter
  // sampler does the moment it finds one conflict.
  forEachNear(x, y, radius, visit) {
    const size = this.cellSize;
    const gx0 = Math.floor((x - radius) / size),
      gx1 = Math.floor((x + radius) / size);
    const gy0 = Math.floor((y - radius) / size),
      gy1 = Math.floor((y + radius) / size);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const bucket = this.cells.get(cellKey(gx, gy));
        if (!bucket) continue;
        for (const value of bucket) {
          if (visit(value) === true) return true;
        }
      }
    }
    return false;
  }
}

// Every pair of points whose cells touch, each pair visited once as (i, j) with
// j > i. Pairs further apart than one cell are never visited, so `cellSize` has
// to be at least as large as the interaction distance the caller cares about.
export function forEachNeighbourPair(points, cellSize, visit) {
  const hash = new SpatialHash(cellSize);
  points.forEach((point, index) => hash.insert(point.x, point.y, index));
  points.forEach((point, i) => {
    hash.forEachNear(point.x, point.y, hash.cellSize, j => {
      if (j > i) visit(i, j);
    });
  });
}
