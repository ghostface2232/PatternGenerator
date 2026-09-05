// Brightness maps for image controllers (Phase 2, §5.3).
//
// Decoding a file needs the DOM, so that half lives in `ui/useImageMaps.js`.
// Everything here is pure: a small greyscale grid, the placement rectangle that
// puts it on the sheet, and the transfer curve that turns a pixel into a channel
// weight. Keeping it separate is what lets `node --test` cover the sampling.
import { clamp } from "../core/math.js";

// Longest side of a decoded map. 192² floats is 147 KB, small enough to keep per
// controller and fine enough that a hole never lands between two "pixels" of the
// pattern the user sees — the holes are the resolution limit, not the map.
export const IMAGE_MAP_SIZE = 192;

// Relative luminance with the sRGB weights, on the gamma-encoded values. This is
// what halftone work wants: it matches how the source image looks rather than
// how much light it emits.
export function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function createImageMap(width, height, data) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
  if (!data || data.length < width * height) return null;
  return { width, height, data };
}

// Bilinear sample at (u, v) in 0..1, edges clamped.
export function sampleImageMap(map, u, v) {
  const { width, height, data } = map;
  const fx = clamp(u, 0, 1) * (width - 1);
  const fy = clamp(v, 0, 1) * (height - 1);
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy);
  const x1 = Math.min(width - 1, x0 + 1),
    y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - x0,
    ty = fy - y0;
  const a = data[y0 * width + x0],
    b = data[y0 * width + x1];
  const c = data[y1 * width + x0],
    d = data[y1 * width + x1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

// Sheet millimetres → the placement rectangle's own 0..1 coordinates.
// Returns null outside it, which is how an image controller stops reaching.
export function placementUV(placement, x, y) {
  if (!placement || !(placement.w > 0) || !(placement.h > 0)) return null;
  const cx = placement.x + placement.w / 2;
  const cy = placement.y + placement.h / 2;
  const angle = ((placement.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(-angle),
    sin = Math.sin(-angle);
  const dx = x - cx,
    dy = y - cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const u = lx / placement.w + 0.5;
  const v = ly / placement.h + 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}

// invert → gamma → remap into [min, max]. The order matters: gamma on the
// inverted value is what makes "shrink the holes in the dark parts" adjustable
// without also moving where the midtones sit.
export function transferBrightness(value, transfer = {}) {
  const invert = transfer.invert === true;
  const gamma = Number.isFinite(transfer.gamma) && transfer.gamma > 0 ? transfer.gamma : 1;
  const min = Number.isFinite(transfer.min) ? clamp(transfer.min, 0, 1) : 0;
  const max = Number.isFinite(transfer.max) ? clamp(transfer.max, 0, 1) : 1;
  // A non-finite sample would come back out of clamp() unchanged and then poison
  // every blend the controller takes part in, silently emptying the pattern.
  let v = Number.isFinite(value) ? clamp(value, 0, 1) : 0;
  if (invert) v = 1 - v;
  v = Math.pow(v, gamma);
  return clamp(min + (max - min) * v, 0, 1);
}

// The whole chain, for one sample point. null = the point is outside the image.
export function imageWeightAt(map, placement, transfer, x, y) {
  const uv = placementUV(placement, x, y);
  if (!uv) return null;
  return transferBrightness(sampleImageMap(map, uv.u, uv.v), transfer);
}

// The four corners of a placement rectangle, in sheet mm (drawing its handles).
export function placementCorners(placement) {
  if (!placement) return [];
  const cx = placement.x + placement.w / 2;
  const cy = placement.y + placement.h / 2;
  const angle = ((placement.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const hw = placement.w / 2,
    hh = placement.h / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }));
}
