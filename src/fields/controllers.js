// Controller-based field channels (Phase 2).
//
// A controller is a piece of geometry the user drops on the sheet — a point, a
// line, a cubic curve, a polyline or an image — that drives ONE channel:
//
//   size     multiplier on the hole extent, on top of the variation field
//   spacing  multiplier on the layout pitch (read by the Phase 3 layout modes)
//   angle    degrees added to the hole's own rotation
//   shape    superellipse morph, 0 = diamond · 0.5 = ellipse · 1 = near-square
//
// Evaluation is the same for every channel: measure the distance d from the
// sample point to the controller's geometry, turn it into a weight
// w = falloff(d / radius) · strength, then blend each controller's `target`
// against the channel's base value. `variation-engine.js` is untouched and keeps
// driving size on its own; a size controller multiplies its result.
//
// All geometry is in millimetres, sheet space (origin = sheet top-left, y down),
// the same frame the holes come out of `layouts/`.
import { clamp, lerp } from "../core/math.js";
import { distPointSeg } from "../geometry/polygon.js";
import { imageWeightAt } from "./image-map.js";

export const FIELD_CHANNELS = ["size", "spacing", "angle", "shape"];
// The channels the editor offers today. `spacing` is modelled, validated and
// evaluated here — it round-trips through save, share and undo — but nothing
// reads it yet: it decides where holes go, which is the layouts' business, and
// they start reading it in Phase 3. Offering a tool that visibly does nothing
// would be worse than not offering it, so the UI lists these three.
export const EDITABLE_CHANNELS = ["size", "angle", "shape"];
export const CONTROLLER_KINDS = ["point", "line", "curve", "polyline", "image"];
export const FALLOFFS = ["smooth", "linear", "hard"];
// -1 / 0 / +1 — which side of a line, curve or polyline the controller reaches.
// 0 is both sides; the sign is the side the geometry's own normal points to.
export const ONE_SIDED_VALUES = [-1, 0, 1];

// Above this the main-thread evaluation (controllers × holes) stops being free.
// Phase 6 moves the loop to a worker; until then the count is capped instead.
export const MAX_CONTROLLERS = 8;
export const MAX_POLYLINE_POINTS = 24;

// How many points each kind's `geometry.points` carries. `image` places itself
// with a rectangle instead, so it has no points at all.
export const KIND_POINT_COUNT = {
  point: { min: 1, max: 1 },
  line: { min: 2, max: 2 },
  curve: { min: 4, max: 4 },
  polyline: { min: 2, max: MAX_POLYLINE_POINTS },
  image: { min: 0, max: 0 },
};

// Per-channel vocabulary: the neutral value a point with no controller reads,
// the slider range for `target`, and how it is written in the UI.
export const CHANNEL_INFO = {
  size: { label: "Size", base: 1, unit: "×", min: 0.05, max: 4, step: 0.05, defaultTarget: 1.8, decimals: 2 },
  spacing: { label: "Spacing", base: 1, unit: "×", min: 0.2, max: 4, step: 0.05, defaultTarget: 1.5, decimals: 2 },
  angle: { label: "Angle", base: 0, unit: "°", min: -180, max: 180, step: 1, defaultTarget: 45, decimals: 0 },
  shape: { label: "Shape", base: 0.5, unit: "", min: 0, max: 1, step: 0.01, defaultTarget: 1, decimals: 2 },
};

export const channelBase = channel => CHANNEL_INFO[channel]?.base ?? 0;

// ─── Falloff ──────────────────────────────────────────────────────────
// t = d / radius, clamped to 0..1. Every curve returns 1 at the geometry and 0
// at the rim, so `strength` scales a weight that is already normalised.
export function falloffWeight(kind, t) {
  const u = clamp(t, 0, 1);
  if (kind === "hard") return u < 1 ? 1 : 0;
  if (kind === "linear") return 1 - u;
  const s = u * u * (3 - 2 * u); // smoothstep
  return 1 - s;
}

// ─── Distance to a controller's geometry ──────────────────────────────
export function polylineDistance(points, x, y) {
  if (!points.length) return Infinity;
  if (points.length === 1) return Math.hypot(x - points[0].x, y - points[0].y);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const d = distPointSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < best) best = d;
  }
  return best;
}

// Cubic Bézier through p0, c1, c2, p3, flattened to `segments` chords. Sampling
// once at compile time keeps the per-hole cost the same as a polyline's.
export function flattenCubic(points, segments = 24) {
  const [p0, c1, c2, p3] = points;
  const steps = Math.max(2, Math.round(segments));
  const out = new Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out[i] = {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    };
  }
  return out;
}

// Which side of a polyline a point falls on: the sign of the cross product with
// the segment that is actually nearest, so the answer follows the geometry
// rather than the chord between its ends.
export function polylineSide(points, x, y) {
  if (points.length < 2) return 0;
  let best = Infinity,
    side = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const d = distPointSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < best) {
      best = d;
      side = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x));
    }
  }
  return side;
}

// ─── Compilation ──────────────────────────────────────────────────────
// Flatten curves, resolve `syncWith`, drop controllers that cannot contribute.
// The result is evaluated once per hole, so nothing here may allocate per call.

// A controller may borrow another's geometry ("sync"). Walk the chain with a
// visited set so a cycle falls back to the controller's own geometry instead of
// hanging.
export function resolveSyncedGeometry(controller, byId) {
  let node = controller;
  const seen = new Set([controller.id]);
  while (node.syncWith) {
    const next = byId.get(node.syncWith);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    node = next;
  }
  return node;
}

export function compileControllers(controllers, ctx = {}) {
  const list = Array.isArray(controllers) ? controllers : [];
  const byId = new Map(list.map(c => [c.id, c]));
  const compiled = [];
  // Non-finite numbers are filtered here rather than trusted from validation:
  // NaN survives clamp() and every comparison against it is false, so one bad
  // coordinate would spread through the weighted average and empty the pattern.
  // validateDocument already stops that for saved documents; this covers the
  // rest (an in-flight drag, a caller outside the app, a future editor bug).
  for (const controller of list) {
    if (controller.enabled === false) continue;
    if (!Number.isFinite(controller.target)) continue;
    const strength = clamp(Number.isFinite(controller.strength) ? controller.strength : 1, 0, 1);
    if (strength <= 0) continue;
    const source = resolveSyncedGeometry(controller, byId);
    const entry = {
      channel: controller.channel,
      kind: source.kind,
      target: controller.target,
      strength,
      falloff: controller.falloff || "smooth",
      oneSided: source.kind === "point" || source.kind === "image" ? 0 : Math.sign(controller.oneSided || 0),
    };
    if (source.kind === "image") {
      const map = ctx.imageMaps?.[controller.image?.assetId];
      // No decoded bitmap (a share link drops them, and decoding is async) →
      // the controller is inert rather than a hard zero over its rectangle.
      if (!map) continue;
      entry.image = { map, placement: source.image?.placement, transfer: controller.image };
    } else {
      const raw = Array.isArray(source.geometry?.points) ? source.geometry.points : [];
      const points = raw.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (!points.length || points.length !== raw.length) continue;
      entry.points = source.kind === "curve" && points.length >= 4 ? flattenCubic(points) : points;
      entry.radius = Number.isFinite(controller.radius) ? Math.max(1e-6, controller.radius) : 1;
    }
    compiled.push(entry);
  }
  return compiled;
}

// True when at least one compiled controller drives `channel`.
export function compiledHasChannel(compiled, channel) {
  return compiled.some(entry => entry.channel === channel);
}

// ─── Evaluation ───────────────────────────────────────────────────────
// Each controller contributes (weight, target). The blend is a convex
// combination that keeps the base value's share until the weights saturate:
//
//   W ≤ 1 →  base·(1 − W) + Σ wᵢ·targetᵢ
//   W > 1 →  Σ wᵢ·targetᵢ / W
//
// It is continuous at W = 1 (both branches agree there), reaches `target`
// exactly when a single controller is at full weight, and — unlike blending the
// controllers one after another — does not depend on the order they are listed.
export function evaluateCompiled(compiled, channel, x, y, base = channelBase(channel)) {
  let total = 0,
    sum = 0;
  for (const entry of compiled) {
    if (entry.channel !== channel) continue;
    let weight, target;
    if (entry.image) {
      const cover = imageWeightAt(entry.image.map, entry.image.placement, entry.image.transfer, x, y);
      if (cover === null) continue;
      weight = entry.strength;
      // Brightness drives how far this pixel reaches toward the target.
      target = lerp(base, entry.target, cover);
    } else {
      if (entry.oneSided && polylineSide(entry.points, x, y) === -entry.oneSided) continue;
      const d = polylineDistance(entry.points, x, y);
      weight = falloffWeight(entry.falloff, d / entry.radius) * entry.strength;
      target = entry.target;
    }
    if (weight <= 0) continue;
    total += weight;
    sum += weight * target;
  }
  if (total <= 0) return base;
  return total <= 1 ? base * (1 - total) + sum : sum / total;
}

// The signature from the roadmap: convenient for tests and one-off queries, but
// it recompiles on every call — the pipeline compiles once and loops instead.
export function evaluateChannel(controllers, channel, x, y, ctx = {}) {
  return evaluateCompiled(compileControllers(controllers, ctx), channel, x, y, ctx.base);
}

// ─── Authoring helpers ────────────────────────────────────────────────
export function newControllerId(existing = []) {
  const taken = new Set(existing.map(c => c.id));
  for (let i = 1; ; i++) {
    const id = `ctrl-${i}`;
    if (!taken.has(id)) return id;
  }
}

// Default geometry for a new controller, laid out inside `area`
// ({ x, y, w, h } in sheet mm — normally the perforation bounds).
export function defaultGeometry(kind, area) {
  const cx = area.x + area.w / 2,
    cy = area.y + area.h / 2;
  const reach = Math.min(area.w, area.h) * 0.3;
  if (kind === "point") return { points: [{ x: cx, y: cy }] };
  if (kind === "line")
    return {
      points: [
        { x: cx - reach, y: cy },
        { x: cx + reach, y: cy },
      ],
    };
  if (kind === "curve")
    return {
      points: [
        { x: cx - reach, y: cy + reach * 0.5 },
        { x: cx - reach * 0.35, y: cy - reach * 0.9 },
        { x: cx + reach * 0.35, y: cy + reach * 0.9 },
        { x: cx + reach, y: cy - reach * 0.5 },
      ],
    };
  if (kind === "polyline")
    return {
      points: [
        { x: cx - reach, y: cy + reach * 0.5 },
        { x: cx, y: cy - reach * 0.5 },
        { x: cx + reach, y: cy + reach * 0.5 },
      ],
    };
  return { points: [] };
}

export function createController({ channel, kind, area, existing = [], target }) {
  const info = CHANNEL_INFO[channel] || CHANNEL_INFO.size;
  const controller = {
    id: newControllerId(existing),
    channel,
    kind,
    enabled: true,
    geometry: defaultGeometry(kind, area),
    target: target ?? info.defaultTarget,
    radius: Math.max(1, Math.round(Math.min(area.w, area.h) * 0.25)),
    falloff: "smooth",
    oneSided: 0,
    strength: 1,
    syncWith: null,
    image: null,
  };
  if (kind === "image") {
    const size = Math.min(area.w, area.h) * 0.7;
    controller.image = {
      assetId: null,
      invert: false,
      gamma: 1,
      min: 0,
      max: 1,
      placement: {
        x: area.x + area.w / 2 - size / 2,
        y: area.y + area.h / 2 - size / 2,
        w: size,
        h: size,
        rotation: 0,
      },
    };
  }
  return controller;
}
