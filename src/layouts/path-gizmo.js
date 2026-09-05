// Handles, hit testing and edits for the Path layout's curves. Pure, in sheet
// millimetres, like the variation and controller gizmos — the canvas turns
// pointer positions into millimetres and hands them here, and nothing in this
// file knows what a pixel is except through the scale it is given.
import { clamp } from "../core/math.js";
import { DOC_LIMITS, MAX_PATHS, MAX_PATH_POINTS } from "../core/constants.js";
import { distPointSeg } from "../geometry/polygon.js";
import { defaultPathPoints, flattenPath } from "./path.js";

const COORD = DOC_LIMITS["layout.path.coord"];
// Everything a canvas drag writes is clamped to the same range validateDocument
// uses, or the editor cannot read back its own output: a vertex dragged far
// enough at a zoomed-out view would come back somewhere else after a reload,
// with no undo step pointing at where it had been.
const clampCoord = value => clamp(value, COORD[0], COORD[1]);

// The vertex under the cursor, or null. `tolerancePx` is in screen pixels, so
// the handles stay the same size to grab however far the view is zoomed.
export function hitTestPath(paths, x, y, baseScale, tolerancePx = 14) {
  const tolerance = tolerancePx / Math.max(1e-6, baseScale);
  let best = null,
    bestDistance = tolerance;
  paths.forEach((path, pathIndex) => {
    path.points.forEach((point, pointIndex) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { pathIndex, pointIndex };
      }
    });
  });
  return best;
}

// Distance from a point to a path's drawn curve, for picking one path out of
// several. Measured on the flattened curve, which is what the canvas shows.
export function pathBodyDistance(path, x, y, smooth) {
  const poly = flattenPath(path.points, { closed: path.closed, smooth });
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    best = Math.min(best, distPointSeg(x, y, poly[i - 1].x, poly[i - 1].y, poly[i].x, poly[i].y));
  }
  return best;
}

export function movePathVertex(paths, pathIndex, pointIndex, x, y) {
  return paths.map((path, i) =>
    i !== pathIndex
      ? path
      : {
          ...path,
          points: path.points.map((point, j) => (j !== pointIndex ? point : { x: clampCoord(x), y: clampCoord(y) })),
        }
  );
}

// A new vertex at the midpoint of the longest span, which is where a curve has
// the least detail and so where another point is most likely to be wanted.
export function addPathVertex(path) {
  if (path.points.length >= MAX_PATH_POINTS) return null;
  const spans = path.closed ? path.points.length : path.points.length - 1;
  let at = 0,
    longest = -1;
  for (let i = 0; i < spans; i++) {
    const a = path.points[i],
      b = path.points[(i + 1) % path.points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > longest) {
      longest = length;
      at = i;
    }
  }
  const a = path.points[at],
    b = path.points[(at + 1) % path.points.length];
  const points = path.points.slice();
  points.splice(at + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return { ...path, points };
}

// Drop the last vertex. Two is the floor: one point is not a curve, and the
// generator would place a single hole and call it a path.
export function removePathVertex(path) {
  if (path.points.length <= 2) return null;
  return { ...path, points: path.points.slice(0, -1) };
}

// A new curve for `area` ({ x, y, w, h } in sheet mm — normally the perforation
// bounds). The first one copies the default the layout draws when the list is
// empty, so pressing Add Path makes that curve editable instead of replacing it
// with a different one; later ones are offset so they do not land on top of it.
export function newPath(area, existing = []) {
  const bounds = { xMin: area.x, xMax: area.x + area.w, yMin: area.y, yMax: area.y + area.h };
  const points = defaultPathPoints(bounds);
  if (existing.length === 0) return { points, closed: false };
  const shift = ((existing.length % MAX_PATHS) * area.h) / 12;
  return { points: points.map(p => ({ x: p.x, y: clampCoord(p.y + shift) })), closed: false };
}
