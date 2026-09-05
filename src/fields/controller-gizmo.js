// On-canvas handles for field controllers: where they sit, what a pointer hits,
// and what dragging one does. Pure sheet-millimetre maths, like fields/gizmo.js
// (the variation gizmo) — the canvas component only supplies the cursor.
import { clamp } from "../core/math.js";
import { flattenCubic, KIND_POINT_COUNT, MAX_POLYLINE_POINTS } from "./controllers.js";
import { placementCorners } from "./image-map.js";

// Grid the geometry snaps to while Shift is held, and the step the reach radius
// lands on. Both in millimetres — the same "hold Shift to lock" idiom the
// variation gizmo uses, but on a metric grid rather than on panel fractions.
export const SNAP_GRID_MM = 1;
export const RADIUS_STEP_MM = 0.5;
export const RADIUS_MIN_MM = 0.5;

const snap = (value, step) => Math.round(value / step) * step;

// The polyline the controller actually measures against (a curve is flattened).
export function controllerPolyline(controller) {
  const points = controller.geometry?.points || [];
  return controller.kind === "curve" && points.length >= 4 ? flattenCubic(points, 24) : points;
}

// Midpoint of the geometry, and the direction the reach handle leaves it in:
// straight out for a point, perpendicular to the path for everything else.
export function reachAnchor(controller) {
  const points = controller.geometry?.points || [];
  if (!points.length) return null;
  if (points.length === 1) return { x: points[0].x, y: points[0].y, dx: 1, dy: 0 };
  const path = controllerPolyline(controller);
  const mid = Math.floor((path.length - 1) / 2);
  const a = path[mid],
    b = path[Math.min(path.length - 1, mid + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dx: -(b.y - a.y) / len, dy: (b.x - a.x) / len };
}

// Every draggable handle, in draw order (later entries win a tie in hit tests).
export function controllerHandles(controller) {
  if (controller.kind === "image") {
    const placement = controller.image?.placement;
    if (!placement) return [];
    const corners = placementCorners(placement);
    const cx = placement.x + placement.w / 2;
    const cy = placement.y + placement.h / 2;
    const angle = ((placement.rotation || 0) * Math.PI) / 180;
    const reach = Math.max(placement.w, placement.h) / 2 + Math.min(placement.w, placement.h) * 0.18;
    return [
      { id: "img-move", x: cx, y: cy, role: "move" },
      { id: "img-size", x: corners[2].x, y: corners[2].y, role: "size" },
      {
        id: "img-rot",
        x: cx + Math.cos(angle - Math.PI / 2) * reach,
        y: cy + Math.sin(angle - Math.PI / 2) * reach,
        role: "rotate",
      },
    ];
  }
  const points = controller.geometry?.points || [];
  const handles = points.map((p, i) => ({
    id: `p${i}`,
    x: p.x,
    y: p.y,
    role: i === 0 || i === points.length - 1 ? "end" : "mid",
  }));
  const anchor = reachAnchor(controller);
  if (anchor) {
    const radius = Math.max(RADIUS_MIN_MM, controller.radius || 1);
    handles.push({ id: "radius", x: anchor.x + anchor.dx * radius, y: anchor.y + anchor.dy * radius, role: "radius" });
  }
  return handles;
}

// The handle under a sheet-space point, within `hitRadiusPx` screen pixels.
// `scale` is sheet mm → screen px, so the tolerance stays constant on screen.
export function hitTestController(controller, x, y, scale, hitRadiusPx = 14) {
  let hit = null,
    best = hitRadiusPx;
  for (const handle of controllerHandles(controller)) {
    const d = Math.hypot(handle.x - x, handle.y - y) * scale;
    if (d <= best) {
      best = d;
      hit = handle.id;
    }
  }
  return hit;
}

// Distance from a point to the controller's body, for click-to-select. Image
// controllers use their placement rectangle; everything else its path.
export function controllerBodyDistance(controller, x, y) {
  if (controller.kind === "image") {
    const placement = controller.image?.placement;
    if (!placement) return Infinity;
    const cx = placement.x + placement.w / 2;
    const cy = placement.y + placement.h / 2;
    const angle = ((placement.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(-angle),
      sin = Math.sin(-angle);
    const lx = (x - cx) * cos - (y - cy) * sin;
    const ly = (x - cx) * sin + (y - cy) * cos;
    const dx = Math.abs(lx) - placement.w / 2;
    const dy = Math.abs(ly) - placement.h / 2;
    if (dx <= 0 && dy <= 0) return 0;
    return Math.hypot(Math.max(0, dx), Math.max(0, dy));
  }
  const path = controllerPolyline(controller);
  if (!path.length) return Infinity;
  if (path.length === 1) return Math.hypot(x - path[0].x, y - path[0].y);
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
    t = clamp(t, 0, 1);
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return best;
}

// Dragging a handle → the fields of the controller it changes. Returns null when
// the handle does not belong to this controller, so a stale drag is a no-op
// rather than a corrupted geometry.
// Shift snaps whatever the handle actually stands for, and only that: a
// position lands on the millimetre grid, a reach on its own step, a rotation on
// 15°. Snapping the cursor first and the value after would snap twice and land
// on neither (a cursor 7.4 mm out would read 7.0 mm, not the 7.5 mm step).
export function moveControllerHandle(controller, handleId, x, y, shift = false) {
  const snapsPosition = handleId !== "radius" && handleId !== "img-rot";
  const px = shift && snapsPosition ? snap(x, SNAP_GRID_MM) : x;
  const py = shift && snapsPosition ? snap(y, SNAP_GRID_MM) : y;

  if (controller.kind === "image") {
    const placement = controller.image?.placement;
    if (!placement) return null;
    const cx = placement.x + placement.w / 2;
    const cy = placement.y + placement.h / 2;
    if (handleId === "img-move") {
      return {
        image: { ...controller.image, placement: { ...placement, x: px - placement.w / 2, y: py - placement.h / 2 } },
      };
    }
    if (handleId === "img-size") {
      // The grabbed corner in the rectangle's own frame: its distance from the
      // centre is half the new size, so the opposite corner stays put visually.
      const angle = ((placement.rotation || 0) * Math.PI) / 180;
      const cos = Math.cos(-angle),
        sin = Math.sin(-angle);
      const lx = (px - cx) * cos - (py - cy) * sin;
      const ly = (px - cx) * sin + (py - cy) * cos;
      const w = Math.max(1, Math.abs(lx) * 2);
      const h = Math.max(1, Math.abs(ly) * 2);
      return { image: { ...controller.image, placement: { ...placement, w, h, x: cx - w / 2, y: cy - h / 2 } } };
    }
    if (handleId === "img-rot") {
      const deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
      const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
      const rotation = shift ? snap(wrapped, 15) : Math.round(wrapped);
      return { image: { ...controller.image, placement: { ...placement, rotation } } };
    }
    return null;
  }

  if (handleId === "radius") {
    const anchor = reachAnchor(controller);
    if (!anchor) return null;
    const raw = Math.hypot(px - anchor.x, py - anchor.y);
    return { radius: Math.max(RADIUS_MIN_MM, shift ? snap(raw, RADIUS_STEP_MM) : raw) };
  }

  const match = /^p(\d+)$/.exec(handleId);
  if (!match) return null;
  const index = Number(match[1]);
  const points = controller.geometry?.points || [];
  if (index >= points.length) return null;
  const next = points.map((p, i) => (i === index ? { x: px, y: py } : p));
  return { geometry: { ...controller.geometry, points: next } };
}

// Polyline vertex count, edited from the inspector: a new vertex is inserted at
// the midpoint of the longest span so the shape barely moves.
export function addPolylinePoint(controller) {
  const points = controller.geometry?.points || [];
  if (controller.kind !== "polyline" || points.length >= MAX_POLYLINE_POINTS) return null;
  let at = 0,
    longest = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (d > longest) {
      longest = d;
      at = i;
    }
  }
  const mid = { x: (points[at].x + points[at + 1].x) / 2, y: (points[at].y + points[at + 1].y) / 2 };
  return { geometry: { ...controller.geometry, points: [...points.slice(0, at + 1), mid, ...points.slice(at + 1)] } };
}

export function removePolylinePoint(controller) {
  const points = controller.geometry?.points || [];
  const min = KIND_POINT_COUNT.polyline.min;
  if (controller.kind !== "polyline" || points.length <= min) return null;
  return { geometry: { ...controller.geometry, points: points.slice(0, -1) } };
}
