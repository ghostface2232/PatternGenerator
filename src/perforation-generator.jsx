import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  BLEND_MODES,
  DEFAULT_VARIATION,
  FIELD_SPACES,
  SIZE_PROFILES,
  VARIATION_PRESETS,
  createVariationLayer,
  evaluateVariationField,
  randomizeVariationLayer,
  variationScaleAt,
} from "./variation-engine.js";

const PATTERN_TYPES = ["Straight", "Staggered 60°", "Staggered 45°", "Radial", "Custom Angle"];
const HOLE_SHAPES = ["Circle", "Rectangle", "Pill", "Hexagon"];
const DIN_PRESETS = [
  { name: "Custom", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
  { name: "Rv 2-4 (60° staggered)", d: 2, pitchX: 4, pitchY: 3.46, pattern: "Staggered 60°" },
  { name: "Rv 3-5 (60° staggered)", d: 3, pitchX: 5, pitchY: 4.33, pattern: "Staggered 60°" },
  { name: "Rv 5-8 (60° staggered)", d: 5, pitchX: 8, pitchY: 6.93, pattern: "Staggered 60°" },
  { name: "Rv 6-9 (60° staggered)", d: 6, pitchX: 9, pitchY: 7.79, pattern: "Staggered 60°" },
  { name: "Rv 8-12 (60° staggered)", d: 8, pitchX: 12, pitchY: 10.39, pattern: "Staggered 60°" },
  { name: "Rv 10-15 (60° staggered)", d: 10, pitchX: 15, pitchY: 12.99, pattern: "Staggered 60°" },
  { name: "Rg 5-8 (straight)", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
  { name: "Rg 3-5 (straight)", d: 3, pitchX: 5, pitchY: 5, pattern: "Straight" },
  { name: "Rg 10-14 (straight)", d: 10, pitchX: 14, pitchY: 14, pattern: "Straight" },
  { name: "Rv 4-6 (45° staggered)", d: 4, pitchX: 6, pitchY: 6, pattern: "Staggered 45°" },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const cloneVariation = variation => ({
  ...variation,
  layers: (variation.layers || []).map(layer => ({ ...layer })),
});

// ─── Variation gizmo geometry ─────────────────────────────────────────
// Four on-canvas handles, each mapping to ONE concept (sheet/mm space). Modelled
// on Photoshop's gradient + lens-blur tools so every drag does a single thing:
//   center -> centerX / centerY (origin = gradient start)
//   reach  -> angle (direction) + radius (length)  -- gradient end point
//   stop   -> position|phase, slides ALONG the gradient line only
//   curve  -> exponent, a rotary dial hugging the centre (lens-blur amount ring)
const GIZMO_EXP_K = 1.2;        // exponent <-> dial sweep (log scale)
const GIZMO_DIAL_R = 0.13;      // curve-dial radius as a fraction of minDim
const GIZMO_DIAL_SWEEP = 1.15;  // radians of knob travel per EXP_K log-unit

// ─── Handle snapping ──────────────────────────────────────────────────
// Range handles (reach spread, stop position/phase) snap to quarter steps;
// angle handles (reach direction, curve dial) snap to 45°. Holding Shift forces a
// hard snap to the nearest target; with the bare mouse the value moves freely but
// is gently pulled in as it approaches a snap point (a soft magnet).
const SNAP_QUARTERS = [0, 0.25, 0.5, 0.75, 1]; // 0/25/50/75/100%
const SNAP_CENTER = [0, 0.5, 1];               // panel centre, edge mids & corners (quadrant vertices)
const SNAP_ANGLE_STEP = 45;                    // degrees
const SOFT_SNAP_FRAC = 0.06;                   // capture radius for 0..1 ranges
const SOFT_SNAP_DEG = 7;                        // capture radius for angles (deg)
const RADIUS_MIN = 0.1, RADIUS_MAX = 2;         // reach spread bounds

function nearestSnap(value, snaps) {
  let snap = snaps[0], dist = Infinity;
  for (const s of snaps) {
    const d = Math.abs(value - s);
    if (d < dist) { dist = d; snap = s; }
  }
  return { snap, dist };
}

// Soft magnet: ease toward the nearest snap when within `radius`, fully reaching it
// at the centre. smoothstep keeps the pull gentle at the edge and firm at the point.
function magnetize(value, snaps, radius) {
  const { snap, dist } = nearestSnap(value, snaps);
  if (dist >= radius) return value;
  const t = 1 - dist / radius;       // 0 at edge → 1 at the snap point
  const pull = t * t * (3 - 2 * t);  // smoothstep easing
  return value + (snap - value) * pull;
}

// Apply snapping to a 0..1-style value: Shift → hard snap, otherwise soft magnet.
function applySnap(value, snaps, radius, shift) {
  return shift ? nearestSnap(value, snaps).snap : magnetize(value, snaps, radius);
}

// Angles wrap, so snap relative to the nearest multiple of `step`.
function snapAngleDeg(angle, step, radiusDeg, shift) {
  const nearest = Math.round(angle / step) * step;
  const diff = angle - nearest;
  if (shift) return nearest;
  if (Math.abs(diff) >= radiusDeg) return angle;
  const t = 1 - Math.abs(diff) / radiusDeg;
  const pull = t * t * (3 - 2 * t);
  return angle - diff * pull;
}

const gizmoUsesPosition = layer => layer.profile === "Peak" || layer.profile === "Valley";

function computeGizmo(layer, geom, minSep = 0) {
  const { marginLeft, marginTop, perfW, perfH } = geom;
  const minDim = Math.min(perfW, perfH);
  const cx = marginLeft + perfW * layer.centerX;
  const cy = marginTop + perfH * layer.centerY;
  const ang = (layer.angle * Math.PI) / 180;
  const dirX = Math.cos(ang), dirY = Math.sin(ang);
  const perpX = -dirY, perpY = dirX;
  const reachLen = Math.max(minDim * 0.06, 0.5 * minDim * (layer.radius || 1));
  const usesPosition = gizmoUsesPosition(layer);
  // Both position and phase ride 0..1 along the axis (center -> reach).
  const alongFrac = usesPosition
    ? clamp(layer.position ?? 0.5, 0, 1)
    : (((layer.phase || 0) % 1) + 1) % 1;
  // Position/phase stop lives strictly ON the gradient line (no perpendicular meaning).
  let along = alongFrac * reachLen;
  if (minSep > 0 && along < minSep) along = minSep; // keep it grabbable near the origin
  const stopX = cx + dirX * along, stopY = cy + dirY * along;
  // Curve dial: a rotary knob hugging the centre. Its sweep encodes the falloff exponent;
  // neutral (exponent = 1) points perpendicular to the axis, like a dial's 12-o'clock.
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
function gizmoPatchForCenter(mx, my, geom, shift) {
  // Each axis snaps to 0/50/100% so the origin clicks onto the panel centre,
  // the edge midpoints and the corners (the quadrant vertices).
  const x = clamp((mx - geom.marginLeft) / Math.max(1e-6, geom.perfW), 0, 1);
  const y = clamp((my - geom.marginTop) / Math.max(1e-6, geom.perfH), 0, 1);
  return {
    centerX: applySnap(x, SNAP_CENTER, SOFT_SNAP_FRAC, shift),
    centerY: applySnap(y, SNAP_CENTER, SOFT_SNAP_FRAC, shift),
  };
}

function gizmoPatchForReach(mx, my, layer, geom, lockRadius, shift) {
  const g = computeGizmo(layer, geom);
  const dx = mx - g.centerX, dy = my - g.centerY;
  // Direction snaps to 45° increments.
  const angle = snapAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI, SNAP_ANGLE_STEP, SOFT_SNAP_DEG, shift);
  const patch = { angle: Math.round(angle) };
  if (!lockRadius) {
    // Spread snaps to 0/25/50/75/100% of its range.
    const raw = clamp(Math.hypot(dx, dy) / (0.5 * g.minDim), RADIUS_MIN, RADIUS_MAX);
    const frac = applySnap((raw - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN), SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
    patch.radius = clamp(RADIUS_MIN + frac * (RADIUS_MAX - RADIUS_MIN), RADIUS_MIN, RADIUS_MAX);
  }
  return patch;
}

// Stop: project the cursor onto the gradient axis -> position|phase only.
function gizmoPatchForStop(mx, my, layer, geom, shift) {
  const g = computeGizmo(layer, geom);
  const dx = mx - g.centerX, dy = my - g.centerY;
  const alongFrac = (dx * g.dirX + dy * g.dirY) / Math.max(1e-6, g.reachLen);
  // Position/phase snaps to 0/25/50/75/100% along the gradient line.
  if (g.usesPosition) {
    const snapped = applySnap(clamp(alongFrac, 0, 1), SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
    return { position: clamp(snapped, 0.01, 0.99) };
  }
  const phase = ((alongFrac % 1) + 1) % 1;
  const snapped = applySnap(phase, SNAP_QUARTERS, SOFT_SNAP_FRAC, shift);
  return { phase: ((snapped % 1) + 1) % 1 }; // 100% wraps back to 0
}

// Curve: the knob's angle around the centre -> exponent (rotary dial).
function gizmoPatchForCurve(mx, my, layer, geom, shift) {
  const g = computeGizmo(layer, geom);
  let theta = Math.atan2(my - g.centerY, mx - g.centerX) - g.baseAngle;
  theta = Math.atan2(Math.sin(theta), Math.cos(theta)); // wrap to [-π, π]
  // The dial is angular, so it snaps to 45° steps (0° = neutral, exponent 1).
  const deg = snapAngleDeg((theta * 180) / Math.PI, SNAP_ANGLE_STEP, SOFT_SNAP_DEG, shift);
  theta = (deg * Math.PI) / 180;
  return { exponent: clamp(Math.exp((theta / GIZMO_DIAL_SWEEP) * GIZMO_EXP_K), 0.12, 5) };
}

// ─── Hole shape helpers (w = horizontal extent, h = vertical extent) ──
function calcHoleArea(shape, w, h, holeRadius) {
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    return r > 0 ? w * h - 4 * r * r + Math.PI * r * r : w * h;
  }
  if (shape === "Pill") {
    // Stadium: short side = min(w,h), long side = max(w,h)
    const s = Math.min(w, h), l = Math.max(w, h);
    const r = s / 2;
    return Math.PI * r * r + s * (l - s);
  }
  if (shape === "Hexagon") { const r = w / 2; return (3 * Math.sqrt(3) / 2) * r * r; }
  // Circle
  return Math.PI * (w / 2) ** 2;
}

// Pointy-top regular hexagon: distance from centre to its boundary in a given direction.
// Edge normals lie at multiples of 60°; apothem (centre→edge) = R·√3/2. Used for accurate
// hexagon gap/overlap so the honeycomb ligament reflects the true edge-to-edge spacing.
function hexEdgeReach(R, dirAngle) {
  const apothem = R * Math.sqrt(3) / 2;
  const sector = Math.PI / 3;
  let d = dirAngle % sector;
  if (d > sector / 2) d -= sector;
  else if (d < -sector / 2) d += sector;
  return apothem / Math.cos(d);
}

function traceHolePath(ctx, x, y, shape, w, h, angle, holeRadius) {
  const hw = w / 2, hh = h / 2;
  // For rotated rectangles/pills, use transform
  const needsRotation = angle && (shape === "Rectangle" || shape === "Pill");
  if (needsRotation) {
    ctx.translate(x, y);
    ctx.rotate(angle);
  }
  const cx = needsRotation ? 0 : x, cy = needsRotation ? 0 : y;
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    if (r > 0) { ctx.roundRect(cx - hw, cy - hh, w, h, r); }
    else { ctx.rect(cx - hw, cy - hh, w, h); }
  } else if (shape === "Hexagon") {
    const R = hw;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6; // pointy-top orientation for honeycomb tiling
      const vx = cx + R * Math.cos(a), vy = cy + R * Math.sin(a);
      if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
  } else if (shape === "Pill") {
    if (w >= h) {
      const s = hw - hh;
      ctx.moveTo(cx - s, cy - hh);
      ctx.lineTo(cx + s, cy - hh);
      ctx.arc(cx + s, cy, hh, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx - s, cy + hh);
      ctx.arc(cx - s, cy, hh, Math.PI / 2, -Math.PI / 2);
    } else {
      const s = hh - hw;
      ctx.moveTo(cx + hw, cy - s);
      ctx.lineTo(cx + hw, cy + s);
      ctx.arc(cx, cy + s, hw, 0, Math.PI);
      ctx.lineTo(cx - hw, cy - s);
      ctx.arc(cx, cy - s, hw, Math.PI, 0);
    }
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, hw, 0, Math.PI * 2);
  }
  if (needsRotation) {
    ctx.rotate(-angle);
    ctx.translate(-x, -y);
  }
}

function holeSVGElement(x, y, shape, w, h, fill, extra, angle, holeRadius) {
  const hw = w / 2, hh = h / 2;
  const attrs = extra || '';
  const rotAttr = angle && (shape === "Rectangle" || shape === "Pill") ? ` transform="rotate(${(angle * 180 / Math.PI).toFixed(2)} ${x.toFixed(3)} ${y.toFixed(3)})"` : '';
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    const rxAttr = r > 0 ? ` rx="${r.toFixed(3)}" ry="${r.toFixed(3)}"` : '';
    return `    <rect x="${(x - hw).toFixed(3)}" y="${(y - hh).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"${rxAttr} ${fill} ${attrs}${rotAttr}/>\n`;
  }
  if (shape === "Hexagon") {
    const R = hw;
    const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(x + R * Math.cos(a)).toFixed(3)},${(y + R * Math.sin(a)).toFixed(3)}`; }).join(" ");
    return `    <polygon points="${pts}" ${fill} ${attrs}/>\n`;
  }
  if (shape === "Pill") {
    if (w >= h) {
      const s = hw - hh, r = hh;
      return `    <path d="M ${(x - s).toFixed(3)} ${(y - r).toFixed(3)} L ${(x + s).toFixed(3)} ${(y - r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + s).toFixed(3)} ${(y + r).toFixed(3)} L ${(x - s).toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x - s).toFixed(3)} ${(y - r).toFixed(3)} Z" ${fill} ${attrs}${rotAttr}/>\n`;
    } else {
      const s = hh - hw, r = hw;
      return `    <path d="M ${(x + r).toFixed(3)} ${(y - s).toFixed(3)} L ${(x + r).toFixed(3)} ${(y + s).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x - r).toFixed(3)} ${(y + s).toFixed(3)} L ${(x - r).toFixed(3)} ${(y - s).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + r).toFixed(3)} ${(y - s).toFixed(3)} Z" ${fill} ${attrs}${rotAttr}/>\n`;
    }
  }
  return `    <circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${hw.toFixed(3)}" ${fill} ${attrs}/>\n`;
}

// Check if a point is inside a rounded rectangle
function isInsideRoundedRect(px, py, x1, y1, x2, y2, cr) {
  if (cr <= 0) return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  // Clamp corner radius
  const maxR = Math.min((x2 - x1) / 2, (y2 - y1) / 2);
  const r = Math.min(cr, maxR);
  // Check main cross regions first
  if (px >= x1 + r && px <= x2 - r && py >= y1 && py <= y2) return true;
  if (px >= x1 && px <= x2 && py >= y1 + r && py <= y2 - r) return true;
  // Check four corners
  const corners = [[x1 + r, y1 + r], [x2 - r, y1 + r], [x1 + r, y2 - r], [x2 - r, y2 - r]];
  for (const [cx, cy] of corners) {
    if (Math.hypot(px - cx, py - cy) <= r) return true;
  }
  return false;
}

// Area of a rounded rectangle
function roundedRectArea(w, h, cr) {
  if (cr <= 0) return w * h;
  const maxR = Math.min(w / 2, h / 2);
  const r = Math.min(cr, maxR);
  // Rectangle area minus 4 square corners plus 4 quarter-circle corners
  return w * h - 4 * r * r + Math.PI * r * r;
}

function isPointInsideHole(px, py, hole, shape, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const radius = useExit ? hole.exitHoleRadius : hole.holeRadius;
  if (w <= 0 || h <= 0) return false;
  const angle = hole.angle || 0;
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const dx = px - hole.x, dy = py - hole.y;
  const x = dx * cos - dy * sin, y = dx * sin + dy * cos;
  if (shape === "Rectangle") return isInsideRoundedRect(x, y, -w / 2, -h / 2, w / 2, h / 2, radius);
  if (shape === "Pill") {
    if (w >= h) {
      const segment = (w - h) / 2;
      const sx = Math.max(Math.abs(x) - segment, 0);
      return sx * sx + y * y <= (h / 2) ** 2;
    }
    const segment = (h - w) / 2;
    const sy = Math.max(Math.abs(y) - segment, 0);
    return x * x + sy * sy <= (w / 2) ** 2;
  }
  if (shape === "Hexagon") {
    const R = w / 2; // pointy-top: vertical corner-to-corner = 2R, flats on left/right
    return Math.abs(y) <= R && Math.abs(x) <= Math.sqrt(3) * R / 2 && Math.sqrt(3) * Math.abs(y) + Math.abs(x) <= Math.sqrt(3) * R;
  }
  return (x / (w / 2)) ** 2 + (y / (h / 2)) ** 2 <= 1;
}

function isPointInsidePerfBoundary(px, py, bounds) {
  const { xMin, xMax, yMin, yMax, cornerRadius: cr, circleMode } = bounds;
  if (circleMode) {
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    return Math.hypot(px - cx, py - cy) <= Math.min(xMax - xMin, yMax - yMin) / 2;
  }
  return isInsideRoundedRect(px, py, xMin, yMin, xMax, yMax, cr);
}

function estimateVisibleHoleArea(hole, shape, bounds, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const exactArea = useExit ? hole.exitArea : hole.area;
  if (w <= 0 || h <= 0) return 0;
  const angle = hole.angle || 0;
  const boxW = Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h;
  const boxH = Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
  const left = hole.x - boxW / 2, right = hole.x + boxW / 2;
  const top = hole.y - boxH / 2, bottom = hole.y + boxH / 2;

  if ([[left, top], [right, top], [left, bottom], [right, bottom]].every(([x, y]) => isPointInsidePerfBoundary(x, y, bounds))) return exactArea;
  if (bounds.circleMode) {
    const cx = (bounds.xMin + bounds.xMax) / 2, cy = (bounds.yMin + bounds.yMax) / 2;
    const panelRadius = Math.min(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin) / 2;
    if (Math.hypot(hole.x - cx, hole.y - cy) + Math.hypot(boxW, boxH) / 2 <= panelRadius) return exactArea;
  }

  const samples = 12;
  let inside = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const px = left + (sx + 0.5) * boxW / samples;
      const py = top + (sy + 0.5) * boxH / samples;
      if (isPointInsidePerfBoundary(px, py, bounds) && isPointInsideHole(px, py, hole, shape, useExit)) inside++;
    }
  }
  return boxW * boxH * inside / (samples * samples);
}

function generateHoles(params) {
  const { diameter, holeShape, holeW, holeH, patternType, pitchX, pitchY, sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, cornerRadius, customAngle, ringSpacing, circumSpacing, radialMode, centerHole } = params;
  const hw = (holeW || diameter) / 2, hh = (holeH || diameter) / 2;
  const r = Math.max(hw, hh);
  const holes = [];
  const xMin = marginLeft, xMax = sheetW - marginRight;
  const yMin = marginTop, yMax = sheetH - marginBottom;
  if (xMin >= xMax || yMin >= yMax) return holes;

  if (patternType === "Radial") {
    const cx = sheetW / 2, cy = sheetH / 2;
    const perfW = xMax - xMin, perfH = yMax - yMin;
    // Max radius for ring generation
    const maxRadiusFull = Math.hypot(perfW, perfH) / 2 + ringSpacing;
    const maxRadiusCircle = Math.min(perfW, perfH) / 2;
    const maxR = (radialMode === "Circle") ? maxRadiusCircle : maxRadiusFull;
    const numRingsAuto = Math.max(0, Math.floor(maxR / ringSpacing));

    if (centerHole) holes.push({ x: cx, y: cy, angle: 0 });
    for (let ring = 1; ring <= numRingsAuto; ring++) {
      const ringR = ring * ringSpacing;
      const count = Math.max(1, Math.floor((2 * Math.PI * ringR) / circumSpacing));
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const hx = cx + ringR * Math.cos(angle), hy = cy + ringR * Math.sin(angle);
        if (radialMode === "Circle") {
          // Only include if the hole center is within the inscribed circle
          if (Math.hypot(hx - cx, hy - cy) <= maxRadiusCircle) {
            holes.push({ x: hx, y: hy, angle });
          }
        } else {
          // Full mode: include if inside the (rounded) rect boundary
          if (cornerRadius > 0) {
            if (isInsideRoundedRect(hx, hy, xMin, yMin, xMax, yMax, cornerRadius)) holes.push({ x: hx, y: hy, angle });
          } else if (hx >= xMin - r && hx <= xMax + r && hy >= yMin - r && hy <= yMax + r) {
            holes.push({ x: hx, y: hy, angle });
          }
        }
      }
    }
    return holes;
  }

  // For 45° staggered, pitchX is the nearest-neighbor (diagonal) distance t.
  // The actual in-row horizontal pitch = t√2, offset = t/√2, vertical pitch = t/√2.
  // This produces a true 45° angle: arctan((t/√2) / (t/√2)) = 45°.
  // For 60° staggered, pitchX = in-row pitch = nearest-neighbor distance (equilateral).
  const is45 = patternType === "Staggered 45°";
  const holeHeight = holeH || diameter;
  const holeWidth = holeW || diameter;

  // Hexagon + 60° staggered → true honeycomb. Pointy-top hexagons share an edge with all
  // six neighbours, so the requested edge gap becomes a uniform ligament between facing
  // parallel edges. Circumradius R = holeWidth/2 (corner-to-corner), apothem = R·√3/2;
  // touching centres sit 2·apothem apart, so centre spacing = 2·apothem + gap and rows
  // step by spacing·√3/2 to keep the lattice equilateral (every neighbour the same gap).
  const isHexHoneycomb = holeShape === "Hexagon" && patternType === "Staggered 60°";
  const hexGap = Math.max(0, pitchX - holeWidth);
  const hexSpacing = holeWidth * Math.sqrt(3) / 2 + hexGap;

  let inRowPitchX = is45 ? pitchX * Math.SQRT2 : pitchX;
  if (isHexHoneycomb) inRowPitchX = hexSpacing;

  let offsetFn = () => 0;
  if (patternType === "Staggered 60°" || is45) {
    offsetFn = (rowIdx) => (rowIdx % 2 !== 0 ? inRowPitchX / 2 : 0);
  } else if (patternType === "Custom Angle") {
    const angleRad = (customAngle * Math.PI) / 180;
    offsetFn = (rowIdx) => (rowIdx % 2 !== 0 ? pitchY * Math.tan(angleRad) : 0);
  }

  const minEdgeGap = Math.min(pitchX - holeWidth, pitchY - holeHeight);
  const safeMinGap = Math.max(0, minEdgeGap);

  let effPY = pitchY;
  if (isHexHoneycomb) {
    // Equilateral hex lattice: row spacing = inRowPitchX·√3/2 gives a uniform gap on every edge.
    effPY = inRowPitchX * Math.sqrt(3) / 2;
  } else if (patternType === "Staggered 60°" || is45) {
    // In staggered layouts, adjacent rows are offset by inRowPitchX/2 horizontally.
    // The nearest neighbor is diagonal, so use Euclidean distance for min gap check
    // instead of purely vertical distance which over-constrains the spacing.
    const halfPX = inRowPitchX / 2;
    const holeDim = Math.max(holeWidth, holeHeight);
    const minDist = holeDim + safeMinGap;
    const staggeredMinPY = Math.sqrt(Math.max(holeHeight * holeHeight, minDist * minDist - halfPX * halfPX));
    if (patternType === "Staggered 60°") {
      effPY = Math.max(pitchX * Math.sqrt(3) / 2, staggeredMinPY);
    } else {
      // 45°: vertical pitch = t/√2 where t = pitchX (nearest-neighbor distance)
      effPY = Math.max(pitchX / Math.SQRT2, staggeredMinPY);
    }
  }

  // Center-aligned: start from panel center, expand outward
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
  // How many rows above/below center
  const rowsUp = Math.ceil((cy - yMin + r) / effPY);
  const rowsDown = Math.ceil((yMax + r - cy) / effPY);

  for (let ri = -rowsUp; ri <= rowsDown; ri++) {
    const y = cy + ri * effPY;
    if (y < yMin - r || y > yMax + r) continue;
    // Row index for offset: center row = 0
    const rowIdx = Math.abs(ri);
    const off = offsetFn(rowIdx);
    // Expand columns from center
    const colsLeft = Math.ceil((cx - xMin + r) / inRowPitchX) + 1;
    const colsRight = Math.ceil((xMax + r - cx) / inRowPitchX) + 1;
    for (let ci = -colsLeft; ci <= colsRight; ci++) {
      const x = cx + ci * inRowPitchX + off;
      if (x >= xMin - r && x <= xMax + r) {
        holes.push({ x, y });
      }
    }
  }

  // Filter by corner radius if set
  if (cornerRadius > 0) {
    return holes.filter(h => isInsideRoundedRect(h.x, h.y, xMin, yMin, xMax, yMax, cornerRadius));
  }
  return holes;
}

// ─── Overlap & ligament: shape-aware (AABB for rect/pill, circle for others) ──
function checkShapeOverlap(h1, h2, shape) {
  const w1 = h1.w, h1h = h1.h, w2 = h2.w, h2h = h2.h;
  if (shape === "Rectangle" || shape === "Pill") {
    // Conservative AABB check; radial rotation is intentionally treated safely.
    const gapX = Math.abs(h1.x - h2.x) - (w1 + w2) / 2;
    const gapY = Math.abs(h1.y - h2.y) - (h1h + h2h) / 2;
    return gapX < -0.001 && gapY < -0.001;
  }
  const r1 = Math.max(w1, h1h) / 2, r2 = Math.max(w2, h2h) / 2;
  const dx = h2.x - h1.x, dy = h2.y - h1.y;
  const dist = Math.hypot(dx, dy);
  if (shape === "Hexagon") {
    // Edge-aware: use each hexagon's reach toward the other instead of the circumradius,
    // otherwise tightly-spaced honeycombs read as overlapping when they only share edges.
    if (dist < 1e-9) return true;
    const dir = Math.atan2(dy, dx);
    return dist < hexEdgeReach(r1, dir) + hexEdgeReach(r2, dir) - 0.001;
  }
  // Circle: distance-based extent.
  return dist < r1 + r2 - 0.001;
}

function calcShapeGap(h1, h2, shape) {
  const w1 = h1.w, h1h = h1.h, w2 = h2.w, h2h = h2.h;
  if (shape === "Rectangle" || shape === "Pill") {
    const gapX = Math.abs(h1.x - h2.x) - (w1 + w2) / 2;
    const gapY = Math.abs(h1.y - h2.y) - (h1h + h2h) / 2;
    // If both axes overlap → negative (overlap); otherwise the gap is the max of the two axis gaps
    if (gapX < 0 && gapY < 0) return Math.max(gapX, gapY); // overlap amount
    if (gapX < 0) return gapY; // only Y gap matters
    if (gapY < 0) return gapX; // only X gap matters
    return Math.hypot(Math.max(0, gapX), Math.max(0, gapY)); // corner gap
  }
  const r1 = Math.max(w1, h1h) / 2, r2 = Math.max(w2, h2h) / 2;
  const dx = h2.x - h1.x, dy = h2.y - h1.y;
  const dist = Math.hypot(dx, dy);
  if (shape === "Hexagon") {
    if (dist < 1e-9) return -(r1 + r2);
    const dir = Math.atan2(dy, dx);
    return dist - hexEdgeReach(r1, dir) - hexEdgeReach(r2, dir);
  }
  return dist - r1 - r2;
}

function findOverlaps(holes, shape) {
  const overlaps = new Set();
  if (holes.length > 10000) return overlaps;
  const gridSize = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i && checkShapeOverlap(hole, holes[j], shape)) {
          overlaps.add(i); overlaps.add(j);
        }
      }
    }
  });
  return overlaps;
}

function calcMinLigament(holes, shape, nominalSpacing = 0) {
  if (holes.length < 2 || holes.length > 10000) return null;
  let minGap = Infinity;
  const maxExtent = Math.max(0.001, ...holes.map(h => Math.max(h.w, h.h)));
  const gridSize = Math.max(maxExtent * 2, nominalSpacing * 1.5);
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i) {
          const g = calcShapeGap(hole, holes[j], shape);
          if (g < minGap) minGap = g;
        }
      }
    }
  });
  return minGap === Infinity ? null : Math.max(0, minGap);
}

// ─── Theoretical OAR (unit cell based, industry standard) ────────────
function calcTheoreticalOAR(patternType, pitchX, pitchY, holeArea) {
  let cellArea;
  if (patternType === "Staggered 60°") {
    cellArea = pitchX * (pitchX * Math.sqrt(3) / 2);
  } else if (patternType === "Staggered 45°") {
    cellArea = pitchX * pitchX;
  } else {
    // Straight, Custom Angle — rectangular cell
    cellArea = pitchX * pitchY;
  }
  if (cellArea <= 0) return 0;
  return Math.min((holeArea / cellArea) * 100, 100);
}

function generateSVGString(holes, params) {
  const { sheetW, sheetH, thickness, taperAngle, taperDirection, holeShape } = params;
  const shape = holeShape || "Circle";
  const taperActive = thickness > 0 && taperAngle > 0;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">\n`;
  svg += `  <rect width="${sheetW}" height="${sheetH}" fill="#c0c0c0" />\n`;

  if (taperActive) {
    svg += `  <g id="entry-side">\n`;
    holes.forEach(pt => {
      const topW = taperDirection === "Top larger" ? pt.w : pt.exitW;
      const topH = taperDirection === "Top larger" ? pt.h : pt.exitH;
      if (topW > 0 && topH > 0) svg += holeSVGElement(pt.x, pt.y, shape, topW, topH, 'fill="#000"', '', pt.angle, pt.holeRadius);
    });
    svg += `  </g>\n  <g id="exit-side">\n`;
    holes.forEach(pt => {
      const botW = taperDirection === "Top larger" ? pt.exitW : pt.w;
      const botH = taperDirection === "Top larger" ? pt.exitH : pt.h;
      if (botW > 0 && botH > 0) svg += holeSVGElement(pt.x, pt.y, shape, botW, botH, 'fill="none"', 'stroke="#666" stroke-width="0.15"', pt.angle, pt.exitHoleRadius);
    });
    svg += `  </g>\n`;
  } else {
    holes.forEach(pt => { svg += holeSVGElement(pt.x, pt.y, shape, pt.w, pt.h, 'fill="#000"', '', pt.angle, pt.holeRadius); });
  }
  return svg + `</svg>`;
}

// ─── Gauge ───────────────────────────────────────────────────────────
function Gauge({ value, nominalValue, dark }) {
  const R = 54, S = 7, nr = R - S;
  const circ = nr * 2 * Math.PI, arc = circ * 0.75;
  const off = arc - (clamp(value, 0, 100) / 100) * arc;
  const hasGhost = nominalValue != null && Math.abs(nominalValue - value) > 0.01;
  const ghostOff = hasGhost ? arc - (clamp(nominalValue, 0, 100) / 100) * arc : 0;
  const fg = dark ? "#60a5fa" : "#2563eb";

  return (
    <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={R} cy={R} r={nr} fill="none" stroke={dark ? "#2a2a2e" : "#e2e2e8"} strokeWidth={S}
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(135 ${R} ${R})`} />
      {hasGhost && <circle cx={R} cy={R} r={nr} fill="none" stroke={dark ? "rgba(96,165,250,0.2)" : "rgba(37,99,235,0.15)"} strokeWidth={S}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={ghostOff} strokeLinecap="round" transform={`rotate(135 ${R} ${R})`}
        style={{ transition: "stroke-dashoffset 0.2s" }} />}
      <circle cx={R} cy={R} r={nr} fill="none" stroke={fg} strokeWidth={S}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(135 ${R} ${R})`}
        style={{ transition: "stroke-dashoffset 0.2s" }} />
      <text x={R} y={R - 4} textAnchor="middle" fill={dark ? "#f0f0f0" : "#111"} fontSize="22" fontWeight="600" fontFamily="'JetBrains Mono', monospace">{value.toFixed(1)}</text>
      <text x={R} y={R + 14} textAnchor="middle" fill={dark ? "#888" : "#666"} fontSize="11" fontFamily="'JetBrains Mono', monospace">% Open</text>
    </svg>
  );
}

// ─── Slider Row (improved: empty input doesn't snap) ─────────────────
function SliderRow({ label, value, min, max, step, onChange, unit, dark }) {
  const [inputVal, setInputVal] = useState(String(value));
  const inputRef = useRef(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setInputVal(String(value));
  }, [value]);

  const commitInput = () => {
    isFocused.current = false;
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed)) { setInputVal(String(value)); return; }
    const clamped = clamp(parsed, min, max);
    onChange(clamped);
    setInputVal(String(clamped));
  };

  const trackBg = dark ? "#333" : "#d4d4d8";
  const trackFg = dark ? "#60a5fa" : "#2563eb";
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: dark ? "#ccc" : "#444", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputVal}
            onFocus={() => { isFocused.current = true; inputRef.current?.select(); }}
            onBlur={commitInput}
            onKeyDown={e => { if (e.key === "Enter") { commitInput(); inputRef.current?.blur(); } }}
            onChange={e => setInputVal(e.target.value)}
            style={{
              width: 52, height: 24, fontSize: 11, textAlign: "right",
              background: dark ? "#1e1e22" : "#fff", color: dark ? "#eee" : "#222",
              border: `1px solid ${dark ? "#333" : "#d0d0d0"}`,
              borderRadius: 4, padding: "0 4px", outline: "none",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
          {unit && <span style={{ fontSize: 10, color: dark ? "#666" : "#999", fontFamily: "'JetBrains Mono', monospace" }}>{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 4, appearance: "none", outline: "none", borderRadius: 2, cursor: "pointer",
          background: `linear-gradient(to right, ${trackFg} 0%, ${trackFg} ${pct}%, ${trackBg} ${pct}%, ${trackBg} 100%)`
        }}
      />
    </div>
  );
}

// ─── Tiny Toggle ─────────────────────────────────────────────────────
function Toggle({ value, onChange, dark }) {
  const accent = dark ? "#60a5fa" : "#2563eb";
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 34, height: 18, borderRadius: 9, padding: 2, flexShrink: 0, cursor: "pointer",
      background: value ? accent : (dark ? "#333" : "#ccc"), transition: "background 0.2s",
      display: "flex", alignItems: "center",
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, background: "#fff",
        transform: value ? "translateX(16px)" : "translateX(0)",
        transition: "transform 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
      }} />
    </div>
  );
}

function ProfileIcon({ type, active, dark }) {
  const stroke = active ? (dark ? "#93c5fd" : "#1d4ed8") : (dark ? "#777" : "#777");
  const paths = {
    Ramp: "M2 15 L22 3",
    Peak: "M2 16 L12 3 L22 16",
    Valley: "M2 3 L12 16 L22 3",
    Wave: "M2 10 C5 2 9 2 12 10 C15 18 19 18 22 10",
    Noise: "M2 13 L5 6 L8 11 L11 4 L14 15 L17 8 L20 12 L22 5",
    Steps: "M2 16 L7 16 L7 12 L12 12 L12 8 L17 8 L17 4 L22 4",
  };
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
      <path d="M2 18 H22" stroke={dark ? "#333" : "#ddd"} strokeWidth="1" />
      <path d={paths[type]} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Pitch Info Display (secondary info under edge gap slider) ────────
function PitchInfo({ label, value, dark }) {
  return (
    <div style={{ fontSize: 9, color: dark ? "#555" : "#aaa", marginTop: -6, marginBottom: 8, paddingLeft: 2, fontFamily: "'JetBrains Mono', monospace" }}>
      ↔ {label}: {value.toFixed(2)} mm
    </div>
  );
}

// ─── Link Icon (for pitch sync) ──────────────────────────────────────
function LinkIcon({ linked, dark }) {
  const c = linked ? (dark ? "#60a5fa" : "#2563eb") : (dark ? "#555" : "#aaa");
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      {linked ? <>
        <path d="M6.5 9.5L9.5 6.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 11L5.5 12.5a2.12 2.12 0 0 1-3-3L4 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      </> : <>
        <path d="M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 11L5.5 12.5a2.12 2.12 0 0 1-3-3L4 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M5 3l6 10" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </>}
    </svg>
  );
}

// ─── Main App ────────────────────────────────────────────────────────
export default function PerforationGenerator() {
  const [dark, setDark] = useState(true);
  const [diameter, setDiameter] = useState(5);
  const [holeShape, setHoleShape] = useState("Circle");
  const [holeW, setHoleW] = useState(5);   // for Rectangle & Pill (mm)
  const [holeH, setHoleH] = useState(5);   // for Rectangle & Pill (mm)
  const [holeRadius, setHoleRadius] = useState(0); // corner radius for Rectangle holes
  const [patternType, setPatternType] = useState("Staggered 60°");
  const [edgeGapX, setEdgeGapX] = useState(3);
  const [edgeGapY, setEdgeGapY] = useState(3);
  const [gapLinked, setGapLinked] = useState(true);
  const [sheetW, setSheetW] = useState(200);
  const [sheetH, setSheetH] = useState(200);
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [marginLinked, setMarginLinked] = useState(true);
  const [customAngle, setCustomAngle] = useState(30);
  const [radialEdgeGap, setRadialEdgeGap] = useState(5);
  const [circumEdgeGap, setCircumEdgeGap] = useState(5);
  const [radialLinked, setRadialLinked] = useState(true);
  const [radialMode, setRadialMode] = useState("Full");  // "Full" | "Circle"
  const [centerHole, setCenterHole] = useState(false);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [thickness, setThickness] = useState(0);
  const [taperAngle, setTaperAngle] = useState(0);
  const [taperDirection, setTaperDirection] = useState("Top larger");
  const [removedHoles, setRemovedHoles] = useState(new Set());
  const [holeRemovalMode, setHoleRemovalMode] = useState(false);
  const [variation, setVariation] = useState(() => cloneVariation(DEFAULT_VARIATION));
  const [variationEditMode, setVariationEditMode] = useState(false);
  const [variationAdvanced, setVariationAdvanced] = useState(false);
  const [variationHud, setVariationHud] = useState(null);
  const variationRef = useRef(variation);
  const variationPast = useRef([]);
  const variationFuture = useRef([]);
  const [variationHistoryVersion, setVariationHistoryVersion] = useState(0);
  const variationDrag = useRef(null);
  const gizmoRef = useRef(null);
  const spacePressed = useRef(false);

  const canvasRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => { variationRef.current = variation; }, [variation]);

  useEffect(() => {
    const handleKeyDown = e => { if (e.code === "Space") spacePressed.current = true; };
    const handleKeyUp = e => { if (e.code === "Space") spacePressed.current = false; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Effective hole extents (w = horizontal, h = vertical)
  const hasCustomSize = holeShape === "Rectangle" || holeShape === "Pill";
  const effW = hasCustomSize ? holeW : diameter;
  const effH = hasCustomSize ? holeH : diameter;

  // Derived pitches (hole extent + edge gap)
  const pitchX = effW + edgeGapX;
  const pitchY = effH + edgeGapY;
  // Hexagon honeycomb (pointy-top, 60° staggered): the edge gap is a uniform ligament, so the
  // centre spacing is 2·apothem + gap (= effW·√3/2 + gap), not effW + gap.
  const isHexHoneycomb = holeShape === "Hexagon" && patternType === "Staggered 60°";
  const honeyPitchX = isHexHoneycomb ? effW * Math.sqrt(3) / 2 + edgeGapX : pitchX;
  const honeyPitchY = isHexHoneycomb ? honeyPitchX * Math.sqrt(3) / 2 : pitchY;
  const ringSpacing = diameter + radialEdgeGap;
  const circumSpacing = diameter + circumEdgeGap;

  // Shape change: sync dimensions
  const handleShapeChange = useCallback((s) => {
    if ((s === "Rectangle" || s === "Pill") && holeShape !== "Rectangle" && holeShape !== "Pill") {
      // Switching from Circle/Hex → custom size: init from diameter
      setHoleW(s === "Pill" ? diameter * 2 : diameter);
      setHoleH(diameter);
    }
    setHoleShape(s);
  }, [holeShape, diameter]);

  // Edge gap handlers
  const handleEdgeGapX = useCallback((v) => {
    setEdgeGapX(v);
    if (gapLinked) setEdgeGapY(v);
    setSelectedPreset(0);
  }, [gapLinked]);

  const handleEdgeGapY = useCallback((v) => {
    setEdgeGapY(v);
    setSelectedPreset(0);
  }, []);

  const handleRadialEdgeGap = useCallback((v) => {
    setRadialEdgeGap(v);
    if (radialLinked) setCircumEdgeGap(v);
  }, [radialLinked]);

  const handleCircumEdgeGap = useCallback((v) => {
    setCircumEdgeGap(v);
  }, []);

  const handleMarginUniform = useCallback((v) => {
    setMarginTop(v); setMarginBottom(v); setMarginLeft(v); setMarginRight(v);
  }, []);
  const hasAnyMargin = marginTop > 0 || marginBottom > 0 || marginLeft > 0 || marginRight > 0;

  const commitVariation = useCallback((nextOrUpdater) => {
    const current = variationRef.current;
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(cloneVariation(current)) : nextOrUpdater;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    variationPast.current = [...variationPast.current.slice(-39), cloneVariation(current)];
    variationFuture.current = [];
    variationRef.current = next;
    setVariation(next);
    setVariationHistoryVersion(v => v + 1);
  }, []);

  const updateVariationLive = useCallback((nextOrUpdater) => {
    const current = variationRef.current;
    const next = typeof nextOrUpdater === "function" ? nextOrUpdater(cloneVariation(current)) : nextOrUpdater;
    variationRef.current = next;
    setVariation(next);
  }, []);

  const selectedVariationLayer = useMemo(
    () => variation.layers.find(layer => layer.id === variation.selectedLayerId) || variation.layers[0],
    [variation]
  );

  const updateSelectedVariationLayer = useCallback((patch, record = false) => {
    const apply = current => ({
      ...current,
      layers: current.layers.map(layer => layer.id === current.selectedLayerId ? { ...layer, ...patch } : layer),
    });
    if (record) commitVariation(apply);
    else updateVariationLive(apply);
  }, [commitVariation, updateVariationLive]);

  const undoVariation = useCallback(() => {
    const previous = variationPast.current.pop();
    if (!previous) return;
    variationFuture.current.push(cloneVariation(variationRef.current));
    variationRef.current = previous;
    setVariation(previous);
    setVariationHistoryVersion(v => v + 1);
  }, []);

  const redoVariation = useCallback(() => {
    const next = variationFuture.current.pop();
    if (!next) return;
    variationPast.current.push(cloneVariation(variationRef.current));
    variationRef.current = next;
    setVariation(next);
    setVariationHistoryVersion(v => v + 1);
  }, []);

  const applyVariationPreset = useCallback((name) => {
    const preset = VARIATION_PRESETS[name];
    if (!preset) return;
    commitVariation(current => {
      const selectedId = current.selectedLayerId || current.layers[0]?.id || "layer-1";
      const baseLayer = current.layers.find(layer => layer.id === selectedId) || current.layers[0] || createVariationLayer(1);
      return {
        ...current,
        enabled: true,
        minScale: preset.minScale,
        maxScale: preset.maxScale,
        selectedLayerId: baseLayer.id,
        layers: [{ ...baseLayer, ...preset.layer, enabled: true }],
      };
    });
    setVariationEditMode(true);
  }, [commitVariation]);

  const addVariationLayer = useCallback(() => {
    if (variationRef.current.layers.length >= 3) return;
    commitVariation(current => {
      const layer = createVariationLayer(current.layers.length + 1);
      return { ...current, enabled: true, layers: [...current.layers, layer], selectedLayerId: layer.id };
    });
  }, [commitVariation]);

  const removeSelectedVariationLayer = useCallback(() => {
    if (variationRef.current.layers.length <= 1) return;
    commitVariation(current => {
      const layers = current.layers.filter(layer => layer.id !== current.selectedLayerId);
      return { ...current, layers, selectedLayerId: layers[0].id };
    });
  }, [commitVariation]);

  const randomizeVariation = useCallback(() => {
    commitVariation(current => ({
      ...current,
      enabled: true,
      layers: current.layers.map(layer => randomizeVariationLayer(layer)),
    }));
    setVariationEditMode(true);
  }, [commitVariation]);

  const params = useMemo(() => ({
    diameter, holeShape, holeW: effW, holeH: effH, holeRadius, patternType, pitchX, pitchY, sheetW, sheetH,
    marginTop, marginBottom, marginLeft, marginRight, cornerRadius,
    customAngle, ringSpacing, circumSpacing, radialMode, centerHole,
    thickness, taperAngle, taperDirection
  }), [diameter, holeShape, effW, effH, holeRadius, patternType, pitchX, pitchY, sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, cornerRadius, customAngle, ringSpacing, circumSpacing, radialMode, centerHole, thickness, taperAngle, taperDirection]);

  const baseHoles = useMemo(() => generateHoles(params), [params]);
  // Reset removed holes when pattern params change
  useEffect(() => { setRemovedHoles(new Set()); }, [params]);
  const isRadialPattern = patternType === "Radial";
  const perfW = sheetW - marginLeft - marginRight, perfH = sheetH - marginTop - marginBottom;
  const taperActive = thickness > 0 && taperAngle > 0;
  const taperInset = taperActive ? 2 * thickness * Math.tan((taperAngle * Math.PI) / 180) : 0;

  const holes = useMemo(() => baseHoles.map((hole, index) => {
    const nx = perfW > 0 ? clamp((hole.x - marginLeft) / perfW, 0, 1) : 0.5;
    const ny = perfH > 0 ? clamp((hole.y - marginTop) / perfH, 0, 1) : 0.5;
    const scale = variationScaleAt(nx, ny, variation, index + 1);
    const w = Math.max(0.01, effW * scale);
    const h = Math.max(0.01, effH * scale);
    const culled = variation.enabled && variation.cullBelow > 0 && Math.min(w, h) < variation.cullBelow;
    const scaledRadius = Math.min(holeRadius * scale, w / 2, h / 2);
    const exitW = taperActive ? Math.max(0, w - taperInset) : w;
    const exitH = taperActive ? Math.max(0, h - taperInset) : h;
    const exitHoleRadius = Math.max(0, Math.min(scaledRadius - taperInset / 2, exitW / 2, exitH / 2));
    return {
      ...hole,
      id: hole.id || `hole-${index}`,
      culled,
      fieldValue: variation.enabled ? evaluateVariationField(nx, ny, variation, index + 1) : 1,
      scale, w, h, holeRadius: scaledRadius,
      area: calcHoleArea(holeShape, w, h, scaledRadius),
      exitW, exitH, exitHoleRadius,
      exitArea: exitW > 0 && exitH > 0 ? calcHoleArea(holeShape, exitW, exitH, exitHoleRadius) : 0,
      isClosed: taperActive && (exitW <= 0 || exitH <= 0),
    };
  }), [baseHoles, perfW, perfH, marginLeft, marginTop, variation, effW, effH, holeRadius, taperActive, taperInset, holeShape]);

  const activeHoles = useMemo(() => holes.filter((hole, i) => !removedHoles.has(i) && !hole.culled), [holes, removedHoles]);
  const activeHoleCount = activeHoles.length;
  const culledHoleCount = useMemo(() => holes.reduce((n, hole, i) => n + (hole.culled && !removedHoles.has(i) ? 1 : 0), 0), [holes, removedHoles]);
  const overlaps = useMemo(() => findOverlaps(activeHoles, holeShape), [activeHoles, holeShape]);
  const hasOverlap = overlaps.size > 0;
  const holeCount = holes.length;
  const grossArea = sheetW * sheetH;
  const radialCircleRadius = Math.min(perfW, perfH) / 2;
  const perforatedArea = (isRadialPattern && radialMode === "Circle")
    ? Math.PI * radialCircleRadius * radialCircleRadius
    : roundedRectArea(perfW, perfH, cornerRadius);
  const perfBounds = useMemo(() => ({
    xMin: marginLeft,
    xMax: sheetW - marginRight,
    yMin: marginTop,
    yMax: sheetH - marginBottom,
    cornerRadius,
    circleMode: isRadialPattern && radialMode === "Circle",
  }), [marginLeft, marginRight, marginTop, marginBottom, sheetW, sheetH, cornerRadius, isRadialPattern, radialMode]);
  const visibleAreaTotals = useMemo(() => activeHoles.reduce((totals, hole) => ({
    nominal: totals.nominal + estimateVisibleHoleArea(hole, holeShape, perfBounds, false),
    exit: totals.exit + estimateVisibleHoleArea(hole, holeShape, perfBounds, true),
  }), { nominal: 0, exit: 0 }), [activeHoles, holeShape, perfBounds]);
  const totalHoleArea = visibleAreaTotals.nominal;
  const totalExitHoleArea = visibleAreaTotals.exit;
  const singleHoleArea = activeHoleCount > 0 ? totalHoleArea / activeHoleCount : 0;

  // OAR calculation: use counted OAR when holes removed or margins present; else theoretical
  const hasRemovedHoles = removedHoles.size > 0;
  const useCountedOAR = variation.enabled || hasRemovedHoles || hasAnyMargin || cornerRadius > 0 || isRadialPattern;
  const theoreticalHoleArea = calcHoleArea(holeShape, effW, effH, holeRadius);
  const theoreticalOAR = calcTheoreticalOAR(patternType, honeyPitchX, honeyPitchY, theoreticalHoleArea);
  const countedOAR = perforatedArea > 0 ? (totalHoleArea / perforatedArea) * 100 : 0;
  const nominalOAR = useCountedOAR ? countedOAR : theoreticalOAR;

  const closedHoleCount = activeHoles.filter(hole => hole.isClosed).length;
  const holeClosed = activeHoleCount > 0 && closedHoleCount === activeHoleCount;
  const hasClosedHoles = closedHoleCount > 0;
  const dExitValues = activeHoles.filter(hole => !hole.isClosed).map(hole => Math.min(hole.exitW, hole.exitH));
  const dExit = dExitValues.length ? dExitValues.reduce((sum, value) => sum + value, 0) / dExitValues.length : 0;
  const minExit = dExitValues.length ? Math.min(...dExitValues) : 0;
  const maxExit = dExitValues.length ? Math.max(...dExitValues) : 0;
  const theoreticalExitW = taperActive ? Math.max(0, effW - taperInset) : effW;
  const theoreticalExitH = taperActive ? Math.max(0, effH - taperInset) : effH;
  const theoreticalExitRadius = Math.max(0, Math.min(holeRadius - taperInset / 2, theoreticalExitW / 2, theoreticalExitH / 2));
  const theoreticalExitArea = theoreticalExitW > 0 && theoreticalExitH > 0 ? calcHoleArea(holeShape, theoreticalExitW, theoreticalExitH, theoreticalExitRadius) : 0;
  const theoreticalEffOAR = calcTheoreticalOAR(patternType, honeyPitchX, honeyPitchY, theoreticalExitArea);
  const countedEffOAR = perforatedArea > 0 ? (totalExitHoleArea / perforatedArea) * 100 : 0;
  const effectiveOAR = useCountedOAR ? countedEffOAR : theoreticalEffOAR;
  const oarDelta = taperActive ? effectiveOAR - nominalOAR : 0;
  const displayOAR = taperActive ? effectiveOAR : nominalOAR;
  const nominalNeighborSpacing = isRadialPattern ? Math.max(ringSpacing, circumSpacing) : Math.max(pitchX, pitchY);
  const minLigament = useMemo(() => calcMinLigament(activeHoles, holeShape, nominalNeighborSpacing), [activeHoles, holeShape, nominalNeighborSpacing]);
  const perfMode = holeCount > 10000;

  const applyPreset = useCallback((idx) => {
    setSelectedPreset(idx);
    if (idx === 0) return;
    const p = DIN_PRESETS[idx];
    setDiameter(p.d);
    setEdgeGapX(Math.max(0, p.pitchX - p.d));
    setEdgeGapY(Math.max(0, p.pitchY - p.d));
    setPatternType(p.pattern);
  }, []);

  // ─── Canvas rendering ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = rect.width, ch = rect.height;

    ctx.fillStyle = dark ? "#0f0f11" : "#e8e8ec";
    ctx.fillRect(0, 0, cw, ch);

    const fitScale = Math.min((cw - 80) / sheetW, (ch - 80) / sheetH);
    const baseScale = fitScale * zoom;
    const cx = cw / 2 + pan.x, cy = ch / 2 + pan.y;
    // Store the view transform so pointer handlers can convert client <-> sheet space.
    gizmoRef.current = { baseScale, originX: cx - baseScale * sheetW / 2, originY: cy - baseScale * sheetH / 2 };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(baseScale, baseScale);
    ctx.translate(-sheetW / 2, -sheetH / 2);

    // Sheet shadow
    ctx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 20 / baseScale;
    ctx.shadowOffsetX = 3 / baseScale; ctx.shadowOffsetY = 3 / baseScale;
    ctx.fillStyle = dark ? "#3a3a40" : "#c8c8cd";
    ctx.fillRect(0, 0, sheetW, sheetH);
    ctx.shadowColor = "transparent";

    ctx.fillStyle = dark ? "#48484f" : "#d4d4da";
    ctx.fillRect(0, 0, sheetW, sheetH);

    {
      const mx = marginLeft, my = marginTop;
      const mw = sheetW - marginLeft - marginRight, mh = sheetH - marginTop - marginBottom;
      const cr = Math.min(cornerRadius, mw / 2, mh / 2);
      const isCircleMode = isRadialPattern && radialMode === "Circle";
      const showBoundary = hasAnyMargin || cornerRadius > 0 || isCircleMode;
      if (showBoundary) {
        ctx.strokeStyle = dark ? "rgba(100,160,250,0.15)" : "rgba(37,99,235,0.1)";
        ctx.lineWidth = 0.3; ctx.setLineDash([2, 2]);
        ctx.beginPath();
        if (isCircleMode) {
          const cRadius = Math.min(mw, mh) / 2;
          ctx.arc(mx + mw / 2, my + mh / 2, cRadius, 0, Math.PI * 2);
        } else {
          ctx.roundRect(mx, my, mw, mh, cr);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Shade outside
        ctx.fillStyle = dark ? "rgba(100,160,250,0.04)" : "rgba(37,99,235,0.03)";
        ctx.fillRect(0, 0, sheetW, sheetH);
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        if (isCircleMode) {
          const cRadius = Math.min(mw, mh) / 2;
          ctx.arc(mx + mw / 2, my + mh / 2, cRadius, 0, Math.PI * 2);
        } else {
          ctx.roundRect(mx, my, mw, mh, cr);
        }
        ctx.fill();
        ctx.restore();
      }
    }

    if (variation.enabled && variationEditMode) {
      const cols = 34, rows = Math.max(18, Math.round(cols * perfH / Math.max(1, perfW)));
      const cellW = perfW / cols, cellH = perfH / rows;
      ctx.save();
      ctx.globalCompositeOperation = dark ? "screen" : "multiply";
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const value = evaluateVariationField((gx + 0.5) / cols, (gy + 0.5) / rows, variation, gy * cols + gx + 1);
          const alpha = 0.015 + value * 0.075;
          ctx.fillStyle = dark ? `rgba(70,135,255,${alpha})` : `rgba(37,99,235,${alpha * 0.7})`;
          ctx.fillRect(marginLeft + gx * cellW, marginTop + gy * cellH, cellW + 0.05, cellH + 0.05);
        }
      }
      ctx.restore();
    }

    const showTaperRings = taperActive && !perfMode;

    // Clip holes to sheet boundary
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, sheetW, sheetH);
    ctx.clip();

    if (perfMode) {
      ctx.fillStyle = dark ? "#0a0a0c" : "#1a1a1e";
      holes.forEach((h, i) => {
        if (removedHoles.has(i) || h.culled) return;
        ctx.fillRect(h.x - h.w * 0.35, h.y - h.h * 0.35, h.w * 0.7, h.h * 0.7);
      });
    } else {
      // Build overlap set based on active (non-removed, non-culled) holes mapping
      const activeIndices = [];
      holes.forEach((h, i) => { if (!removedHoles.has(i) && !h.culled) activeIndices.push(i); });
      const activeOverlapSet = new Set();
      overlaps.forEach((activeIdx) => {
        if (activeIdx < activeIndices.length) activeOverlapSet.add(activeIndices[activeIdx]);
      });

      holes.forEach((h, i) => {
        const isRemoved = removedHoles.has(i);
        const r = Math.max(h.w, h.h) / 2;
        if (h.culled && !isRemoved) {
          // Culled by the size floor: gone from the real pattern. Show a faint ghost only while editing.
          if (variation.enabled && variationEditMode) {
            ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(0.15, r), 0, Math.PI * 2);
            ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
            ctx.lineWidth = 0.2; ctx.setLineDash([0.6, 0.6]); ctx.stroke(); ctx.setLineDash([]);
          }
          return;
        }
        if (isRemoved) {
          // Draw removed hole as faint outline
          ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
          ctx.strokeStyle = dark ? "rgba(255,100,100,0.25)" : "rgba(200,50,50,0.2)";
          ctx.lineWidth = 0.4;
          ctx.setLineDash([1, 1]); ctx.stroke(); ctx.setLineDash([]);
          // Draw X mark
          ctx.strokeStyle = dark ? "rgba(255,100,100,0.35)" : "rgba(200,50,50,0.3)";
          ctx.lineWidth = 0.3;
          const xr = r * 0.5;
          ctx.beginPath(); ctx.moveTo(h.x - xr, h.y - xr); ctx.lineTo(h.x + xr, h.y + xr); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(h.x + xr, h.y - xr); ctx.lineTo(h.x - xr, h.y + xr); ctx.stroke();
          return;
        }
        const isOverlap = activeOverlapSet.has(i);
        const isClosed = h.isClosed;
        // Draw hole shape
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
        ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
          : isOverlap ? (dark ? "rgba(220,50,50,0.7)" : "rgba(200,30,30,0.6)")
          : (dark ? "#0f0f11" : "#1a1a1e");
        ctx.fill();
        if (showTaperRings && !isClosed) {
          ctx.strokeStyle = dark ? "rgba(200,200,210,0.4)" : "rgba(60,60,70,0.35)";
          ctx.lineWidth = 0.25; ctx.stroke();
        }
        // Subtle gradient for non-circle only on circle (skip for complex shapes for perf)
        if (holeShape === "Circle" && !isOverlap && !isClosed && zoom > 0.5) {
          const grad = ctx.createRadialGradient(h.x - r * 0.2, h.y - r * 0.2, 0, h.x, h.y, r);
          grad.addColorStop(0, dark ? "rgba(40,40,45,0.3)" : "rgba(60,60,65,0.2)");
          grad.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
        // Taper ring: fill gap between entry and exit shapes
        if (showTaperRings && h.exitW > 0 && h.exitH > 0 && !isClosed) {
          ctx.beginPath();
          traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
          // Cut out the exit shape (reverse winding)
          ctx.save();
          ctx.clip();
          // Fill the entire clipped area, then clear the exit shape
          ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
          ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
          // Clear exit shape by drawing it with the hole color
          ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius);
          ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
            : (dark ? "#0f0f11" : "#1a1a1e");
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // End hole clipping
    ctx.restore();

    ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.5; ctx.strokeRect(0, 0, sheetW, sheetH);

    if (variation.enabled && variationEditMode && selectedVariationLayer) {
      const px = 1 / baseScale;                       // one screen pixel in sheet units
      const g = computeGizmo(selectedVariationLayer, { marginLeft, marginTop, perfW, perfH }, 12 * px);
      const accent = dark ? "#93c5fd" : "#2563eb";
      const dialColor = dark ? "#fbbf24" : "#d97706";
      const space = selectedVariationLayer.space;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, sheetW, sheetH); ctx.clip();

      // Spread ring (where the field reaches) — meaningful for radial-like spaces.
      if (space === "Radial" || space === "Spiral") {
        ctx.strokeStyle = accent; ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1 * px; ctx.setLineDash([4 * px, 4 * px]);
        ctx.beginPath(); ctx.arc(g.centerX, g.centerY, g.reachLen, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // Gradient line: center (start) -> reach (end).
      ctx.strokeStyle = accent; ctx.lineWidth = 1.4 * px;
      ctx.beginPath(); ctx.moveTo(g.centerX, g.centerY); ctx.lineTo(g.reachX, g.reachY); ctx.stroke();

      // Curve dial: rotary track + needle hugging the centre (lens-blur amount ring).
      ctx.strokeStyle = dialColor; ctx.globalAlpha = 0.35; ctx.lineWidth = 1 * px;
      ctx.beginPath(); ctx.arc(g.centerX, g.centerY, g.dialR, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(g.centerX, g.centerY); ctx.lineTo(g.curveX, g.curveY); ctx.stroke();
      ctx.globalAlpha = 1;

      // Reach handle (open ring) — gradient end point.
      ctx.strokeStyle = accent; ctx.lineWidth = 1.6 * px;
      ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
      ctx.beginPath(); ctx.arc(g.reachX, g.reachY, 5 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Position/phase stop (filled diamond) — slides along the gradient line.
      ctx.fillStyle = accent; ctx.strokeStyle = dark ? "#0f0f11" : "#ffffff"; ctx.lineWidth = 1 * px;
      ctx.save(); ctx.translate(g.stopX, g.stopY); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3.4 * px, -3.4 * px, 6.8 * px, 6.8 * px);
      ctx.strokeRect(-3.4 * px, -3.4 * px, 6.8 * px, 6.8 * px); ctx.restore();

      // Curve knob (filled dot on the dial).
      ctx.fillStyle = dialColor; ctx.strokeStyle = dark ? "#0f0f11" : "#ffffff"; ctx.lineWidth = 1 * px;
      ctx.beginPath(); ctx.arc(g.curveX, g.curveY, 4 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Center handle (filled dot with light core) — gradient start.
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(g.centerX, g.centerY, 5.5 * px, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
      ctx.beginPath(); ctx.arc(g.centerX, g.centerY, 2 * px, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    }
    ctx.restore();

    if (perfMode) {
      ctx.fillStyle = dark ? "rgba(220,160,40,0.85)" : "rgba(180,120,20,0.9)";
      ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText(`⚡ Performance mode (${holeCount.toLocaleString()} holes)`, 12, ch - 12);
    }
  }, [holes, overlaps, params, dark, pan, zoom, perfMode, holeCount, holeShape, pitchX, pitchY, patternType, marginTop, marginBottom, marginLeft, marginRight, hasAnyMargin, cornerRadius, radialMode, isRadialPattern, sheetW, sheetH, taperActive, thickness, taperAngle, taperDirection, removedHoles, variation, variationEditMode, selectedVariationLayer, perfW, perfH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      canvas.style.width = containerRef.current.getBoundingClientRect().width + "px";
      canvas.style.height = containerRef.current.getBoundingClientRect().height + "px";
      setPan(p => ({ ...p }));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(z => {
      const nz = clamp(z * factor, 0.1, 20);
      const scale = nz / z;
      setPan(p => ({
        x: mx - scale * (mx - p.x - cx) - cx,
        y: my - scale * (my - p.y - cy) - cy,
      }));
      return nz;
    });
  }, []);

  const pointerDownPos = useRef(null);
  const clientToSheet = useCallback((clientX, clientY) => {
    const view = gizmoRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!view || !rect) return null;
    return {
      x: (clientX - rect.left - view.originX) / view.baseScale,
      y: (clientY - rect.top - view.originY) / view.baseScale,
    };
  }, []);
  const selectedLayerLive = useCallback(() => {
    const v = variationRef.current;
    return v.layers.find(l => l.id === v.selectedLayerId) || v.layers[0];
  }, []);
  const setShapeHud = useCallback((layer) => {
    const usesPosition = gizmoUsesPosition(layer);
    setVariationHud({
      positionLabel: usesPosition ? "Position" : "Phase",
      positionValue: usesPosition ? layer.position : layer.phase,
      exponent: layer.exponent,
    });
  }, []);
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    const view = gizmoRef.current;
    if (variation.enabled && variationEditMode && !spacePressed.current && selectedVariationLayer && view) {
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (sheet) {
        const geom = { marginLeft, marginTop, perfW, perfH };
        const g = computeGizmo(selectedVariationLayer, geom, 12 / view.baseScale);
        const candidates = [
          { handle: "stop", x: g.stopX, y: g.stopY },
          { handle: "curve", x: g.curveX, y: g.curveY },
          { handle: "reach", x: g.reachX, y: g.reachY },
          { handle: "center", x: g.centerX, y: g.centerY },
        ];
        let hit = null, hitDist = 16; // screen-px hit radius
        for (const c of candidates) {
          const d = Math.hypot(c.x - sheet.x, c.y - sheet.y) * view.baseScale;
          if (d < hitDist) { hit = c.handle; hitDist = d; }
        }
        if (hit) {
          variationDrag.current = { handle: hit, startVariation: cloneVariation(variationRef.current) };
          if (hit === "stop" || hit === "curve") setShapeHud(selectedVariationLayer); else setVariationHud(null);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan, variation.enabled, variationEditMode, selectedVariationLayer, marginLeft, marginTop, perfW, perfH, clientToSheet, setShapeHud]);
  const handlePointerMove = useCallback((e) => {
    if (variationDrag.current) {
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (!sheet) return;
      const layer = selectedLayerLive();
      if (!layer) return;
      const geom = { marginLeft, marginTop, perfW, perfH };
      const handle = variationDrag.current.handle;
      let patch;
      const shift = e.shiftKey;
      if (handle === "center") patch = gizmoPatchForCenter(sheet.x, sheet.y, geom, shift);
      else if (handle === "reach") patch = gizmoPatchForReach(sheet.x, sheet.y, layer, geom, layer.space === "Angular", shift);
      else if (handle === "stop") patch = gizmoPatchForStop(sheet.x, sheet.y, layer, geom, shift);
      else patch = gizmoPatchForCurve(sheet.x, sheet.y, layer, geom, shift);
      updateVariationLive(current => ({
        ...current,
        layers: current.layers.map(l => l.id === current.selectedLayerId ? { ...l, ...patch } : l),
      }));
      if (handle === "stop" || handle === "curve") setShapeHud({ ...layer, ...patch });
      return;
    }
    if (!isPanning) return;
    setPan({ x: panOrigin.current.x + (e.clientX - panStart.current.x), y: panOrigin.current.y + (e.clientY - panStart.current.y) });
  }, [isPanning, updateVariationLive, clientToSheet, selectedLayerLive, marginLeft, marginTop, perfW, perfH, setShapeHud]);
  const handlePointerUp = useCallback((e) => {
    if (variationDrag.current) {
      const startVariation = variationDrag.current.startVariation;
      variationDrag.current = null;
      if (JSON.stringify(startVariation) !== JSON.stringify(variationRef.current)) {
        variationPast.current = [...variationPast.current.slice(-39), startVariation];
        variationFuture.current = [];
        setVariationHistoryVersion(v => v + 1);
      }
      window.setTimeout(() => setVariationHud(null), 650);
      pointerDownPos.current = null;
      return;
    }
    setIsPanning(false);
    // Detect click (not drag) for hole removal
    if (holeRemovalMode && pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cw = rect.width, ch = rect.height;
        const fitScale = Math.min((cw - 80) / sheetW, (ch - 80) / sheetH);
        const baseScale = fitScale * zoom;
        const cx = cw / 2 + pan.x, cy = ch / 2 + pan.y;
        // Convert screen coords to sheet coords
        const sheetX = (clickX - cx) / baseScale + sheetW / 2;
        const sheetY = (clickY - cy) / baseScale + sheetH / 2;
        // Find closest hole using each hole's current, varied size.
        let closestIdx = -1, closestDist = Infinity;
        holes.forEach((h, i) => {
          if (h.culled) return; // already gone from the pattern
          const d = Math.hypot(h.x - sheetX, h.y - sheetY);
          const hitRadius = Math.max(1.5, Math.max(h.w, h.h) * 0.75);
          if (d < hitRadius && d < closestDist) { closestDist = d; closestIdx = i; }
        });
        if (closestIdx >= 0) {
          setRemovedHoles(prev => {
            const next = new Set(prev);
            if (next.has(closestIdx)) next.delete(closestIdx);
            else next.add(closestIdx);
            return next;
          });
        }
      }
    }
    pointerDownPos.current = null;
  }, [holeRemovalMode, holes, sheetW, sheetH, zoom, pan]);

  // Exports
  const exportSVG = useCallback(() => {
    const blob = new Blob([generateSVGString(activeHoles, params)], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perforation_pattern.svg"; a.click();
  }, [activeHoles, params]);

  const exportPNG = useCallback(() => {
    const oc = document.createElement("canvas");
    oc.width = sheetW * 8; oc.height = sheetH * 8;
    const ctx = oc.getContext("2d");
    const s = Math.min(oc.width / sheetW, oc.height / sheetH);
    ctx.fillStyle = dark ? "#48484f" : "#d4d4da"; ctx.fillRect(0, 0, oc.width, oc.height);
    ctx.save(); ctx.scale(s, s);
    activeHoles.forEach(h => {
      ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
      ctx.fillStyle = h.isClosed ? "rgba(200,30,30,0.5)" : (dark ? "#0f0f11" : "#1a1a1e");
      ctx.fill();
      if (taperActive && h.exitW > 0 && h.exitH > 0 && !h.isClosed) {
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
        ctx.save(); ctx.clip();
        ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
        ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius);
        ctx.fillStyle = (dark ? "#0f0f11" : "#1a1a1e");
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
    oc.toBlob(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perforation_pattern.png"; a.click(); });
  }, [activeHoles, sheetW, sheetH, holeShape, dark, taperActive]);

  // Theme
  const sidebarBorder = dark ? "#27272a" : "#e0e0e5";
  const textPrimary = dark ? "#e4e4e7" : "#18181b";
  const textSecondary = dark ? "#71717a" : "#71717a";
  const sectionBorder = dark ? "#222225" : "#ececf0";
  const controlBg = dark ? "#1e1e22" : "#fafafa";
  const btnBg = dark ? "#27272a" : "#e8e8ec";
  const accentColor = dark ? "#60a5fa" : "#2563eb";
  const warnColor = "#ef4444";
  const sectionStyle = { padding: "14px 0", borderBottom: `1px solid ${sectionBorder}` };
  const sectionTitle = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: textSecondary, marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" };

  const isRadial = patternType === "Radial";
  const showGapY = patternType === "Straight" || patternType === "Custom Angle";
  // Effective pitchY for staggered patterns (auto-derived)
  // Uses diagonal distance check: in staggered layouts, nearest neighbor is at (pitchX/2, effPY)
  const _sHalfPX = pitchX / 2;
  const _sMinGap = Math.min(edgeGapX, edgeGapY);
  const _sHoleDim = Math.max(effW, effH);
  const _sMinDist = _sHoleDim + _sMinGap;
  const _sMinPY = Math.sqrt(Math.max(effH * effH, _sMinDist * _sMinDist - _sHalfPX * _sHalfPX));
  const effPitchX = honeyPitchX;
  const effPitchY = isHexHoneycomb
    ? honeyPitchY
    : patternType === "Staggered 60°"
      ? Math.max(pitchX * Math.sqrt(3) / 2, _sMinPY)
      : patternType === "Staggered 45°"
        ? Math.max(pitchX, _sMinPY)
        : pitchY;
  const canUndoVariation = variationHistoryVersion >= 0 && variationPast.current.length > 0;
  const canRedoVariation = variationHistoryVersion >= 0 && variationFuture.current.length > 0;

  // Segmented button helper
  const SegBtn = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      flex: 1, padding: "6px 8px", fontSize: 10, borderRadius: 4,
      border: `1px solid ${active ? accentColor : sidebarBorder}`,
      background: active ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent",
      color: active ? accentColor : textSecondary,
      cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s"
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: dark ? "#111113" : "#f2f2f5", color: textPrimary, fontFamily: "'JetBrains Mono', -apple-system, sans-serif", overflow: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", height: "100%", cursor: variation.enabled && variationEditMode ? "crosshair" : isPanning ? "grabbing" : holeRemovalMode ? "crosshair" : "grab", touchAction: "none" }}
          onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        />
        {/* Top-left: key stats + warnings */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          {/* OAR + Holes summary */}
          <div style={{ background: dark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", padding: "8px 12px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: accentColor, lineHeight: 1 }}>{displayOAR.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: textSecondary }}>% OAR</span>
              {taperActive && <span style={{ fontSize: 9, color: dark ? "#f87171" : "#dc2626", marginLeft: 2 }}>{oarDelta < 0 ? `(${oarDelta.toFixed(1)}%p taper)` : ""}</span>}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>Holes <span style={{ color: textPrimary, fontWeight: 500 }}>{activeHoleCount.toLocaleString()}</span>{hasRemovedHoles ? <span style={{ color: warnColor }}> / {holeCount.toLocaleString()}</span> : ""}</span>
              <span style={{ fontSize: 10, color: textSecondary }}>{zoom.toFixed(1)}x</span>
            </div>
          </div>
          {/* Warning badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {hasOverlap && <span style={{ fontSize: 10, color: "#fff", background: warnColor, padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>⚠ Holes overlap</span>}
            {taperActive && hasClosedHoles && <span style={{ fontSize: 10, color: "#fff", background: warnColor, padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>⚠ {closedHoleCount}/{activeHoleCount} holes closed</span>}
            {holeRemovalMode && <span style={{ fontSize: 10, color: "#fff", background: dark ? "#7c3aed" : "#6d28d9", padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>HOLE REMOVAL MODE{removedHoles.size > 0 ? ` (${removedHoles.size} removed)` : ""}</span>}
            {variation.enabled && variationEditMode && <span style={{ fontSize: 10, color: "#fff", background: dark ? "#2563eb" : "#1d4ed8", padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>EDIT VARIATION · SPACE TO PAN</span>}
          </div>
        </div>
        {variationHud && (
          <div style={{ position: "absolute", right: 18, bottom: 18, width: 190, padding: "10px 12px", borderRadius: 7, background: dark ? "rgba(10,10,14,0.82)" : "rgba(255,255,255,0.88)", border: `1px solid ${dark ? "rgba(147,197,253,0.25)" : "rgba(37,99,235,0.2)"}`, backdropFilter: "blur(12px)", pointerEvents: "none", boxShadow: "0 8px 28px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: textSecondary, marginBottom: 5 }}><span>{variationHud.positionLabel}</span><span style={{ color: accentColor }}>{variationHud.positionValue.toFixed(2)}</span></div>
            <div style={{ height: 2, borderRadius: 2, background: dark ? "#292933" : "#ddd", marginBottom: 8 }}><div style={{ width: `${variationHud.positionValue * 100}%`, height: "100%", background: accentColor }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: textSecondary, marginBottom: 5 }}><span>Curve</span><span style={{ color: accentColor }}>{variationHud.exponent.toFixed(2)}</span></div>
            <div style={{ height: 2, borderRadius: 2, background: dark ? "#292933" : "#ddd" }}><div style={{ width: `${clamp(variationHud.exponent / 5, 0, 1) * 100}%`, height: "100%", background: accentColor }} /></div>
          </div>
        )}
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: textSecondary, background: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)", padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", backdropFilter: "blur(8px)" }}>
          Reset View
        </button>
      </div>

      {/* Sidebar */}
      <div style={{ width: 440, minWidth: 440, height: "100vh", overflowY: "auto", overflowX: "hidden", background: dark ? "#18181b" : "#ffffff", borderLeft: `1px solid ${sidebarBorder}`, padding: "0 20px", boxSizing: "border-box", scrollbarWidth: "thin", scrollbarColor: dark ? "#333 transparent" : "#ccc transparent" }}>

        {/* Header */}
        <div style={{ padding: "14px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${sectionBorder}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3 }}>Perf Pattern</div>
            <div style={{ fontSize: 9, color: textSecondary, marginTop: 2, letterSpacing: 0.5 }}>CIRCULAR PERFORATION GENERATOR</div>
          </div>
          <button onClick={() => setDark(d => !d)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${sidebarBorder}`, background: controlBg, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: textPrimary }}>
            {dark ? "☀" : "☽"}
          </button>
        </div>

        {/* Gauge + Stats */}
        <div style={{ ...sectionStyle, textAlign: "center" }}>
          <Gauge value={clamp(displayOAR, 0, 100)} nominalValue={taperActive ? clamp(nominalOAR, 0, 100) : null} dark={dark} />

          {taperActive && (
            <div style={{ margin: "8px 0 4px", padding: "6px 8px", borderRadius: 5, background: dark ? "rgba(96,165,250,0.06)" : "rgba(37,99,235,0.04)", border: `1px solid ${dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.1)"}`, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: textSecondary }}>Surface OAR</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: dark ? "#999" : "#666" }}>{nominalOAR.toFixed(1)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: textSecondary }}>Effective OAR (through-thickness)</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>{effectiveOAR.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 9, color: oarDelta < 0 ? (dark ? "#f87171" : "#dc2626") : textSecondary, textAlign: "center", padding: "2px 0 0", borderTop: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
                {oarDelta < 0 ? `${oarDelta.toFixed(1)}%p due to taper` : "No taper loss"}
              </div>
              {dExit > 0 && !holeClosed && <div style={{ fontSize: 9, color: textSecondary, textAlign: "center", marginTop: 3 }}>{variation.enabled ? `exit range = ${minExit.toFixed(2)}–${maxExit.toFixed(2)} mm` : `d_exit = ${dExit.toFixed(2)} mm`}</div>}
            </div>
          )}
          {taperActive && hasClosedHoles && (
            <div style={{ margin: "6px 0", padding: "6px 8px", borderRadius: 5, background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`, fontSize: 10, color: warnColor, textAlign: "left", lineHeight: 1.4 }}>
              Taper closes {closedHoleCount} varied hole{closedHoleCount === 1 ? "" : "s"} at this thickness. Raise the minimum scale, reduce angle, or increase the base size.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginTop: 8 }}>
            {[
              ["Total Holes", holeCount.toLocaleString()],
              ["Active Holes", hasRemovedHoles ? activeHoleCount.toLocaleString() : holeCount.toLocaleString()],
              [variation.enabled ? "Avg Hole Area" : "Hole Area", `${singleHoleArea.toFixed(2)} mm²`],
              ["Open Area", `${totalHoleArea.toFixed(1)} mm²`],
              ["Panel Area", `${grossArea.toFixed(0)} mm²`],
              ["Perf. Area", `${perforatedArea.toFixed(0)} mm²`],
            ].map(([l, v]) => (
              <div key={l} style={{ textAlign: "left" }}>
                <div style={{ fontSize: 9, color: textSecondary }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          {minLigament !== null && (
            <div style={{ marginTop: 8, padding: "5px 8px", borderRadius: 4, background: minLigament <= 0 ? (dark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)") : (dark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.08)"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: textSecondary }}>Min Ligament</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: minLigament <= 0 ? warnColor : accentColor }}>{minLigament.toFixed(2)} mm</span>
            </div>
          )}
        </div>

        {/* Pattern */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Pattern</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Preset (DIN 24041)</div>
            <select value={selectedPreset} onChange={e => applyPreset(parseInt(e.target.value))}
              style={{ width: "100%", height: 30, fontSize: 11, background: controlBg, color: textPrimary, border: `1px solid ${sidebarBorder}`, borderRadius: 4, padding: "0 8px", outline: "none", fontFamily: "'JetBrains Mono', monospace", cursor: "pointer" }}>
              {DIN_PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PATTERN_TYPES.map(pt => (
                <button key={pt} onClick={() => { setPatternType(pt); setSelectedPreset(0); }}
                  style={{ padding: "5px 10px", fontSize: 10, borderRadius: 4, border: `1px solid ${patternType === pt ? accentColor : sidebarBorder}`, background: patternType === pt ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent", color: patternType === pt ? accentColor : textSecondary, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>
                  {pt}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Hole Shape</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {HOLE_SHAPES.map(s => (
                <button key={s} onClick={() => handleShapeChange(s)}
                  style={{ padding: "5px 10px", fontSize: 10, borderRadius: 4, border: `1px solid ${holeShape === s ? accentColor : sidebarBorder}`, background: holeShape === s ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent", color: holeShape === s ? accentColor : textSecondary, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {hasCustomSize ? (
            <>
              <SliderRow label="Width (W)" value={holeW} min={0.5} max={30} step={0.1} onChange={v => { setHoleW(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
              <SliderRow label="Height (H)" value={holeH} min={0.5} max={30} step={0.1} onChange={v => { setHoleH(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
              {holeShape === "Rectangle" && <SliderRow label="Hole Corner R" value={holeRadius} min={0} max={Math.min(holeW, holeH) / 2} step={0.1} onChange={setHoleRadius} unit="mm" dark={dark} />}
            </>
          ) : (
            <SliderRow label="Hole Diameter" value={diameter} min={0.5} max={20} step={0.1} onChange={v => { setDiameter(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
          )}
          {patternType === "Custom Angle" && <SliderRow label="Stagger Angle" value={customAngle} min={0} max={90} step={1} onChange={setCustomAngle} unit="°" dark={dark} />}
        </div>

        {/* Size Variation */}
        <div style={sectionStyle}>
          <div style={{ ...sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span>Size Variation</span>
            <Toggle value={variation.enabled} onChange={enabled => {
              commitVariation(current => ({ ...current, enabled }));
              if (!enabled) setVariationEditMode(false);
            }} dark={dark} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 5, marginBottom: 8 }}>
            <select value="" onChange={e => applyVariationPreset(e.target.value)}
              style={{ minWidth: 0, height: 30, fontSize: 10, background: controlBg, color: textPrimary, border: `1px solid ${sidebarBorder}`, borderRadius: 4, padding: "0 8px", outline: "none", fontFamily: "'JetBrains Mono', monospace" }}>
              <option value="">Load a field preset…</option>
              {Object.keys(VARIATION_PRESETS).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <button onClick={undoVariation} disabled={!canUndoVariation} title="Undo variation" style={{ width: 30, border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: canUndoVariation ? textPrimary : textSecondary, cursor: canUndoVariation ? "pointer" : "default", opacity: canUndoVariation ? 1 : 0.45 }}>↶</button>
            <button onClick={redoVariation} disabled={!canRedoVariation} title="Redo variation" style={{ width: 30, border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: canRedoVariation ? textPrimary : textSecondary, cursor: canRedoVariation ? "pointer" : "default", opacity: canRedoVariation ? 1 : 0.45 }}>↷</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            <button onClick={randomizeVariation} style={{ height: 31, border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: textPrimary, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>✦ Randomize</button>
            <button onClick={() => {
              const next = !variationEditMode;
              setVariationEditMode(next);
              if (next) { setHoleRemovalMode(false); if (!variation.enabled) commitVariation(current => ({ ...current, enabled: true })); }
            }} style={{ height: 31, border: `1px solid ${variationEditMode ? accentColor : sidebarBorder}`, borderRadius: 4, background: variationEditMode ? (dark ? "rgba(96,165,250,0.14)" : "rgba(37,99,235,0.08)") : controlBg, color: variationEditMode ? accentColor : textPrimary, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>{variationEditMode ? "✓ Editing Canvas" : "⌁ Edit on Canvas"}</button>
          </div>

          {variation.enabled && selectedVariationLayer && <>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
              {variation.layers.map((layer, index) => (
                <button key={layer.id} onClick={() => updateVariationLive(current => ({ ...current, selectedLayerId: layer.id }))}
                  style={{ flex: 1, height: 28, border: `1px solid ${variation.selectedLayerId === layer.id ? accentColor : sidebarBorder}`, borderRadius: 4, background: variation.selectedLayerId === layer.id ? (dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.07)") : "transparent", color: variation.selectedLayerId === layer.id ? accentColor : textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", opacity: layer.enabled ? 1 : 0.45 }}>
                  {layer.locked ? "◆" : "◇"} Layer {index + 1}
                </button>
              ))}
              <button onClick={addVariationLayer} disabled={variation.layers.length >= 3} title="Add layer" style={{ width: 28, height: 28, border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: textPrimary, cursor: variation.layers.length >= 3 ? "default" : "pointer", opacity: variation.layers.length >= 3 ? 0.4 : 1 }}>+</button>
              {variation.layers.length > 1 && <button onClick={removeSelectedVariationLayer} title="Remove selected layer" style={{ width: 28, height: 28, border: `1px solid ${sidebarBorder}`, borderRadius: 4, background: controlBg, color: warnColor, cursor: "pointer" }}>×</button>}
            </div>

            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, color: textSecondary, marginBottom: 6 }}>Field Space</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 13 }}>
              {FIELD_SPACES.map(space => <button key={space} onClick={() => updateSelectedVariationLayer({ space }, true)} style={{ padding: "6px 2px", border: `1px solid ${selectedVariationLayer.space === space ? accentColor : sidebarBorder}`, borderRadius: 4, background: selectedVariationLayer.space === space ? (dark ? "rgba(96,165,250,0.13)" : "rgba(37,99,235,0.07)") : "transparent", color: selectedVariationLayer.space === space ? accentColor : textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>{space}</button>)}
            </div>

            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, color: textSecondary, marginBottom: 6 }}>Size Profile</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 13 }}>
              {SIZE_PROFILES.map(profile => {
                const active = selectedVariationLayer.profile === profile;
                return <button key={profile} onClick={() => updateSelectedVariationLayer({ profile }, true)} style={{ height: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, border: `1px solid ${active ? accentColor : sidebarBorder}`, borderRadius: 5, background: active ? (dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.06)") : "transparent", color: active ? accentColor : textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}><ProfileIcon type={profile} active={active} dark={dark} />{profile}</button>;
              })}
            </div>

            {/* Geometry, position and curve live on the canvas handles. Only count-style knobs stay here. */}
            {selectedVariationLayer.space === "Spiral" && <SliderRow label="Spiral Turns" value={selectedVariationLayer.turns} min={0.25} max={8} step={0.05} onChange={turns => updateSelectedVariationLayer({ turns })} dark={dark} />}
            {["Wave", "Noise"].includes(selectedVariationLayer.profile) && <SliderRow label={selectedVariationLayer.profile === "Wave" ? "Frequency" : "Noise Scale"} value={selectedVariationLayer.frequency} min={0.25} max={10} step={0.05} onChange={frequency => updateSelectedVariationLayer({ frequency })} dark={dark} />}
            {selectedVariationLayer.profile === "Noise" && <SliderRow label="Noise Detail" value={selectedVariationLayer.detail} min={1} max={6} step={1} onChange={detail => updateSelectedVariationLayer({ detail })} dark={dark} />}
            {selectedVariationLayer.profile === "Steps" && <SliderRow label="Step Count" value={selectedVariationLayer.steps} min={2} max={16} step={1} onChange={steps => updateSelectedVariationLayer({ steps })} dark={dark} />}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <SliderRow label="Min Scale" value={variation.minScale * 100} min={1} max={200} step={1} onChange={value => updateVariationLive(current => ({ ...current, minScale: Math.min(value / 100, current.maxScale) }))} unit="%" dark={dark} />
              <SliderRow label="Max Scale" value={variation.maxScale * 100} min={5} max={250} step={1} onChange={value => updateVariationLive(current => ({ ...current, maxScale: Math.max(value / 100, current.minScale) }))} unit="%" dark={dark} />
            </div>
            <div style={{ marginTop: -5, marginBottom: 10, padding: "6px 8px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.06)" : "rgba(37,99,235,0.04)", fontSize: 9, color: textSecondary, display: "flex", justifyContent: "space-between" }}>
              <span>Actual extent</span><span style={{ color: accentColor }}>{(Math.min(effW, effH) * variation.minScale).toFixed(2)}–{(Math.max(effW, effH) * variation.maxScale).toFixed(2)} mm</span>
            </div>

            <SliderRow label="Remove Below ⌀" value={variation.cullBelow} min={0} max={Math.max(1, +Math.max(effW, effH).toFixed(1))} step={0.05} onChange={value => updateVariationLive(current => ({ ...current, cullBelow: value }))} unit={variation.cullBelow > 0 ? "mm" : "off"} dark={dark} />
            {culledHoleCount > 0 && <div style={{ marginTop: -5, marginBottom: 10, fontSize: 9, color: textSecondary, display: "flex", justifyContent: "space-between" }}>
              <span>Holes removed by size floor</span><span style={{ color: warnColor }}>{culledHoleCount.toLocaleString()}</span>
            </div>}

            <button onClick={() => setVariationAdvanced(value => !value)} style={{ width: "100%", height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", borderTop: `1px solid ${sectionBorder}`, background: "transparent", color: textSecondary, fontSize: 9, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}><span>ADVANCED MODIFIERS</span><span>{variationAdvanced ? "−" : "+"}</span></button>
            {variationAdvanced && <div style={{ paddingTop: 9 }}>
              <div style={{ fontSize: 9, color: textSecondary, marginBottom: 11, lineHeight: 1.5 }}>Direction, origin, reach, position &amp; curve live on the canvas handles. These are the extra modifiers.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[['Mirror', selectedVariationLayer.mirror, 'mirror'], ['Invert', selectedVariationLayer.invert, 'invert'], ['Layer Enabled', selectedVariationLayer.enabled, 'enabled'], ['Lock Randomize', selectedVariationLayer.locked, 'locked']].map(([label, value, key]) => <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: textSecondary }}>{label}<Toggle value={value} onChange={next => updateSelectedVariationLayer({ [key]: next }, true)} dark={dark} /></label>)}
              </div>
              <SliderRow label="Jitter" value={selectedVariationLayer.jitter} min={0} max={0.5} step={0.01} onChange={jitter => updateSelectedVariationLayer({ jitter })} dark={dark} />
              <SliderRow label="Quantize Sizes" value={variation.quantize} min={0} max={12} step={1} onChange={quantize => updateVariationLive(current => ({ ...current, quantize }))} unit={variation.quantize >= 2 ? "levels" : "off"} dark={dark} />
              <SliderRow label="Layer Opacity" value={selectedVariationLayer.opacity * 100} min={0} max={100} step={1} onChange={opacity => updateSelectedVariationLayer({ opacity: opacity / 100 })} unit="%" dark={dark} />
              {variation.layers.length > 1 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: textSecondary, marginBottom: 5 }}>Blend Mode</div><select value={selectedVariationLayer.blendMode} onChange={e => updateSelectedVariationLayer({ blendMode: e.target.value }, true)} style={{ width: "100%", height: 30, fontSize: 10, background: controlBg, color: textPrimary, border: `1px solid ${sidebarBorder}`, borderRadius: 4, padding: "0 8px", fontFamily: "'JetBrains Mono', monospace" }}>{BLEND_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></div>}
              {selectedVariationLayer.profile === "Noise" && <SliderRow label="Noise Seed" value={selectedVariationLayer.seed} min={0} max={99999} step={1} onChange={seed => updateSelectedVariationLayer({ seed })} dark={dark} />}
            </div>}
            {variationEditMode && <div style={{ padding: "7px 9px", borderRadius: 5, border: `1px solid ${dark ? "rgba(96,165,250,0.18)" : "rgba(37,99,235,0.14)"}`, background: dark ? "rgba(96,165,250,0.06)" : "rgba(37,99,235,0.04)", color: textSecondary, fontSize: 9, lineHeight: 1.6 }}>
              <div><span style={{ color: accentColor }}>●</span> center — drag to move the origin (gradient start).</div>
              <div><span style={{ color: accentColor }}>◯</span> reach — drag the end point to aim direction &amp; spread.</div>
              <div><span style={{ color: accentColor }}>◆</span> stop — slide along the line to set {gizmoUsesPosition(selectedVariationLayer) ? 'position' : 'phase'}.</div>
              <div><span style={{ color: dark ? "#fbbf24" : "#d97706" }}>⟳</span> curve — turn the dial to shape the falloff.</div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>Center snaps to the panel centre, edges &amp; corners; spread &amp; position to 0/25/50/75/100%; angles to 45°. Hold Shift to lock to a snap; otherwise it gently pulls in near one.</div>
              <div style={{ opacity: 0.8, marginTop: 2 }}>Drag empty space (or hold Space) to pan.</div>
            </div>}
          </>}
        </div>

        {/* Dimensions */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Dimensions</div>
          {isRadial ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Gap Link</span>
                <button onClick={() => { setRadialLinked(v => !v); if (!radialLinked) setCircumEdgeGap(radialEdgeGap); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                  title={radialLinked ? "Unlink gap" : "Link gap"}>
                  <LinkIcon linked={radialLinked} dark={dark} />
                </button>
              </div>
              <SliderRow label="Radial Edge Gap" value={radialEdgeGap} min={0} max={50} step={0.1} onChange={handleRadialEdgeGap} unit="mm" dark={dark} />
              <PitchInfo label="ring spacing" value={ringSpacing} dark={dark} />
              {!radialLinked && <>
                <SliderRow label="Circum. Edge Gap" value={circumEdgeGap} min={0} max={50} step={0.1} onChange={handleCircumEdgeGap} unit="mm" dark={dark} />
                <PitchInfo label="circum. spacing" value={circumSpacing} dark={dark} />
              </>}
              {radialLinked && <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>Circum. Edge Gap: {radialEdgeGap.toFixed(2)} mm (linked)</div>}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Fill Mode</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Full", "Circle"].map(m => (
                    <SegBtn key={m} label={m} active={radialMode === m} onClick={() => setRadialMode(m)} />
                  ))}
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: textSecondary, cursor: "pointer", marginTop: 4 }}>
                <input type="checkbox" checked={centerHole} onChange={e => setCenterHole(e.target.checked)} style={{ accentColor }} />
                Center hole
              </label>
            </>
          ) : showGapY ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Gap Link (X = Y)</span>
                <button onClick={() => { setGapLinked(v => !v); if (!gapLinked) setEdgeGapY(edgeGapX); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                  title={gapLinked ? "Unlink gap" : "Link gap"}>
                  <LinkIcon linked={gapLinked} dark={dark} />
                </button>
              </div>
              <SliderRow label={gapLinked ? "Edge Gap (X = Y)" : "X Edge Gap"} value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label={gapLinked ? "pitch" : "X pitch"} value={pitchX} dark={dark} />
              {!gapLinked && <>
                <SliderRow label="Y Edge Gap" value={edgeGapY} min={0} max={50} step={0.1} onChange={handleEdgeGapY} unit="mm" dark={dark} />
                <PitchInfo label="Y pitch" value={pitchY} dark={dark} />
              </>}
            </>
          ) : (
            <>
              <SliderRow label={isHexHoneycomb ? "Edge Gap (all sides)" : "X Edge Gap"} value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label={isHexHoneycomb ? "spacing" : "X pitch"} value={effPitchX} dark={dark} />
              <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>
                {isHexHoneycomb ? (
                  <>Uniform ligament on all 6 edges
                    <span style={{ marginLeft: 6, fontSize: 9, color: dark ? "#555" : "#aaa" }}>
                      row pitch {effPitchY.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <>Y Edge Gap: {(effPitchY - effH).toFixed(2)} mm (auto)
                    <span style={{ marginLeft: 6, fontSize: 9, color: dark ? "#555" : "#aaa" }}>
                      pitch {effPitchY.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
          <SliderRow label="Panel Width" value={sheetW} min={10} max={1000} step={1} onChange={setSheetW} unit="mm" dark={dark} />
          <SliderRow label="Panel Height" value={sheetH} min={10} max={1000} step={1} onChange={setSheetH} unit="mm" dark={dark} />
          {/* Margin section */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Margin {marginLinked ? "(Uniform)" : "(Per-side)"}</span>
              <button onClick={() => { setMarginLinked(v => !v); if (!marginLinked) { const m = marginTop; setMarginBottom(m); setMarginLeft(m); setMarginRight(m); } }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                title={marginLinked ? "Set per-side margins" : "Use uniform margin"}>
                <LinkIcon linked={marginLinked} dark={dark} />
              </button>
            </div>
            {marginLinked ? (
              <SliderRow label="Margin" value={marginTop} min={0} max={50} step={0.5} onChange={handleMarginUniform} unit="mm" dark={dark} />
            ) : (
              <>
                <SliderRow label="Margin Top" value={marginTop} min={0} max={50} step={0.5} onChange={setMarginTop} unit="mm" dark={dark} />
                <SliderRow label="Margin Bottom" value={marginBottom} min={0} max={50} step={0.5} onChange={setMarginBottom} unit="mm" dark={dark} />
                <SliderRow label="Margin Left" value={marginLeft} min={0} max={50} step={0.5} onChange={setMarginLeft} unit="mm" dark={dark} />
                <SliderRow label="Margin Right" value={marginRight} min={0} max={50} step={0.5} onChange={setMarginRight} unit="mm" dark={dark} />
              </>
            )}
          </div>
          <SliderRow label="Corner Radius" value={cornerRadius} min={0} max={Math.min(perfW / 2, perfH / 2)} step={0.5} onChange={setCornerRadius} unit="mm" dark={dark} />
        </div>

        {/* Taper */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Sheet Thickness & Hole Taper</div>
          <SliderRow label="Thickness (t)" value={thickness} min={0} max={10} step={0.1} onChange={setThickness} unit="mm" dark={dark} />
          <SliderRow label="Taper Angle (θ)" value={taperAngle} min={0} max={15} step={0.1} onChange={setTaperAngle} unit="°" dark={dark} />
          {taperActive && (
            <>
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Taper Direction</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["Top larger", "Bottom larger"].map(dir => <SegBtn key={dir} label={dir} active={taperDirection === dir} onClick={() => setTaperDirection(dir)} />)}
                </div>
              </div>
              <div style={{ marginTop: 8, padding: "5px 8px", borderRadius: 4, background: hasClosedHoles ? (dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)") : (dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: textSecondary }}>{variation.enabled ? "Exit Range" : "Exit Diameter"}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: hasClosedHoles ? warnColor : accentColor }}>{holeClosed ? "0 (all closed)" : variation.enabled ? `${minExit.toFixed(2)}–${maxExit.toFixed(2)} mm` : `${dExit.toFixed(2)} mm`}</span>
              </div>
            </>
          )}
          {!taperActive && <div style={{ fontSize: 9, color: dark ? "#444" : "#bbb", marginTop: 6, lineHeight: 1.4 }}>Set thickness and angle above 0 to enable taper compensation.</div>}
        </div>

        {/* Hole Removal */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Hole Removal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Click to Remove</span>
              <Toggle value={holeRemovalMode} onChange={setHoleRemovalMode} dark={dark} />
            </label>
            {holeRemovalMode && <div style={{ fontSize: 9, color: dark ? "#888" : "#888", lineHeight: 1.4 }}>Click holes on the canvas to remove/restore them. OAR recalculates automatically.</div>}
            {removedHoles.size > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: dark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)" }}>
                  <span style={{ fontSize: 10, color: textSecondary }}>Removed</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: warnColor }}>{removedHoles.size} holes</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.05)" }}>
                  <span style={{ fontSize: 10, color: textSecondary }}>Active</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>{activeHoleCount} holes</span>
                </div>
                <button onClick={() => setRemovedHoles(new Set())}
                  style={{ padding: "5px 0", fontSize: 10, fontWeight: 500, background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", color: warnColor, border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`, borderRadius: 4, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
                  Restore All Holes
                </button>
              </>
            )}
          </div>
        </div>


        {/* Export */}
        <div style={{ ...sectionStyle, borderBottom: "none", paddingBottom: 20 }}>
          <div style={sectionTitle}>Export</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["SVG", exportSVG], ["PNG 2x", exportPNG]].map(([label, fn]) => (
              <button key={label} onClick={fn} style={{
                flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 500,
                background: btnBg, color: textPrimary, border: "none", borderRadius: 5,
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "background 0.15s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? "#333338" : "#d4d4da"}
                onMouseLeave={e => e.currentTarget.style.background = btnBg}>
                ↓ {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${accentColor}; cursor: pointer; border: 2px solid ${dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${accentColor}; cursor: pointer; border: 2px solid ${dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        select option { background: ${dark ? "#1e1e22" : "#fff"}; color: ${textPrimary}; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${dark ? "#333" : "#ccc"}; border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
