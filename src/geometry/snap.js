// Snapping shared by every on-canvas editor: the millimetre grid a position
// lands on while Shift is held, and the 45° lock a segment takes when one of
// its ends is dragged with Shift — the idiom Figma and Illustrator use, where
// Shift on a vector point locks the segment to the previous point at a
// multiple of 45° while the distance stays under the cursor.
//
// Pure, in sheet (or design) millimetres. The variation gizmo keeps its own
// panel-fraction snaps in fields/gizmo.js; everything drawn in millimetres
// snaps through here.

export const SNAP_GRID_MM = 1;
export const SNAP_ANGLE_DEG = 45;

// The nearest multiple of `step`.
export const snapTo = (value, step) => Math.round(value / step) * step;

// Trig on a locked angle leaves 1e-16 of noise on a value that should be a
// round millimetre; the document would carry it and a panel would print it.
const tidy = value => Math.round(value * 1e6) / 1e6 + 0; // +0 turns −0 into 0

// A point locked to a 45° direction from `anchor`, keeping its distance from
// it — then, with a grid step, that distance rounded so the point also lands
// on a round number of millimetres from the anchor. Without an anchor (a
// point controller, a lone vertex) the point simply snaps to the grid.
export function lockAngleFrom(anchor, x, y, { angleStep = SNAP_ANGLE_DEG, grid = SNAP_GRID_MM } = {}) {
  if (!anchor) return { x: grid ? snapTo(x, grid) : x, y: grid ? snapTo(y, grid) : y };
  const dx = x - anchor.x,
    dy = y - anchor.y;
  let length = Math.hypot(dx, dy);
  if (!(length > 1e-9)) return { x: anchor.x, y: anchor.y };
  const step = (angleStep * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  if (grid) length = Math.max(grid, snapTo(length, grid));
  return { x: tidy(anchor.x + Math.cos(angle) * length), y: tidy(anchor.y + Math.sin(angle) * length) };
}

// A displacement constrained to the axes (and diagonals): what Shift means
// while a whole shape is being moved.
export function lockDelta(dx, dy, angleStep = SNAP_ANGLE_DEG) {
  const length = Math.hypot(dx, dy);
  if (!(length > 1e-9)) return { dx: 0, dy: 0 };
  const step = (angleStep * Math.PI) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { dx: tidy(Math.cos(angle) * length), dy: tidy(Math.sin(angle) * length) };
}

// The neighbour a vertex is locked against: the previous one, or the next for
// the first vertex, wrapping round a closed ring. Null for a lone vertex.
export function lockAnchor(points, index, closed = false) {
  const n = points.length;
  if (n < 2) return null;
  if (index > 0) return points[index - 1];
  return closed ? points[n - 1] : points[1];
}

// Where on a polyline a point projects: the nearest span, the point on it
// and the distance to it. `points` may be {x, y} objects or [x, y] pairs.
export function nearestSpan(points, x, y, closed = false) {
  const px = p => (Array.isArray(p) ? p[0] : p.x);
  const py = p => (Array.isArray(p) ? p[1] : p.y);
  const n = points.length;
  const spans = closed ? n : n - 1;
  let best = null;
  for (let i = 0; i < spans; i++) {
    const a = points[i],
      b = points[(i + 1) % n];
    const ax = px(a),
      ay = py(a),
      bx = px(b),
      by = py(b);
    const dx = bx - ax,
      dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    const qx = ax + t * dx,
      qy = ay + t * dy;
    const distance = Math.hypot(x - qx, y - qy);
    if (!best || distance < best.distance) best = { index: i, t, x: qx, y: qy, distance };
  }
  return best;
}
