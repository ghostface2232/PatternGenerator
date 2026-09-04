// Pure canvas drawing of the current scene. No React, no state: the component
// gathers everything into a `scene` object and calls drawScene() in an effect.
// Returns the view transform so pointer handlers can map client → sheet space.
import { traceHolePath } from "../geometry/shapes.js";
import { tracePerfBoundary } from "../geometry/boundary.js";
import { evaluateVariationField } from "../fields/variation-engine.js";
import { computeGizmo } from "../fields/gizmo.js";
import { computeView } from "./view.js";

export function drawScene(canvas, scene) {
  const {
    dark, pan, zoom, params, holes, overlaps, removedSet, perfMode, holeCount, holeShape,
    showHud, variation, variationEditMode, selectedVariationLayer, taperActive,
    holeColor, bgColor, geometry,
  } = scene;
  const { sheetW, sheetH, marginLeft, marginTop, marginRight, marginBottom, cornerRadius, patternType, radialMode } = params;
  const { perfW, perfH, hasAnyMargin } = geometry;
  const isRadialPattern = patternType === "Radial";

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = rect.width, ch = rect.height;

  ctx.fillStyle = dark ? "#0f0f11" : "#e8e8ec";
  ctx.fillRect(0, 0, cw, ch);

  const view = computeView(cw, ch, sheetW, sheetH, pan, zoom);
  const { baseScale, cx, cy } = view;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(baseScale, baseScale);
  ctx.translate(-sheetW / 2, -sheetH / 2);

  // Sheet shadow
  ctx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 20 / baseScale;
  ctx.shadowOffsetX = 3 / baseScale; ctx.shadowOffsetY = 3 / baseScale;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, sheetW, sheetH);
  ctx.shadowColor = "transparent";

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, sheetW, sheetH);

  {
    const mx = marginLeft, my = marginTop;
    const mw = sheetW - marginLeft - marginRight, mh = sheetH - marginTop - marginBottom;
    const cr = Math.min(cornerRadius, mw / 2, mh / 2);
    const isCircleMode = isRadialPattern && radialMode === "Circle";
    const showBoundary = showHud && (hasAnyMargin || cornerRadius > 0 || isCircleMode);
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

  if (variation.enabled && variationEditMode && showHud) {
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

  // Clip holes to the actual perforation boundary so preview, OAR and exports agree.
  ctx.save();
  tracePerfBoundary(ctx, params);
  ctx.clip();

  if (perfMode) {
    ctx.fillStyle = holeColor;
    holes.forEach((h, i) => {
      if (removedSet.has(i) || h.culled) return;
      ctx.fillRect(h.x - h.w * 0.35, h.y - h.h * 0.35, h.w * 0.7, h.h * 0.7);
    });
  } else {
    // `overlaps` indexes the active (non-removed, non-culled) list; map back to `holes`.
    const activeIndices = [];
    holes.forEach((h, i) => { if (!removedSet.has(i) && !h.culled) activeIndices.push(i); });
    const activeOverlapSet = new Set();
    overlaps.forEach((activeIdx) => {
      if (activeIdx < activeIndices.length) activeOverlapSet.add(activeIndices[activeIdx]);
    });

    holes.forEach((h, i) => {
      const isRemoved = removedSet.has(i);
      const r = Math.max(h.w, h.h) / 2;
      if (h.culled && !isRemoved) {
        // Culled by the size floor: gone from the real pattern. Show a faint ghost only while editing.
        if (variation.enabled && variationEditMode && showHud) {
          ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(0.15, r), 0, Math.PI * 2);
          ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
          ctx.lineWidth = 0.2; ctx.setLineDash([0.6, 0.6]); ctx.stroke(); ctx.setLineDash([]);
        }
        return;
      }
      if (isRemoved) {
        if (!showHud) return; // HUD hidden: removed holes vanish entirely
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
        ctx.strokeStyle = dark ? "rgba(255,100,100,0.25)" : "rgba(200,50,50,0.2)";
        ctx.lineWidth = 0.4;
        ctx.setLineDash([1, 1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = dark ? "rgba(255,100,100,0.35)" : "rgba(200,50,50,0.3)";
        ctx.lineWidth = 0.3;
        const xr = r * 0.5;
        ctx.beginPath(); ctx.moveTo(h.x - xr, h.y - xr); ctx.lineTo(h.x + xr, h.y + xr); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(h.x + xr, h.y - xr); ctx.lineTo(h.x - xr, h.y + xr); ctx.stroke();
        return;
      }
      const isOverlap = activeOverlapSet.has(i);
      const isClosed = h.isClosed;
      ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius);
      ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
        : isOverlap ? (dark ? "rgba(220,50,50,0.7)" : "rgba(200,30,30,0.6)")
        : holeColor;
      ctx.fill();
      if (showTaperRings && !isClosed) {
        ctx.strokeStyle = dark ? "rgba(200,200,210,0.4)" : "rgba(60,60,70,0.35)";
        ctx.lineWidth = 0.25; ctx.stroke();
      }
      // Subtle radial highlight, circles only (skipped for complex shapes for perf)
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
        ctx.save();
        ctx.clip();
        ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
        ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius);
        ctx.fillStyle = holeColor;
        ctx.fill();
        ctx.restore();
      }
    });
  }

  ctx.restore(); // end hole clipping

  ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5; ctx.strokeRect(0, 0, sheetW, sheetH);

  if (variation.enabled && variationEditMode && selectedVariationLayer && showHud) {
    drawGizmo(ctx, selectedVariationLayer, { marginLeft, marginTop, perfW, perfH }, sheetW, sheetH, baseScale, dark);
  }
  ctx.restore();

  if (perfMode) {
    ctx.fillStyle = dark ? "rgba(220,160,40,0.85)" : "rgba(180,120,20,0.9)";
    ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
    ctx.fillText(`⚡ Performance mode (${holeCount.toLocaleString()} holes)`, 12, ch - 12);
  }
  return view;
}

// The four-handle variation gizmo, drawn in sheet space.
function drawGizmo(ctx, layer, geom, sheetW, sheetH, baseScale, dark) {
  const px = 1 / baseScale;                       // one screen pixel in sheet units
  const g = computeGizmo(layer, geom, 12 * px);
  const accent = dark ? "#93c5fd" : "#2563eb";
  const dialColor = dark ? "#fbbf24" : "#d97706";
  const space = layer.space;
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

  // Curve dial: rotary track + needle hugging the centre.
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
