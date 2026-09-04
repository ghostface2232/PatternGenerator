// High-resolution raster export of the sheet (default 8 px per mm).
import { traceHolePath } from "../geometry/shapes.js";
import { tracePerfBoundary } from "../geometry/boundary.js";

export function renderPNGBlob({ activeHoles, params, holeColor, bgColor, dark, pixelsPerMm = 8 }) {
  const { sheetW, sheetH, holeShape } = params;
  const taperActive = params.thickness > 0 && params.taperAngle > 0;
  const oc = document.createElement("canvas");
  oc.width = sheetW * pixelsPerMm; oc.height = sheetH * pixelsPerMm;
  const ctx = oc.getContext("2d");
  const s = Math.min(oc.width / sheetW, oc.height / sheetH);
  ctx.fillStyle = bgColor; ctx.fillRect(0, 0, oc.width, oc.height);
  ctx.save(); ctx.scale(s, s);
  tracePerfBoundary(ctx, params);
  ctx.clip();
  activeHoles.forEach(h => {
    ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
    ctx.fillStyle = h.isClosed ? "rgba(200,30,30,0.5)" : holeColor;
    ctx.fill();
    if (taperActive && h.exitW > 0 && h.exitH > 0 && !h.isClosed) {
      ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
      ctx.save(); ctx.clip();
      ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
      ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
      ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius);
      ctx.fillStyle = holeColor;
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.restore();
  return new Promise(resolve => oc.toBlob(resolve));
}
