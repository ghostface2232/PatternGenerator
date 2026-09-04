// Variation gizmo geometry: four on-canvas handles, each mapping to ONE concept
// (sheet/mm space). Modelled on Photoshop's gradient + lens-blur tools so every
// drag does a single thing:
//   center -> centerX / centerY (origin = gradient start)
//   reach  -> angle (direction) + radius (length)  -- gradient end point
//   stop   -> position|phase, slides ALONG the gradient line only
//   curve  -> exponent, a rotary dial hugging the centre (lens-blur amount ring)
import { clamp } from "../core/math.js";

const GIZMO_EXP_K = 1.2;        // exponent <-> dial sweep (log scale)
const GIZMO_DIAL_R = 0.13;      // curve-dial radius as a fraction of minDim
const GIZMO_DIAL_SWEEP = 1.15;  // radians of knob travel per EXP_K log-unit

// ─── Handle snapping ──────────────────────────────────────────────────
// Range handles (reach spread, stop position/phase) snap to quarter steps;
// angle handles (reach direction, curve dial) snap to 45°. Holding Shift forces a
// hard snap to the nearest target; with the bare mouse the value moves freely but
// is gently pulled in as it approaches a snap point (a soft magnet).
export const SNAP_QUARTERS = [0, 0.25, 0.5, 0.75, 1]; // 0/25/50/75/100%
export const SNAP_CENTER = [0, 0.5, 1];               // panel centre, edge mids & corners
export const SNAP_ANGLE_STEP = 45;                    // degrees
export const SOFT_SNAP_FRAC = 0.06;                   // capture radius for 0..1 ranges
export const SOFT_SNAP_DEG = 7;                        // capture radius for angles (deg)
export const RADIUS_MIN = 0.1, RADIUS_MAX = 2;         // reach spread bounds

export function nearestSnap(value, snaps) {
  let snap = snaps[0], dist = Infinity;
  for (const s of snaps) {
    const d = Math.abs(value - s);
    if (d < dist) { dist = d; snap = s; }
  }
  return { snap, dist };
}

// Soft magnet: ease toward the nearest snap when within `radius`, fully reaching it
// at the centre. smoothstep keeps the pull gentle at the edge and firm at the point.
export function magnetize(value, snaps, radius) {
  const { snap, dist } = nearestSnap(value, snaps);
  if (dist >= radius) return value;
  const t = 1 - dist / radius;
  const pull = t * t * (3 - 2 * t);
  return value + (snap - value) * pull;
}

// Apply snapping to a 0..1-style value: Shift → hard snap, otherwise soft magnet.
export function applySnap(value, snaps, radius, shift) {
  return shift ? nearestSnap(value, snaps).snap : magnetize(value, snaps, radius);
}

// Angles wrap, so snap relative to the nearest multiple of `step`.
export function snapAngleDeg(angle, step, radiusDeg, shift) {
  const nearest = Math.round(angle / step) * step;
  const diff = angle - nearest;
  if (shift) return nearest;
  if (Math.abs(diff) >= radiusDeg) return angle;
  const t = 1 - Math.abs(diff) / radiusDeg;
  const pull = t * t * (3 - 2 * t);
  return angle - diff * pull;
}

export const gizmoUsesPosition = layer => layer.profile === "Peak" || layer.profile === "Valley";

// geom = { marginLeft, marginTop, perfW, perfH }
export function computeGizmo(layer, geom, minSep = 0) {
  const { marginLeft, marginTop, perfW, perfH } = geom;
  const minDim = Math.min(perfW, perfH);
  const cx = marginLeft + perfW * layer.centerX;
  const cy = marginTop + perfH * layer.centerY;
  const ang = (layer.angle * Math.PI) / 180;
  const dirX = Math.cos(ang), dirY = Math.sin(ang);
  const perpX = -dirY, perpY = dirX;
  const reachLen = Math.max(minDim * 0.06, 0.5 * minDim * (layer.radius || 1));
  const usesPosition = gizmoUsesPosition(layer);
  const alongFrac = usesPosition
    ? clamp(layer.position ?? 0.5, 0, 1)
    : (((layer.phase || 0) % 1) + 1) % 1;
  let along = alongFrac * reachLen;
  if (minSep > 0 && along < minSep) along = minSep; // keep it grabbable near the origin
  const stopX = cx + dirX * along, stopY = cy + dirY * along;
  const dialR = Math.max(minDim * 0.07, GIZMO_DIAL_R * minDim);
  const baseAngle = Math.atan2(perpY, perpX);
  const theta = (Math.log(clamp(layer.exponent || 1, 0.12, 5)) / GIZMO_EXP_K) * GIZMO_DIAL_SWEEP;
  const knobAngle = baseAngle + theta;
  return {
    minDim, reachLen, dirX, dirY, perpX, perpY, usesPosition, dialR, baseAngle,
    centerX: cx, centerY: cy,
    reachX: cx + dirX * reachLen, reachY: cy + dirY * reachLen,
    stopX, stopY,
    curveX: cx + Math.cos(knobAngle) * dialR,
    curveY: cy + Math.sin(knobAngle) * dialR,
  };
}

// Inverse maps: cursor in sheet space -> layer param patch, for the grabbed handle.
export function gizmoPatchForCenter(mx, my, geom, shift) {
  const x = clamp((mx - geom.marginLeft) / Math.max(1e-6, geom.perfW), 0, 1);
  const y = clamp((my - geom.marginTop) / Math.max(1e-6, geom.perfH), 0, 1);
  return {
    centerX: applySnap(x, SNAP_CENTER, SOFT_SNAP_FRAC, shift),
    centerY: applySnap(y, SNAP_CENTER, SOFT_SNAP_FRAC, shift),
  };
}

export function gizmoPatchForReach(mx, my, layer, geom, lockRadius, shift) {
  const g = computeGizmo(layer, geom);
  const dx = mx - g.centerX, dy = my - g.centerY;
  const angle = snapAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI, SNAP_ANGLE_STEP, SOFT_SNAP_DEG, shift);
  const patch = { angle: Math.round(angle) };
  if (!lockRadius) {
    const raw = clamp(Math.hypot(dx, dy) / (0.5 * g.minDim), RADIUS_MIN, RADIUS_MAX);
    const frac = applySnap((raw - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN), SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
    patch.radius = clamp(RADIUS_MIN + frac * (RADIUS_MAX - RADIUS_MIN), RADIUS_MIN, RADIUS_MAX);
  }
  return patch;
}

// Stop: project the cursor onto the gradient axis -> position|phase only.
export function gizmoPatchForStop(mx, my, layer, geom, shift) {
  const g = computeGizmo(layer, geom);
  const dx = mx - g.centerX, dy = my - g.centerY;
  const alongFrac = (dx * g.dirX + dy * g.dirY) / Math.max(1e-6, g.reachLen);
  if (g.usesPosition) {
    const snapped = applySnap(clamp(alongFrac, 0, 1), SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
    return { position: clamp(snapped, 0.01, 0.99) };
  }
  const phase = ((alongFrac % 1) + 1) % 1;
  const snapped = applySnap(phase, SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
  return { phase: ((snapped % 1) + 1) % 1 }; // 100% wraps back to 0
}

// Curve: the knob's angle around the centre -> exponent (rotary dial).
export function gizmoPatchForCurve(mx, my, layer, geom, shift) {
  const g = computeGizmo(layer, geom);
  let theta = Math.atan2(my - g.centerY, mx - g.centerX) - g.baseAngle;
  theta = Math.atan2(Math.sin(theta), Math.cos(theta)); // wrap to [-π, π]
  const deg = snapAngleDeg((theta * 180) / Math.PI, SNAP_ANGLE_STEP, SOFT_SNAP_DEG, shift);
  theta = (deg * Math.PI) / 180;
  return { exponent: clamp(Math.exp((theta / GIZMO_DIAL_SWEEP) * GIZMO_EXP_K), 0.12, 5) };
}

// Which handle (if any) is under a sheet-space point, within `hitRadiusPx` screen pixels.
export function hitTestGizmo(g, x, y, scale, hitRadiusPx = 16) {
  const candidates = [
    { handle: "stop", x: g.stopX, y: g.stopY },
    { handle: "curve", x: g.curveX, y: g.curveY },
    { handle: "reach", x: g.reachX, y: g.reachY },
    { handle: "center", x: g.centerX, y: g.centerY },
  ];
  let hit = null, hitDist = hitRadiusPx;
  for (const c of candidates) {
    const d = Math.hypot(c.x - x, c.y - y) * scale;
    if (d < hitDist) { hit = c.handle; hitDist = d; }
  }
  return hit;
}
