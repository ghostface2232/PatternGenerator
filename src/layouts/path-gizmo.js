// Handles, hit testing and edits for the Path layout's curves. Pure, in sheet
// millimetres, like the variation and controller gizmos — the canvas turns
// pointer positions into millimetres and hands them here, and nothing in this
// file knows what a pixel is except through the scale it is given.
import { clamp } from "../core/math.js";
import { DOC_LIMITS, MAX_PATHS, MAX_PATH_POINTS } from "../core/constants.js";
import { distPointSeg } from "../geometry/polygon.js";
import { lockAnchor, lockAngleFrom, lockDelta, nearestSpan } from "../geometry/snap.js";
import { defaultPathPoints, flattenPath, spanSegments } from "./path.js";

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

// Shift locks the vertex to 45° from its neighbour, at a whole number of
// millimetres — the same idiom as the controller gizmo.
export function movePathVertex(paths, pathIndex, pointIndex, x, y, shift = false) {
  return paths.map((path, i) => {
    if (i !== pathIndex) return path;
    const target = shift ? lockAngleFrom(lockAnchor(path.points, pointIndex, path.closed), x, y) : { x, y };
    return {
      ...path,
      points: path.points.map((point, j) =>
        j !== pointIndex ? point : { x: clampCoord(target.x), y: clampCoord(target.y) }
      ),
    };
  });
}

// The whole curve moved by (dx, dy), for dragging it by its body. Shift
// constrains the move to the axes and diagonals.
export function translatePath(paths, pathIndex, dx, dy, shift = false) {
  const delta = shift ? lockDelta(dx, dy) : { dx, dy };
  return paths.map((path, i) =>
    i !== pathIndex
      ? path
      : { ...path, points: path.points.map(p => ({ x: clampCoord(p.x + delta.dx), y: clampCoord(p.y + delta.dy) })) }
  );
}

// A vertex put where the pointer is, on the span of the drawn curve nearest to
// it — a double-click on the curve, as in Figma. The span is found on the
// FLATTENED curve, since that is what is on screen, and mapped back to the
// authored span it belongs to. Null when the curve is full or the pointer is
// further than `tolerance` from it.
export function insertPathVertexAt(path, x, y, smooth, tolerance = Infinity) {
  if (path.points.length >= MAX_PATH_POINTS || path.points.length < 2) return null;
  const poly = flattenPath(path.points, { closed: path.closed, smooth });
  const hit = nearestSpan(poly, x, y);
  if (!hit || hit.distance > tolerance) return null;
  // Which authored span does that flattened segment fall in? The flattening
  // emits a segment count PER SPAN that depends on the span's length
  // (`spanSegments`), so walk the same counts back rather than assuming an
  // even share: a short span beside a long one would otherwise send the vertex
  // to the wrong span and fold the curve back on itself.
  const n = path.points.length;
  const spans = path.closed ? n : n - 1;
  let at = spans - 1;
  if (smooth) {
    let consumed = 0;
    for (let i = 0; i < spans; i++) {
      consumed += spanSegments(path.points[i], path.points[(i + 1) % n]);
      if (hit.index < consumed) {
        at = i;
        break;
      }
    }
  } else at = Math.min(spans - 1, hit.index);
  const points = path.points.slice();
  points.splice(at + 1, 0, { x: clampCoord(hit.x), y: clampCoord(hit.y) });
  return { ...path, points };
}

// One named vertex removed — a double-click on it. Two is the floor.
export function removePathVertexAt(path, pointIndex) {
  if (path.points.length <= 2 || pointIndex < 0 || pointIndex >= path.points.length) return null;
  return { ...path, points: path.points.filter((_, i) => i !== pointIndex) };
}

// The pen: a vertex appended after the curve's last one. Shift locks it to 45°
// from that one. Null when the curve is full.
export function appendPathVertex(path, x, y, shift = false) {
  if (path.points.length >= MAX_PATH_POINTS) return null;
  const last = path.points[path.points.length - 1];
  const target = shift && last ? lockAngleFrom(last, x, y) : { x, y };
  return { ...path, points: [...path.points, { x: clampCoord(target.x), y: clampCoord(target.y) }] };
}

// A curve started by the pen, from its first two clicks. The first click alone
// is held in UI state rather than written: a one-vertex path is not a curve,
// and `validateDocument` would drop it on reload.
export function startPath(a, b) {
  return {
    points: [
      { x: clampCoord(a.x), y: clampCoord(a.y) },
      { x: clampCoord(b.x), y: clampCoord(b.y) },
    ],
    closed: false,
  };
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
