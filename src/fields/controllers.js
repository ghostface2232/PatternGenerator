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
import { clamp } from "../core/math.js";
import { distPointSeg } from "../geometry/polygon.js";
import { imageWeightAt } from "./image-map.js";

export const FIELD_CHANNELS = ["size", "spacing", "angle", "shape"];
// The channels the editor offers. `spacing` joined them in Phase 3, when the
// layout modes started reading it; not every mode does, so the panel says which
// ones (see layoutReadsSpacing in layouts/index.js) rather than offering a tool
// that silently does nothing.
export const EDITABLE_CHANNELS = ["size", "spacing", "angle", "shape"];
// An image cannot drive a channel the LAYOUT reads, and the reason is not
// aesthetic. A brightness map is decoded from a bitmap by the DOM,
// asynchronously, and share links do not carry the picture at all — so a
// controller reading one would make hole POSITIONS depend on state that is not
// in the document and does not arrive with it. `removedHoles` indices address
// one particular generated list, and patternSignature can only sign what the
// document holds; holes that shuffle when a decode finishes would leave those
// indices pointing at other holes, with no edit and so no undo step anywhere in
// sight. A channel that only changes how a hole is DRAWN is free to wait for the
// picture.
//
// Which channels those are depends on the mode, so this takes the list rather
// than deciding it: spacing always (every mode that reads it, reads it while
// placing), and the angle channel as well under Flow Lines, where it is the
// direction field the lines follow. See layoutPlacementChannels in
// layouts/index.js, which is the one place that answer is written down.
export const imageChannels = (placementChannels = ["spacing"]) =>
  EDITABLE_CHANNELS.filter(channel => !placementChannels.includes(channel));
export const CONTROLLER_KINDS = ["point", "line", "curve", "polyline", "image"];
export const FALLOFFS = ["smooth", "linear", "hard"];
// How an image reads its pixels into the channel.
//
//   halftone  the picture SETS the value: black reads `image.low`, white reads
//             `target`, a midtone the value between — at full weight wherever
//             the rectangle covers, which is what turns a photograph into a
//             halftone of hole sizes. New image controllers start here.
//   mask      the picture is the WEIGHT: brightness is how hard the controller
//             pulls toward `target`, a black pixel being no pull at all, the
//             way a distant point is. This composes with other controllers on
//             the same ground (an all-black image holds nothing down), and it
//             is what every image controller did before the halftone mode
//             existed, so documents from then keep it.
export const IMAGE_MODES = ["halftone", "mask"];
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
  // The default target is deliberately modest: 1.8× on the default document
  // (⌀5 at pitch 8) overlaps on the first click, and a fresh controller that
  // immediately reads "Holes overlap" teaches the wrong thing about the tool.
  size: { label: "Size", base: 1, unit: "×", min: 0.05, max: 4, step: 0.05, defaultTarget: 1.4, decimals: 2 },
  spacing: { label: "Spacing", base: 1, unit: "×", min: 0.2, max: 4, step: 0.05, defaultTarget: 1.5, decimals: 2 },
  angle: { label: "Angle", base: 0, unit: "°", min: -180, max: 180, step: 1, defaultTarget: 45, decimals: 0 },
  shape: { label: "Shape", base: 0.5, unit: "", min: 0, max: 1, step: 0.01, defaultTarget: 1, decimals: 2 },
};

export const channelBase = channel => CHANNEL_INFO[channel]?.base ?? 0;

// ─── Falloff ──────────────────────────────────────────────────────────
// t = d / radius, clamped to 0..1. Every curve returns 1 at the geometry and 0
// at the rim, so `strength` scales a weight that is already normalised.
//
// `invert` turns the curve over: 0 at the geometry, 1 at the rim and everywhere
// beyond it. That is the other thing a controller can mean — "the further from
// here, the more" — a sheet that is nominal at its middle and opens toward its
// edges, or a line that leaves a quiet band along itself. Nothing else about
// the controller changes: the same reach, falloff and strength describe how the
// weight climbs instead of how it fades.
export function falloffWeight(kind, t, invert = false) {
  const u = clamp(t, 0, 1);
  let w;
  if (kind === "hard") w = u < 1 ? 1 : 0;
  else if (kind === "linear") w = 1 - u;
  else w = 1 - u * u * (3 - 2 * u); // smoothstep
  return invert ? 1 - w : w;
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

// Distance from a point to ONE segment, together with which side of it the point
// is on — as a signed number in −1…1 rather than a bare sign. It is the sine of
// the angle between the segment's direction and the offset to the point, so it
// passes smoothly through 0 wherever the point lines up with the segment's own
// direction beyond an end, instead of flipping there.
//
// That distinction is the whole point. Taking the bare sign of the nearest
// segment tears: two legs of a polyline disagree about "which side" across the
// locus where they are equidistant, and the tie is broken by whichever vertex
// comes first in the list. On a 40 mm leg meeting a diagonal that put a 27° step
// in the angle field 12 mm away from any geometry — a straight seam of abruptly
// rotated holes across the sheet. It also made the mask depend on the direction
// the polyline happened to be drawn in, which nothing about "one-sided" should.
// How sharply "the nearest segment" is preferred where two are nearly
// equidistant: the segments' contributions are averaged with weights
// (dMin / dᵢ)^SOFT_ARGMIN, so the nearest dominates except across a bisector,
// where the two blend instead of switching. Read by the inverted side gate
// below and by the warp.
const SOFT_ARGMIN = 4;

export function segmentProbe(ax, ay, bx, by, x, y) {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1) : 0;
  const ox = x - (ax + t * dx),
    oy = y - (ay + t * dy);
  const distance = Math.hypot(ox, oy);
  const len = Math.sqrt(len2);
  // `ox, oy` is the offset from the nearest point of the segment to the sample:
  // the direction the warp below pushes along, so it is returned rather than
  // worked out again.
  return { distance, ox, oy, side: distance > 0 && len > 0 ? (dx * oy - dy * ox) / (len * distance) : 0 };
}

// The weight a path-shaped controller gives one sample point: the strongest
// contribution over its segments, each gated by which side of that segment the
// point is on. For `oneSided === 0` the gate is 1 throughout and this is exactly
// falloff(nearest distance), since falloff never rises.
//
// Inverted, the weight RISES with distance, so "the strongest segment" would be
// the farthest one and a point beside one leg of a polyline would read full
// weight off another leg across the sheet. The inverted weight is therefore the
// inverted falloff of the NEAREST distance — the one number the whole path
// agrees on — and the side gate is the segments' gates averaged by proximity
// (`SOFT_ARGMIN`, the same blend the warp uses), which is continuous across the
// bisector inside a bend, where taking the nearest segment's gate alone would
// tear the way the bare sign used to.
export function polylineWeight(points, x, y, radius, falloff, oneSided, invert = false) {
  if (points.length === 1) {
    return falloffWeight(falloff, Math.hypot(x - points[0].x, y - points[0].y) / radius, invert);
  }
  if (invert) {
    let dMin = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1];
      const d = distPointSeg(x, y, a.x, a.y, b.x, b.y);
      if (d < dMin) dMin = d;
    }
    const weight = falloffWeight(falloff, dMin / radius, true);
    if (!oneSided || weight <= 0) return weight;
    let gate = 0,
      share = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1];
      const probe = segmentProbe(a.x, a.y, b.x, b.y, x, y);
      const omega = ((dMin + 1e-9) / (probe.distance + 1e-9)) ** SOFT_ARGMIN;
      gate += omega * clamp(oneSided * probe.side, 0, 1);
      share += omega;
    }
    return share > 0 ? (weight * gate) / share : 0;
  }
  let best = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const probe = segmentProbe(a.x, a.y, b.x, b.y, x, y);
    const weight = falloffWeight(falloff, probe.distance / radius);
    // The gate is at most 1, so a segment whose ungated weight is already behind
    // cannot come back ahead — worth skipping, since most segments are far away.
    if (weight <= best) continue;
    const gated = oneSided ? weight * clamp(oneSided * probe.side, 0, 1) : weight;
    if (gated > best) best = gated;
  }
  return best;
}

// ─── Compilation ──────────────────────────────────────────────────────
// Flatten curves, resolve `syncWith`, drop controllers that cannot contribute.
// The result is evaluated once per hole, so nothing here may allocate per call.

// A controller may borrow another's geometry ("sync"). Walk the chain with a
// visited set so a cycle falls back to the controller's own geometry instead of
// hanging.
//
// An image is never either end of that chain. It places itself with a rectangle
// rather than with points, so the two kinds have no geometry in common: a line
// syncing to an image would resolve to kind "image" and then vanish, because the
// line carries no picture to sample; an image syncing to a line would stop being
// a picture at all. `validateFields` drops such a reference on load, and this is
// the same rule enforced where it is used.
export function resolveSyncedGeometry(controller, byId) {
  if (controller.kind === "image") return controller;
  let node = controller;
  const seen = new Set([controller.id]);
  while (node.syncWith) {
    const next = byId.get(node.syncWith);
    if (!next || next.kind === "image" || seen.has(next.id)) break;
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
      // An image has no reach to turn over; its own `image.invert` flips the tone.
      invert: source.kind !== "image" && controller.invert === true,
    };
    if (source.kind === "image") {
      // See imageChannels: a picture arrives asynchronously and does not travel
      // in a share link, so it may not decide where a hole goes. Dropped here as
      // well as hidden in the UI, because a hand-edited file can still ask, and
      // so can a document that was switched into a mode which reads one more
      // channel than the mode it was drawn in.
      if ((ctx.placementChannels ?? ["spacing"]).includes(controller.channel)) continue;
      const map = ctx.imageMaps?.[controller.image?.assetId];
      // No decoded bitmap (a share link drops them, and decoding is async) →
      // the controller is inert rather than a hard zero over its rectangle.
      if (!map) continue;
      const base = channelBase(controller.channel);
      const halftone = controller.image?.mode === "halftone";
      const low = Number.isFinite(controller.image?.low) ? controller.image.low : base;
      entry.image = { map, placement: source.image?.placement, transfer: controller.image, halftone, low };
      // A halftone whose two ends both sit on the neutral value sets nothing.
      if (halftone && low === base && controller.target === base) continue;
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

// True when at least one compiled controller drives `channel` toward something
// other than `base`. A controller whose target IS the neutral value changes
// nothing, and must not read as active: downstream that would swap the
// statistics onto the counted-OAR path, which reports a slightly different
// figure for the same geometry — the reading would move without a hole moving.
export function compiledDrivesChannel(compiled, channel, base = channelBase(channel)) {
  return compiled.some(
    entry => entry.channel === channel && (entry.target !== base || (entry.image?.halftone && entry.image.low !== base))
  );
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
      if (entry.image.halftone) {
        // The picture sets the value: `low` at black, `target` at white, at
        // full weight wherever it covers. A halftone has to be able to make a
        // dark pixel a SMALL hole, which no blend toward the base can say.
        weight = entry.strength;
        target = entry.image.low + (entry.target - entry.image.low) * cover;
      } else {
        // Brightness IS the weight, so a dark pixel means "no influence" the
        // same way a distant point does. Blending it as full weight toward the
        // base instead would let a black image quietly hold down every other
        // controller over the same ground — measured, an all-black image halved
        // a point controller's effect. On its own the two forms agree exactly
        // (base·(1−sc) + sc·t is the same either way); they differ only in
        // company, and only one of them composes.
        weight = entry.strength * cover;
        target = entry.target;
      }
    } else {
      weight = polylineWeight(entry.points, x, y, entry.radius, entry.falloff, entry.oneSided, entry.invert) * entry.strength; // prettier-ignore
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

// ─── The warp a multiplier channel makes ──────────────────────────────
// How a lattice — the grid family, Cross-hatch — follows the spacing channel.
// Those modes cannot re-sample a pitch per hole the way Scatter or Spiral do:
// a grid whose holes each pick their own pitch is not a grid. What they can do
// is keep their lattice and MOVE it, and the field says how.
//
// One controller, and the distance d from its geometry. Along the ray running
// straight away from the nearest point, the field asks for a pitch of
// pitch·m(d), m(d) = 1 + (target − 1)·strength·falloff(d/R). Pushing every
// point out along that ray by
//
//   u(d) = ∫₀ᵈ (m(ρ) − 1) dρ = (target − 1)·strength·R·F(min(d/R, 1))
//
// makes the spacing measured along the ray exactly pitch·m(d): the derivative of
// d + u(d) is m(d). F is the integral of the falloff curve, in closed form
// (`falloffPush` is F(t)/t). Across the ray the lattice stretches by
// (d + u)/d — the same m at the geometry itself, easing toward 1 further out —
// so at the centre of a point controller the pattern opens up (or draws in) the
// same amount in every direction, which is what a round heat map promises.
//
// Beyond the reach, u is the constant u(R): the lattice out there is carried
// along whole, its pitch untouched. That is not a choice so much as
// arithmetic — opening the middle of a sheet has to put the rest of it
// somewhere — and it is what the row-by-row rule this replaces did too, one
// axis at a time. What that rule could not do is confine anything: a point
// controller in the middle of the sheet widened the pitch between its rows
// from one edge of the sheet to the other, in one direction only, because a row
// can only move as a whole. Here each hole moves by what the field says at ITS
// nominal position, so the change is a disc around the controller, in both
// directions, and the far field is a rigid shift that fades as 1/d.
//
// A line, curve or polyline pushes perpendicular to itself and radially off its
// ends. Where two segments are nearly equidistant the push is the
// distance-weighted average of the two (`SOFT_ARGMIN`), rather than that of
// whichever is nearer by a hair: taking the nearest alone flips the direction
// across the bisector inside every bend, and a spreading controller then folds
// the lattice over itself there. One-sided controllers gate the push per
// segment exactly as `polylineWeight` gates the weight.
//
// Several controllers add, divided by the total weight where it passes 1 — the
// same normalisation `evaluateCompiled` applies to the value, and for the same
// reason: two crowding controllers on the same ground would otherwise pull a
// point past both of them.
//
// `expand(bounds)` is how far outside `bounds` a lattice has to be laid down so
// that, once warped, it still covers them: a crowding controller draws points
// in from beyond the edge. Per controller it is the smaller of the largest push
// it can make, |m − 1|·R·F(1), and what a point that LANDS inside the bounds
// can have travelled, D·|m − 1|/m for D the far corner's distance (a ray's
// nominal distance and its landing distance differ by a factor between m and 1,
// so the travel is at most that share of the landing distance). Exact for one
// controller; for several it is the sum, which the normalisation keeps
// conservative. Both matter: a hard 0.2× controller with a 2000 mm reach on a
// 200 mm sheet would otherwise lay down a 3400 mm lattice, and a 4× one would
// still need a 400 mm one.
//
// An INVERTED controller asks for the nominal pitch at its geometry and
// pitch·m from the rim outward, so its push is the complement: u(d) =
// gain·(d − R·F(min(d/R, 1))), zero at the geometry and growing without bound
// beyond the reach, where the lattice out there is scaled about the controller
// by m rather than carried along. The derivative is again m(d). Only the
// landing term bounds `expand` for it, since the largest push has no ceiling.

// F(t)/t: the mean of `falloffWeight` over 0…t, so that the push at distance
// d = t·R is (target − 1)·strength·d·falloffPush(t). Every curve is 1 at t = 0.
export function falloffPush(kind, t) {
  const u = clamp(t, 0, 1);
  if (kind === "hard") return 1;
  if (kind === "linear") return 1 - u / 2;
  return 1 - u * u + (u * u * u) / 2; // ∫(1 − smoothstep) = t − t³ + t⁴/2
}

// The push per unit of distance, u(d)/d, for a controller at reach R and a
// sample at distance d — inside the reach along the curve, beyond it the
// constant u(R) spread over the distance; and the complement of both for an
// inverted controller.
export function pushPerUnit(kind, distance, radius, invert) {
  const t = distance / radius;
  const upright = t < 1 ? falloffPush(kind, t) : (radius * falloffPush(kind, 1)) / distance;
  return invert ? 1 - upright : upright;
}

export function compileWarp(compiled, channel, base = channelBase(channel)) {
  const entries = compiled.filter(entry => entry.channel === channel && !entry.image && entry.points?.length);
  const displace = (x, y) => {
    let ux = 0,
      uy = 0,
      total = 0;
    for (const entry of entries) {
      const { points, radius, falloff, oneSided, invert } = entry;
      const gain = (entry.target - base) * entry.strength;
      const segments = points.length === 1 ? 1 : points.length - 1;
      // Nearest approach first, so each segment's share can be weighed against it.
      let dMin = Infinity;
      for (let i = 0; i < segments; i++) {
        const a = points[i],
          b = points[Math.min(i + 1, points.length - 1)];
        const probe = segmentProbe(a.x, a.y, b.x, b.y, x, y);
        if (probe.distance < dMin) dMin = probe.distance;
      }
      let sx = 0,
        sy = 0,
        share = 0,
        weight = 0;
      for (let i = 0; i < segments; i++) {
        const a = points[i],
          b = points[Math.min(i + 1, points.length - 1)];
        const { distance, ox, oy, side } = segmentProbe(a.x, a.y, b.x, b.y, x, y);
        const gate = oneSided ? clamp(oneSided * side, 0, 1) : 1;
        const w = falloffWeight(falloff, distance / radius, invert) * gate;
        if (w > weight) weight = w;
        // The push per unit of offset: inside the reach it follows the curve,
        // beyond it the constant u(R) spread over the distance — or, inverted,
        // the complement of that.
        const push = gain * gate * pushPerUnit(falloff, distance, radius, invert);
        const omega = ((dMin + 1e-9) / (distance + 1e-9)) ** SOFT_ARGMIN;
        sx += omega * push * ox;
        sy += omega * push * oy;
        share += omega;
      }
      if (share > 0) {
        ux += sx / share;
        uy += sy / share;
      }
      total += weight * entry.strength;
    }
    if (total > 1) {
      ux /= total;
      uy /= total;
    }
    return [ux, uy];
  };
  const expand = ({ xMin, xMax, yMin, yMax }) => {
    let reach = 0;
    for (const entry of entries) {
      const m = base + (entry.target - base) * entry.strength;
      const gain = Math.abs(m - base);
      if (!(gain > 0) || !(m > 0)) continue;
      // A spreading controller (m > 1) pushes every point AWAY from its
      // geometry, upright or inverted. With that geometry inside the bounds,
      // a nominal point outside them lies beyond where its ray already left
      // the rectangle, and pushing it further along the ray keeps it outside
      // — so it needs no padding at all. Padding it anyway is not merely
      // wasteful: an inverted spreading controller's push has no ceiling, so
      // its landing bound is the whole far corner, and Cross-hatch, which
      // counts its holes over the padded region before laying any down,
      // refused a 1000 mm sheet of 0.5 mm holes that fits with room to spare.
      // Geometry outside the bounds can push a point into them, and keeps
      // the bound.
      const inside = entry.points.every(p => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax);
      if (m > base && inside) continue;
      // An inverted push keeps growing with distance, so only the landing
      // term can bound it.
      const farthest = entry.invert ? Infinity : entry.radius * falloffPush(entry.falloff, 1);
      let landing = Infinity;
      for (const p of entry.points) {
        let corner = 0;
        for (const [cx, cy] of [
          [xMin, yMin],
          [xMax, yMin],
          [xMin, yMax],
          [xMax, yMax],
        ]) {
          corner = Math.max(corner, Math.hypot(cx - p.x, cy - p.y));
        }
        landing = Math.min(landing, corner);
      }
      reach += gain * Math.min(farthest, landing / m);
    }
    return reach;
  };
  return { displace, expand, active: entries.length > 0 };
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

// The halftone preset: the picture's full tonal range across the channel's
// useful range, with the dark end well below neutral so shadows read as small
// holes. Returned as a patch for `image`, plus the target for the light end.
export function halftonePreset(channel) {
  const info = CHANNEL_INFO[channel] || CHANNEL_INFO.size;
  const span = info.max - info.min;
  return {
    target: channel === "size" ? 1.6 : channel === "spacing" ? 1.8 : info.min + span * 0.85,
    image: { mode: "halftone", low: channel === "size" ? 0.15 : channel === "spacing" ? 0.6 : info.min + span * 0.15 },
  };
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
    invert: false,
    strength: 1,
    syncWith: null,
    image: null,
  };
  if (kind === "image") {
    const size = Math.min(area.w, area.h) * 0.7;
    controller.image = {
      assetId: null,
      mode: "halftone",
      // Black reads the neutral value to begin with, so a fresh picture only
      // ever grows holes where it is bright; the Halftone preset in the
      // inspector pulls this end down.
      low: info.base,
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
