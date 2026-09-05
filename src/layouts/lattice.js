// Filling a rectangle with the points of a two-dimensional lattice
// `origin + i·u + j·v`, whatever direction the basis vectors point in.
//
// Two layouts need exactly this and got it wrong in different ways before it was
// one function: the Diamond rhombus lattice (a sheared basis) and Cross-hatch
// (the intersections of two rotated line families). Walking i and j over a range
// derived from the sheet's width and height only works for an axis-aligned
// basis; a 45° basis has to walk the pre-image of the rectangle's corners
// instead, which is what this does.

// A basis whose determinant is small relative to the region describes a lattice
// with more points than any sheet could hold — the far end of two nearly
// parallel line families. Every caller has a reason of its own to refuse that
// case, but this is the backstop that stops a slider drag from hanging the tab.
export const MAX_LATTICE_POINTS = 4_000_000;

// Visits `visit(x, y, i, j)` for every lattice point inside `bounds`, and
// returns how many it visited — or -1 without visiting anything when the basis
// is degenerate or the lattice is too fine for the region.
export function forEachLatticePoint(originX, originY, u, v, bounds, visit) {
  const det = u[0] * v[1] - u[1] * v[0];
  if (!Number.isFinite(det) || det === 0) return -1;
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin)) return -1;
  // One lattice point per |det| of area, so this is the count before the walk.
  if ((xMax - xMin) * (yMax - yMin) > MAX_LATTICE_POINTS * Math.abs(det)) return -1;

  let iMin = Infinity,
    iMax = -Infinity,
    jMin = Infinity,
    jMax = -Infinity;
  for (const [bx, by] of [
    [xMin, yMin],
    [xMax, yMin],
    [xMin, yMax],
    [xMax, yMax],
  ]) {
    const dx = bx - originX,
      dy = by - originY;
    const fi = (dx * v[1] - dy * v[0]) / det;
    const fj = (u[0] * dy - u[1] * dx) / det;
    iMin = Math.min(iMin, fi);
    iMax = Math.max(iMax, fi);
    jMin = Math.min(jMin, fj);
    jMax = Math.max(jMax, fj);
  }
  if (!Number.isFinite(iMin) || !Number.isFinite(jMin)) return -1;

  let count = 0;
  for (let j = Math.floor(jMin) - 1; j <= Math.ceil(jMax) + 1; j++) {
    for (let i = Math.floor(iMin) - 1; i <= Math.ceil(iMax) + 1; i++) {
      const x = originX + i * u[0] + j * v[0];
      const y = originY + i * u[1] + j * v[1];
      if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
      visit(x, y, i, j);
      count++;
    }
  }
  return count;
}
