// Handles, hit testing and edits for the boundary: a polygon's vertices and a
// cutout's position and size, dragged on the canvas. Pure, in sheet
// millimetres, like the path and controller gizmos — the canvas turns pointer
// positions into millimetres and hands them here.
import { clamp } from "../core/math.js";
import { DOC_LIMITS, MAX_BOUNDARY_POINTS, MAX_CUTOUT_POINTS } from "../core/constants.js";
import { distPointSeg } from "./polygon.js";
import { SNAP_GRID_MM, lockAngleFrom, snapTo as snap } from "./snap.js";

const COORD = DOC_LIMITS["boundary.coord"];
const SIZE = DOC_LIMITS["cutout.size"];
// Everything a drag writes is clamped to the range validateDocument uses, or
// the editor could not read back its own output after a reload.
const coord = value => clamp(value, COORD[0], COORD[1]);

// The vertex a ring's vertex is locked against while Shift is held: the
// previous one, wrapping round the ring, as a pair.
const ringAnchor = (ring, index) => {
  if (ring.length < 2) return null;
  const [x, y] = ring[(index - 1 + ring.length) % ring.length];
  return { x, y };
};

// A polygon boundary to start from when the shape switches to Polygon with
// nothing drawn: an octagon inscribed in the frame, which is recognisably not
// the rectangle and has few enough vertices to drag one at a time.
export function defaultBoundaryRings(frame) {
  const cx = (frame.xMin + frame.xMax) / 2,
    cy = (frame.yMin + frame.yMax) / 2;
  const rx = (frame.xMax - frame.xMin) / 2,
    ry = (frame.yMax - frame.yMin) / 2;
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 8;
    // Scaled so the flats touch the frame: a regular octagon's apothem is
    // cos(π/8) of its circumradius.
    ring.push([coord(cx + (Math.cos(a) * rx) / Math.cos(Math.PI / 8)), coord(cy + (Math.sin(a) * ry) / Math.cos(Math.PI / 8))]); // prettier-ignore
  }
  return [ring];
}

// Every draggable handle, in draw order (later entries win a tie).
//   vertex   a polygon ring's vertex, or a polygon cutout's
//   move     a circle or rectangle cutout's centre
//   size     its rim, dragged to resize about the centre
export function boundaryHandles(boundary) {
  const handles = [];
  if (boundary.shape === "Polygon") {
    (boundary.rings || []).forEach((ring, r) => {
      ring.forEach(([x, y], i) => handles.push({ id: `r${r}v${i}`, x, y, role: "vertex", ring: r, index: i }));
    });
  }
  for (const cutout of boundary.cutouts || []) {
    if (cutout.shape === "Polygon") {
      (cutout.points || []).forEach(([x, y], i) =>
        handles.push({ id: `c:${cutout.id}:v${i}`, x, y, role: "vertex", cutout: cutout.id, index: i })
      );
      continue;
    }
    const angle = ((cutout.rotation || 0) * Math.PI) / 180;
    handles.push({ id: `c:${cutout.id}:move`, x: cutout.x, y: cutout.y, role: "move", cutout: cutout.id });
    handles.push({
      id: `c:${cutout.id}:size`,
      x: cutout.x + (Math.cos(angle) * cutout.w) / 2,
      y: cutout.y + (Math.sin(angle) * cutout.w) / 2,
      role: "size",
      cutout: cutout.id,
    });
  }
  return handles;
}

// The handle under a sheet-space point, within `hitRadiusPx` screen pixels.
export function hitTestBoundary(boundary, x, y, scale, hitRadiusPx = 14) {
  let hit = null,
    best = hitRadiusPx;
  for (const handle of boundaryHandles(boundary)) {
    const d = Math.hypot(handle.x - x, handle.y - y) * scale;
    if (d <= best) {
      best = d;
      hit = handle;
    }
  }
  return hit;
}

// Dragging a handle → the boundary fields it changes, or null for a handle
// that belongs to nothing here. Shift snaps a position to the millimetre grid,
// and locks a vertex to 45° from the one before it, so an edge dragged with
// Shift comes out level or square.
export function moveBoundaryHandle(boundary, handle, x, y, shift = false) {
  const px = coord(shift ? snap(x, SNAP_GRID_MM) : x);
  const py = coord(shift ? snap(y, SNAP_GRID_MM) : y);
  const lockedVertex = ring => {
    if (!shift) return [px, py];
    const locked = lockAngleFrom(ringAnchor(ring, handle.index), x, y);
    return [coord(locked.x), coord(locked.y)];
  };
  if (handle.role === "vertex" && handle.cutout === undefined) {
    const rings = boundary.rings || [];
    if (!rings[handle.ring]?.[handle.index]) return null;
    const vertex = lockedVertex(rings[handle.ring]);
    return {
      rings: rings.map((ring, r) => (r !== handle.ring ? ring : ring.map((p, i) => (i !== handle.index ? p : vertex)))),
    };
  }
  const cutouts = boundary.cutouts || [];
  const cutout = cutouts.find(c => c.id === handle.cutout);
  if (!cutout) return null;
  let next;
  if (handle.role === "vertex") {
    if (!cutout.points?.[handle.index]) return null;
    const vertex = lockedVertex(cutout.points);
    next = { ...cutout, points: cutout.points.map((p, i) => (i !== handle.index ? p : vertex)) };
  } else if (handle.role === "move") {
    next = { ...cutout, x: px, y: py };
  } else if (handle.role === "size") {
    // The rim handle sits on the rotated x axis; its distance from the centre
    // is half the new width, and a circle keeps its height equal to it.
    const w = clamp(2 * Math.hypot(px - cutout.x, py - cutout.y), SIZE[0], SIZE[1]);
    next = { ...cutout, w, h: cutout.shape === "Circle" ? w : cutout.h };
  } else return null;
  return { cutouts: cutouts.map(c => (c.id === cutout.id ? next : c)) };
}

// A cutout moved by (dx, dy) as one piece — its centre, or every vertex of a
// polygon — clamped like every other drag so a reload reads it back unchanged.
export function translateCutout(cutout, dx, dy) {
  if (cutout.shape === "Polygon") {
    return { ...cutout, points: (cutout.points || []).map(([x, y]) => [coord(x + dx), coord(y + dy)]) };
  }
  return { ...cutout, x: coord(cutout.x + dx), y: coord(cutout.y + dy) };
}

// The edge of a polygon ring (or a polygon cutout) nearest to a point:
// { ring | cutout, index, distance }, with `index` the edge from vertex
// `index` to the next. Where a double-click puts a new vertex.
export function nearestBoundaryEdge(boundary, x, y) {
  let best = null;
  const consider = (points, key) => {
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const distance = distPointSeg(x, y, a[0], a[1], b[0], b[1]);
      if (!best || distance < best.distance) best = { ...key, index: i, distance };
    }
  };
  if (boundary.shape === "Polygon") (boundary.rings || []).forEach((ring, r) => consider(ring, { ring: r }));
  for (const cutout of boundary.cutouts || []) {
    if (cutout.shape === "Polygon") consider(cutout.points || [], { cutout: cutout.id });
  }
  return best;
}

// A vertex inserted after edge `index` of the ring `where` names, at (x, y)
// — or null when that ring is full.
export function insertBoundaryVertex(boundary, where, x, y) {
  const point = [coord(x), coord(y)];
  if (where.cutout !== undefined) {
    const cutouts = boundary.cutouts || [];
    const cutout = cutouts.find(c => c.id === where.cutout);
    if (!cutout || cutout.shape !== "Polygon" || cutout.points.length >= MAX_CUTOUT_POINTS) return null;
    const points = cutout.points.slice();
    points.splice(where.index + 1, 0, point);
    return { cutouts: cutouts.map(c => (c.id === cutout.id ? { ...c, points } : c)) };
  }
  const rings = boundary.rings || [];
  const ring = rings[where.ring];
  if (!ring || ring.length >= MAX_BOUNDARY_POINTS) return null;
  const next = ring.slice();
  next.splice(where.index + 1, 0, point);
  return { rings: rings.map((r, i) => (i === where.ring ? next : r)) };
}

// A vertex removed — or null when its ring would be left with fewer than
// three, since two points are not an outline.
export function removeBoundaryVertex(boundary, handle) {
  if (handle.cutout !== undefined) {
    const cutouts = boundary.cutouts || [];
    const cutout = cutouts.find(c => c.id === handle.cutout);
    if (!cutout || cutout.shape !== "Polygon" || cutout.points.length <= 3) return null;
    return { cutouts: cutouts.map(c => (c.id === cutout.id ? { ...c, points: c.points.filter((_, i) => i !== handle.index) } : c)) }; // prettier-ignore
  }
  const rings = boundary.rings || [];
  const ring = rings[handle.ring];
  if (!ring || ring.length <= 3) return null;
  return { rings: rings.map((r, i) => (i === handle.ring ? r.filter((_, j) => j !== handle.index) : r)) };
}

// Distance from a point to a cutout's outline, for click-to-select.
export function cutoutBodyDistance(cutout, x, y) {
  if (cutout.shape === "Polygon") {
    let best = Infinity;
    const pts = cutout.points || [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      best = Math.min(best, distPointSeg(x, y, a[0], a[1], b[0], b[1]));
    }
    return best;
  }
  const angle = ((cutout.rotation || 0) * Math.PI) / 180;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const dx = x - cutout.x,
    dy = y - cutout.y;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  if (cutout.shape === "Circle") return Math.abs(Math.hypot(lx, ly) - cutout.w / 2);
  const ex = Math.abs(lx) - cutout.w / 2,
    ey = Math.abs(ly) - cutout.h / 2;
  if (ex <= 0 && ey <= 0) return Math.min(-ex, -ey);
  return Math.hypot(Math.max(0, ex), Math.max(0, ey));
}
