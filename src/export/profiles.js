// Shared manufacturing contours, in sheet mm. Clip real geometry before
// compensation: a CAD consumer must never need to understand an SVG clipPath.
import polygonClipping from "polygon-clipping";
import { fromClipping } from "../geometry/offset.js";
import { parseSVGOutline } from "../geometry/svg-path.js";
import { holeSVGElement, holeOutline, holeExitOutline } from "../geometry/shapes.js";
import { ringsBBox, arcSegmentsFor } from "../geometry/rings.js";
import { regionFromParams } from "../geometry/boundary.js";

export const EXPORT_LAYERS = ["OUTLINE", "HOLES", "HOLES_EXIT", "KEEPOUT"];
export const EXPORT_TOLERANCE = 0.02;
export const exportScale = units => (units === "inch" ? 1 / 25.4 : 1);
export function exportOptions(options = {}) {
  const kerf = options.kerf ?? 0;
  if (!Number.isFinite(kerf) || kerf < 0 || kerf > 5) throw new Error("Kerf must be between 0 and 5 mm");
  if (options.units && !["mm", "inch"].includes(options.units)) throw new Error("Unknown export unit");
  if (options.kerfDirection && !["inward", "outward"].includes(options.kerfDirection))
    throw new Error("Unknown kerf direction");
  return { ...options, kerf, units: options.units ?? "mm", layers: options.layers ?? EXPORT_LAYERS };
}
export const svgRings = svg => parseSVGOutline(svg, EXPORT_TOLERANCE).shapes.flatMap(s => s.rings);
// XOR respects disconnected islands and counters, independent of winding.
const polygonsOf = rings => (rings.length ? polygonClipping.xor(...rings.map(r => [r])) : []);

export function offsetPolygons(polygons, distance) {
  if (!distance || !polygons.length) return polygons;
  const r = Math.abs(distance),
    capsules = [];
  const n = Math.max(8, arcSegmentsFor(r, Math.PI, EXPORT_TOLERANCE / 2));
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-10) continue;
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        const cap = [];
        for (const [point, start] of [
          [b, angle],
          [a, angle - Math.PI],
        ])
          for (let j = 0; j <= n; j++) {
            const t = start - (Math.PI * j) / n;
            cap.push([point[0] + r * Math.cos(t), point[1] + r * Math.sin(t)]);
          }
        capsules.push([cap]);
      }
  const operation = distance > 0 ? polygonClipping.union : polygonClipping.difference;
  try {
    return fromClipping(operation(polygons, ...capsules));
  } catch {
    // Coincident capsule tangencies can confuse the sweep at floating-point
    // precision. Retry on a micron-fraction grid, far below the 0.02 mm curve
    // tolerance, instead of dropping a hole or returning uncompensated geometry.
    const snap = multi =>
      multi.map(poly => poly.map(ring => ring.map(([x, y]) => [Math.round(x * 1e8) / 1e8, Math.round(y * 1e8) / 1e8])));
    return fromClipping(operation(snap(polygons), ...capsules.map(poly => snap([poly])[0])));
  }
}

export function profileSVG(p) {
  if (p.kind === "circle") return `<circle cx="${p.x}" cy="${p.y}" r="${p.r}"/>`;
  if (p.kind === "rect")
    return `<rect x="${p.x - p.w / 2}" y="${p.y - p.h / 2}" width="${p.w}" height="${p.h}" rx="${p.r}" transform="rotate(${(p.angle * 180) / Math.PI} ${p.x} ${p.y})"/>`;
  return `<path fill-rule="evenodd" d="${p.rings.map(r => `M ${r.map(v => v.join(" ")).join(" L ")} Z`).join(" ")}"/>`;
}

function holeProfile(hole, shape, small) {
  const w = small ? hole.exitW : hole.w,
    h = small ? hole.exitH : hole.h;
  if (!(w > 0 && h > 0)) return null;
  const radius = (small ? hole.exitHoleRadius : hole.holeRadius) || 0;
  const base = { x: hole.x, y: hole.y, w, h, angle: hole.angle || 0 };
  if (shape === "Circle") return { ...base, kind: "circle", r: w / 2 };
  if (shape === "Rectangle" || shape === "Pill")
    return { ...base, kind: "rect", r: shape === "Pill" ? Math.min(w, h) / 2 : Math.min(radius, w / 2, h / 2) };
  return {
    kind: "rings",
    rings: svgRings(
      holeSVGElement(
        hole.x,
        hole.y,
        shape,
        w,
        h,
        "",
        "",
        hole.angle,
        radius,
        small ? holeExitOutline(hole) : holeOutline(hole)
      )
    ),
  };
}

// Exact bounding boxes for retained primitives, polygon bounds otherwise.
export function profileBounds(profile) {
  if (profile.kind === "circle")
    return {
      left: profile.x - profile.r,
      right: profile.x + profile.r,
      top: profile.y - profile.r,
      bottom: profile.y + profile.r,
    };
  if (profile.kind === "rect") {
    const c = Math.abs(Math.cos(profile.angle)),
      s = Math.abs(Math.sin(profile.angle));
    const dx = c * (profile.w / 2 - profile.r) + s * (profile.h / 2 - profile.r) + profile.r;
    const dy = s * (profile.w / 2 - profile.r) + c * (profile.h / 2 - profile.r) + profile.r;
    return { left: profile.x - dx, right: profile.x + dx, top: profile.y - dy, bottom: profile.y + dy };
  }
  return ringsBBox(profile.rings);
}
export function extendExportBounds(frame, profile, padding = 0) {
  if (profile.kind === "rings" && !profile.rings.length) return;
  const box = profileBounds(profile);
  frame.left = Math.min(frame.left, box.left - padding);
  frame.top = Math.min(frame.top, box.top - padding);
  frame.right = Math.max(frame.right, box.right + padding);
  frame.bottom = Math.max(frame.bottom, box.bottom + padding);
}

function clippedProfile(profile, bounds, distance) {
  const rings = profile.kind === "rings" ? profile.rings : svgRings(profileSVG(profile));
  if (!rings.length) return null;
  const box = profileBounds(profile);
  const where = bounds.classifyBox(box.left, box.top, box.right, box.bottom);
  if (where === "outside") return null;
  if (where === "inside" && !distance) return profile;
  if (where === "inside" && profile.kind === "circle")
    return profile.r + distance > 0 ? { ...profile, r: profile.r + distance } : null;
  let polygons = polygonsOf(rings);
  if (where !== "inside") polygons = polygonClipping.intersection(polygons, bounds.polygons);
  const result = offsetPolygons(polygons, distance);
  const output = fromClipping(result).flat();
  return output.length ? { kind: "rings", rings: output } : null;
}

export function* manufacturingProfiles(holes, params, region = null, input = {}) {
  const options = exportOptions(input),
    bounds = region ?? regionFromParams(params);
  const enabled = name => options.layers.includes(name);
  if (enabled("OUTLINE")) {
    if (options.trim) yield { layer: "OUTLINE", kind: "rings", rings: bounds.rings };
    else
      yield {
        layer: "OUTLINE",
        kind: "rect",
        x: params.sheetW / 2,
        y: params.sheetH / 2,
        w: params.sheetW,
        h: params.sheetH,
        r: 0,
        angle: 0,
      };
  }
  const taper = params.thickness > 0 && params.taperAngle > 0;
  const distance = (options.kerf / 2) * (options.kerfDirection === "outward" ? 1 : -1);
  for (const layer of ["HOLES", "HOLES_EXIT"]) {
    if (!enabled(layer) || (layer === "HOLES_EXIT" && !taper)) continue;
    const small = taper && (layer === "HOLES") !== (params.taperDirection === "Top larger");
    for (const hole of holes) {
      const profile = holeProfile(hole, params.holeShape || "Circle", small);
      const result = profile && clippedProfile(profile, bounds, distance);
      if (result) yield { layer, ...result };
    }
  }
  // With trim, cutouts already belong to the material outline. Keepouts are
  // reference contours; avoid duplicate toolpaths when both layers are selected.
  if (enabled("KEEPOUT") && !(options.trim && enabled("OUTLINE")))
    for (const path of bounds.svgCutouts()) {
      yield { layer: "KEEPOUT", kind: "rings", rings: svgRings(`<path d="${path}"/>`) };
    }
}
