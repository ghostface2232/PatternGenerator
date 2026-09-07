// Pure canvas drawing of the current scene. No React, no state: the component
// gathers everything into a `scene` object and calls drawScene() in an effect.
// Returns the view transform so pointer handlers can map client → sheet space.
import { holeExitOutline, holeOutline, traceHolePath } from "../geometry/shapes.js";
import { strokeMaxWidth } from "../geometry/stroke.js";
import { evaluateVariationField } from "../fields/variation-engine.js";
import { computeGizmo } from "../fields/gizmo.js";
import { channelBase, evaluateCompiled, resolveSyncedGeometry } from "../fields/controllers.js";
import { controllerHandles, controllerPolyline } from "../fields/controller-gizmo.js";
import { placementCorners } from "../fields/image-map.js";
import { defaultPathPoints, flattenPath } from "../layouts/path.js";
import { boundaryHandles } from "../geometry/boundary-gizmo.js";
import { computeView } from "./view.js";

export function drawScene(canvas, scene) {
  const {
    dark,
    pan,
    zoom,
    params,
    holes,
    overlaps,
    removedSet,
    perfMode,
    holeCount,
    holeShape,
    showHud,
    variation,
    variationEditMode,
    selectedVariationLayer,
    fields,
    selectedControllerId,
    field,
    fieldEditMode,
    activeChannel,
    imageElements,
    taperActive,
    holeColor,
    bgColor,
    geometry,
    pathBlock,
    pathEditMode,
    selectedPath,
    penStart,
    trim,
    boundary,
    boundaryEditMode,
    selectedCutoutId,
  } = scene;
  const { sheetW, sheetH } = params;
  const { perfW, perfH, region } = geometry;
  // The frame the variation gizmo, the heat maps and the default path are laid
  // out in: the region's bounding rectangle.
  const marginLeft = geometry.perfX,
    marginTop = geometry.perfY;

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = rect.width,
    ch = rect.height;

  ctx.fillStyle = dark ? "#101013" : "#e9e9ee";
  ctx.fillRect(0, 0, cw, ch);
  // A faint dot grid on the desk, the way a design tool's canvas has one: it
  // gives the eye a scale to read the sheet against and makes panning felt.
  drawDesk(ctx, cw, ch, pan, zoom, dark);

  const view = computeView(cw, ch, sheetW, sheetH, pan, zoom);
  const { baseScale, cx, cy } = view;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(baseScale, baseScale);
  ctx.translate(-sheetW / 2, -sheetH / 2);

  // The material, with its shadow: the whole sheet, or — trimmed — the region
  // itself, which is then the part that is cut out and nothing else is drawn.
  ctx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 20 / baseScale;
  ctx.shadowOffsetX = 3 / baseScale;
  ctx.shadowOffsetY = 3 / baseScale;
  ctx.fillStyle = bgColor;
  if (trim) {
    ctx.beginPath();
    region.trace(ctx);
    ctx.fill(region.fillRule);
    ctx.shadowColor = "transparent";
    ctx.fill(region.fillRule);
  } else {
    ctx.fillRect(0, 0, sheetW, sheetH);
    ctx.shadowColor = "transparent";
    ctx.fillRect(0, 0, sheetW, sheetH);
  }

  {
    const showBoundary = showHud && region.clips && !region.empty;
    if (showBoundary) {
      ctx.strokeStyle = dark ? "rgba(100,160,250,0.15)" : "rgba(37,99,235,0.1)";
      ctx.lineWidth = 0.3;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      region.trace(ctx);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!trim) {
        // Shade the metal outside the region: the sheet and the region in one
        // even-odd path, so the shade lands wherever the crossing count is
        // odd — outside the outline and inside a cutout — and nowhere else.
        ctx.fillStyle = dark ? "rgba(100,160,250,0.04)" : "rgba(37,99,235,0.03)";
        ctx.beginPath();
        ctx.rect(0, 0, sheetW, sheetH);
        region.trace(ctx);
        ctx.fill("evenodd");
      }
    }
    if (showHud && region.cutouts.length) {
      // Keep-outs read as what they are: an outline of their own, a little
      // firmer than the boundary's, since a screw hole is a feature and not a
      // margin.
      ctx.strokeStyle = dark ? "rgba(251,191,36,0.55)" : "rgba(180,83,9,0.5)";
      ctx.lineWidth = 0.35;
      ctx.setLineDash([1.5, 1.5]);
      ctx.beginPath();
      region.traceCutouts(ctx);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (variation.enabled && variationEditMode && showHud) {
    const cols = 34,
      rows = Math.max(18, Math.round((cols * perfH) / Math.max(1, perfW)));
    const cellW = perfW / cols,
      cellH = perfH / rows;
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

  const showFieldOverlay = fieldEditMode && showHud && fields?.enabled;

  const showTaperRings = taperActive && !perfMode;

  // Clip holes to the actual perforation boundary so preview, OAR and exports agree.
  ctx.save();
  ctx.beginPath();
  region.trace(ctx);
  ctx.clip(region.fillRule);

  if (perfMode) {
    ctx.fillStyle = holeColor;
    holes.forEach((h, i) => {
      if (removedSet.has(i) || h.culled) return;
      // A hole that carries its own outline is not centred in its bounding box,
      // so the cheap stand-in is a square about its own origin — a Voronoi
      // cell's site is inside its cell, and its narrower dimension fits there.
      const w = h.poly ? Math.min(h.w, h.h) : h.w;
      const height = h.poly ? Math.min(h.w, h.h) : h.h;
      ctx.fillRect(h.x - w * 0.35, h.y - height * 0.35, w * 0.7, height * 0.7);
    });
  } else {
    // `overlaps` indexes the active (non-removed, non-culled) list; map back to `holes`.
    const activeIndices = [];
    holes.forEach((h, i) => {
      if (!removedSet.has(i) && !h.culled) activeIndices.push(i);
    });
    const activeOverlapSet = new Set();
    overlaps.forEach(activeIdx => {
      if (activeIdx < activeIndices.length) activeOverlapSet.add(activeIndices[activeIdx]);
    });

    holes.forEach((h, i) => {
      const isRemoved = removedSet.has(i);
      // How big to draw the marks placed AT a hole — the removed cross, the
      // highlight. That is the hole's own extent, except for a slot, whose
      // extent is the panel and whose width is what a mark should match.
      const r = h.stroke ? Math.max(0.15, strokeMaxWidth(h.stroke) / 2) : Math.max(h.w, h.h) / 2;
      if (h.culled && !isRemoved) {
        // Culled by the size floor: gone from the real pattern. Show a faint ghost only while editing.
        if (variation.enabled && variationEditMode && showHud) {
          ctx.beginPath();
          ctx.arc(h.x, h.y, Math.max(0.15, r), 0, Math.PI * 2);
          ctx.strokeStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
          ctx.lineWidth = 0.2;
          ctx.setLineDash([0.6, 0.6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        return;
      }
      if (isRemoved) {
        if (!showHud) return; // HUD hidden: removed holes vanish entirely
        ctx.beginPath();
        traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius, holeOutline(h));
        ctx.strokeStyle = dark ? "rgba(255,100,100,0.25)" : "rgba(200,50,50,0.2)";
        ctx.lineWidth = 0.4;
        ctx.setLineDash([1, 1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = dark ? "rgba(255,100,100,0.35)" : "rgba(200,50,50,0.3)";
        ctx.lineWidth = 0.3;
        const xr = r * 0.5;
        ctx.beginPath();
        ctx.moveTo(h.x - xr, h.y - xr);
        ctx.lineTo(h.x + xr, h.y + xr);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(h.x + xr, h.y - xr);
        ctx.lineTo(h.x - xr, h.y + xr);
        ctx.stroke();
        return;
      }
      const isOverlap = activeOverlapSet.has(i);
      const isClosed = h.isClosed;
      ctx.beginPath();
      traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius, holeOutline(h));
      ctx.fillStyle = isClosed
        ? dark
          ? "rgba(220,50,50,0.55)"
          : "rgba(200,30,30,0.45)"
        : isOverlap
          ? dark
            ? "rgba(220,50,50,0.7)"
            : "rgba(200,30,30,0.6)"
          : holeColor;
      ctx.fill();
      if (showTaperRings && !isClosed) {
        ctx.strokeStyle = dark ? "rgba(200,200,210,0.4)" : "rgba(60,60,70,0.35)";
        ctx.lineWidth = 0.25;
        ctx.stroke();
      }
      // Subtle radial highlight, circles only (skipped for complex shapes for perf)
      if (holeShape === "Circle" && !isOverlap && !isClosed && zoom > 0.5) {
        const grad = ctx.createRadialGradient(h.x - r * 0.2, h.y - r * 0.2, 0, h.x, h.y, r);
        grad.addColorStop(0, dark ? "rgba(40,40,45,0.3)" : "rgba(60,60,65,0.2)");
        grad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      // Taper ring: fill gap between entry and exit shapes
      if (showTaperRings && h.exitW > 0 && h.exitH > 0 && !isClosed) {
        ctx.beginPath();
        traceHolePath(ctx, h.x, h.y, holeShape, h.w, h.h, h.angle, h.holeRadius, holeOutline(h));
        ctx.save();
        ctx.clip();
        ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
        ctx.fillRect(h.x - h.w, h.y - h.h, h.w * 2, h.h * 2);
        ctx.beginPath();
        traceHolePath(ctx, h.x, h.y, holeShape, h.exitW, h.exitH, h.angle, h.exitHoleRadius, holeExitOutline(h));
        ctx.fillStyle = holeColor;
        ctx.fill();
        ctx.restore();
      }
    });
  }

  ctx.restore(); // end hole clipping

  ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  if (trim) {
    ctx.beginPath();
    region.trace(ctx);
    ctx.stroke();
  } else {
    ctx.strokeRect(0, 0, sheetW, sheetH);
  }

  if (variation.enabled && variationEditMode && selectedVariationLayer && showHud) {
    drawGizmo(ctx, selectedVariationLayer, { marginLeft, marginTop, perfW, perfH }, sheetW, sheetH, baseScale, dark);
  }
  if (geometry.isPath && showHud) {
    // Drawn whenever the mode is Path, not only while editing it: the curve is
    // what the holes are strung along, and a mode whose one input is invisible
    // until you press a button in a panel is a mode you have to be told about.
    // Handles still belong to the edit mode.
    drawPaths(ctx, {
      pathBlock,
      selectedPath,
      editing: pathEditMode,
      penStart,
      bounds: { xMin: marginLeft, xMax: marginLeft + perfW, yMin: marginTop, yMax: marginTop + perfH },
      baseScale,
      dark,
    });
  }
  if (boundaryEditMode && showHud && boundary) {
    drawBoundaryHandles(ctx, { boundary, region, selectedCutoutId, baseScale, dark });
  }
  if (showFieldOverlay) {
    // Over the holes, not under them: at 35% open area a third of the sheet is
    // hole, and an overlay that answers "where does this reach, and which way"
    // is useless with a third of it painted over.
    drawChannelHeatmap(ctx, { field, activeChannel, marginLeft, marginTop, perfW, perfH, fields });
    drawControllers(ctx, { fields, selectedControllerId, activeChannel, imageElements, sheetW, sheetH, baseScale, dark }); // prettier-ignore
  }
  ctx.restore();

  if (perfMode) {
    ctx.fillStyle = dark ? "rgba(220,160,40,0.85)" : "rgba(180,120,20,0.9)";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`⚡ Performance mode (${holeCount.toLocaleString()} holes)`, 12, ch - 12);
  }
  return view;
}

// The desk under the sheet: a dot every 24 screen pixels at zoom 1, moving with
// the pan and stepping to a coarser grid as the view zooms out, so the dots
// never crowd. Screen-space, so it costs the same at any sheet size.
function drawDesk(ctx, cw, ch, pan, zoom, dark) {
  let step = 24 * zoom;
  while (step < 14) step *= 2;
  while (step > 56) step /= 2;
  const ox = ((cw / 2 + pan.x) % step) - step;
  const oy = ((ch / 2 + pan.y) % step) - step;
  ctx.fillStyle = dark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.07)";
  for (let y = oy; y < ch + step; y += step) {
    for (let x = ox; x < cw + step; x += step) {
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    }
  }
}

// The four-handle variation gizmo, drawn in sheet space.
function drawGizmo(ctx, layer, geom, sheetW, sheetH, baseScale, dark) {
  const px = 1 / baseScale; // one screen pixel in sheet units
  const g = computeGizmo(layer, geom, 12 * px);
  const accent = dark ? "#93c5fd" : "#2563eb";
  const dialColor = dark ? "#fbbf24" : "#d97706";
  const space = layer.space;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, sheetW, sheetH);
  ctx.clip();

  // Spread ring (where the field reaches) — meaningful for radial-like spaces.
  if (space === "Radial" || space === "Spiral") {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1 * px;
    ctx.setLineDash([4 * px, 4 * px]);
    ctx.beginPath();
    ctx.arc(g.centerX, g.centerY, g.reachLen, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Gradient line: center (start) -> reach (end).
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4 * px;
  ctx.beginPath();
  ctx.moveTo(g.centerX, g.centerY);
  ctx.lineTo(g.reachX, g.reachY);
  ctx.stroke();

  // Curve dial: rotary track + needle hugging the centre.
  ctx.strokeStyle = dialColor;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1 * px;
  ctx.beginPath();
  ctx.arc(g.centerX, g.centerY, g.dialR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(g.centerX, g.centerY);
  ctx.lineTo(g.curveX, g.curveY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Reach handle (open ring) — gradient end point.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.6 * px;
  ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
  ctx.beginPath();
  ctx.arc(g.reachX, g.reachY, 5 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Position/phase stop (filled diamond) — slides along the gradient line.
  ctx.fillStyle = accent;
  ctx.strokeStyle = dark ? "#0f0f11" : "#ffffff";
  ctx.lineWidth = 1 * px;
  ctx.save();
  ctx.translate(g.stopX, g.stopY);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-3.4 * px, -3.4 * px, 6.8 * px, 6.8 * px);
  ctx.strokeRect(-3.4 * px, -3.4 * px, 6.8 * px, 6.8 * px);
  ctx.restore();

  // Curve knob (filled dot on the dial).
  ctx.fillStyle = dialColor;
  ctx.strokeStyle = dark ? "#0f0f11" : "#ffffff";
  ctx.lineWidth = 1 * px;
  ctx.beginPath();
  ctx.arc(g.curveX, g.curveY, 4 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Center handle (filled dot with light core) — gradient start.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(g.centerX, g.centerY, 5.5 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
  ctx.beginPath();
  ctx.arc(g.centerX, g.centerY, 2 * px, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Field controllers (Phase 2) ──────────────────────────────────────

// The active channel's value across the perforation area, as a diverging wash:
// cool below the channel's neutral value, warm above it. The scale is set by the
// strongest controller on the channel rather than by the slider range, so a
// gentle field still reads — the overlay answers "where does this reach and how
// hard", which a fixed scale would flatten to one colour on a subtle field.
function drawChannelHeatmap(ctx, { field, activeChannel, marginLeft, marginTop, perfW, perfH, fields }) {
  const base = channelBase(activeChannel);
  let span = 0;
  for (const controller of fields.controllers) {
    if (controller.channel === activeChannel && controller.enabled !== false) {
      span = Math.max(span, Math.abs(controller.target - base));
    }
  }
  if (span <= 0 || perfW <= 0 || perfH <= 0) return;

  const cols = 40;
  const rows = Math.max(20, Math.round((cols * perfH) / Math.max(1, perfW)));
  const cellW = perfW / cols,
    cellH = perfH / rows;
  ctx.save();
  // Painted plainly, not through a blend mode. The variation overlay uses
  // "screen" in the dark theme, which works there because it is monochrome — but
  // the sheet is a light colour in BOTH themes, and screening a diverging warm /
  // cool scale onto a light ground flattens it to roughly a third of the contrast
  // it has in the light theme. This map encodes a sign, so that contrast is the
  // information.
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = marginLeft + (gx + 0.5) * cellW;
      const y = marginTop + (gy + 0.5) * cellH;
      const value = evaluateCompiled(field, activeChannel, x, y, base);
      const t = (value - base) / span; // −1 … 1 over the strongest controller's pull
      const strength = Math.min(1, Math.abs(t));
      if (strength < 0.01) continue;
      const alpha = 0.05 + strength * 0.22;
      ctx.fillStyle = t > 0 ? `rgba(245,158,11,${alpha})` : `rgba(37,99,235,${alpha})`;
      ctx.fillRect(marginLeft + gx * cellW, marginTop + gy * cellH, cellW + 0.05, cellH + 0.05);
    }
  }
  ctx.restore();
}

// Controllers on the active channel are drawn solid; the rest stay visible but
// faint, so switching channels never loses track of what else is on the sheet.
function drawControllers(
  ctx,
  { fields, selectedControllerId, activeChannel, imageElements, sheetW, sheetH, baseScale, dark }
) {
  // prettier-ignore
  const px = 1 / baseScale;
  const byId = new Map(fields.controllers.map(c => [c.id, c]));
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, sheetW, sheetH);
  ctx.clip();
  const ordered = [...fields.controllers].sort((a, b) => (a.channel === activeChannel ? 1 : 0) - (b.channel === activeChannel ? 1 : 0)); // prettier-ignore
  for (const controller of ordered) {
    const active = controller.channel === activeChannel;
    const selected = active && controller.id === selectedControllerId;
    ctx.globalAlpha = controller.enabled === false ? 0.25 : active ? 1 : 0.28;
    // What is drawn has to be what is measured. A synced controller reads the
    // geometry it follows, so drawing its own points would put a reach band
    // where there is no field and hand the user handles that drive nothing.
    drawController(ctx, controller, { source: resolveSyncedGeometry(controller, byId), selected, active, imageElements, px, dark }); // prettier-ignore
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// The translucent reach band is drawn as a fat stroke, so a reach approaching the
// panel size covers everything at a uniform tint that says nothing. Fading it as
// it widens keeps a small reach legible and a huge one out of the way; the
// controller's own path stays fully opaque either way.
const bandAlpha = radius => 0.1 * Math.max(0.22, Math.min(1, 40 / Math.max(1, radius || 1)));

// The Path layout's curves and their draggable vertices.
//
// The curve itself is drawn whenever the mode is on, including the default one
// the layout falls back to when the document holds none — so "no path of your
// own yet" is something you can SEE, outlined under the holes, rather than
// something a panel has to tell you. The handles are the edit mode's, and they
// go on top of the holes, because a handle you cannot see is not a handle.
function drawPaths(ctx, { pathBlock, selectedPath, editing, penStart, bounds, baseScale, dark }) {
  const own = pathBlock?.paths || [];
  const paths = own.length ? own : [{ points: defaultPathPoints(bounds), closed: false, ghost: true }];
  const px = 1 / baseScale;
  const accent = dark ? "#f97316" : "#c2410c";
  const faint = dark ? "rgba(249,115,22,0.35)" : "rgba(194,65,12,0.3)";
  // The sheet is light in both themes — it is metal, not chrome — so the guide
  // takes its contrast from the sheet rather than from the app's palette. A 35%
  // bright orange over light grey is a line you have to be told is there.
  const guide = "rgba(180,60,10,0.75)";
  paths.forEach((path, index) => {
    const active = editing && !path.ghost && index === selectedPath;
    const poly = flattenPath(path.points, { closed: path.closed, smooth: pathBlock.smooth !== false });
    if (poly.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.strokeStyle = active ? accent : editing ? faint : guide;
      ctx.lineWidth = (active ? 1.6 : 1.3) * px;
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The chord through the vertices, so a smoothed curve still shows what the
    // handles actually control.
    if (editing && pathBlock.smooth !== false && path.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
      if (path.closed) ctx.closePath();
      ctx.strokeStyle = active ? faint : dark ? "rgba(249,115,22,0.15)" : "rgba(194,65,12,0.12)";
      ctx.lineWidth = 0.7 * px;
      ctx.stroke();
    }
    if (!active) return;
    // Ink fill, accent ring: the same handle the variation gizmo's reach point
    // and the controllers' hollow handles use, at the reach point's size. The
    // ring is what reads — filled with the accent, a handle over a black hole
    // was a dark dot on a dark dot.
    for (const point of path.points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5 * px, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6 * px;
      ctx.stroke();
    }
  });
  // The pen's first click on a new curve, held until the second: a hollow
  // accent ring where the curve will start.
  if (editing && penStart) {
    ctx.beginPath();
    ctx.arc(penStart.x, penStart.y, 5 * px, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#0f0f11" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.6 * px;
    ctx.setLineDash([2 * px, 2 * px]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// The boundary's handles: the outline's vertices and each cutout's centre and
// rim, over the holes so they can be reached, in the teal the edit badge
// wears. The selected cutout's outline is drawn solid so the inspector and
// the canvas agree about which one is meant.
function drawBoundaryHandles(ctx, { boundary, region, selectedCutoutId, baseScale, dark }) {
  const px = 1 / baseScale;
  const accent = dark ? "#2dd4bf" : "#0f766e";
  const ink = dark ? "#0f0f11" : "#ffffff";
  ctx.save();
  // The outline itself, firmly: while editing it, it is the subject.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1 * px;
  ctx.setLineDash([4 * px, 3 * px]);
  ctx.beginPath();
  region.trace(ctx);
  ctx.stroke();
  ctx.setLineDash([]);
  const selected = selectedCutoutId != null ? region.cutouts.find(c => c.id === selectedCutoutId) : null;
  if (selected) {
    ctx.lineWidth = 1.4 * px;
    ctx.beginPath();
    ctx.moveTo(selected.ring[0][0], selected.ring[0][1]);
    for (let i = 1; i < selected.ring.length; i++) ctx.lineTo(selected.ring[i][0], selected.ring[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  for (const handle of boundaryHandles(boundary)) {
    const hollow = handle.role !== "move";
    const r = (handle.role === "size" ? 4 : 4.6) * px;
    ctx.beginPath();
    if (handle.role === "vertex" && handle.cutout === undefined) {
      // Outline vertices as squares, so they read apart from the round cutout handles.
      ctx.rect(handle.x - r, handle.y - r, 2 * r, 2 * r);
    } else {
      ctx.arc(handle.x, handle.y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = hollow ? ink : accent;
    ctx.fill();
    ctx.strokeStyle = hollow ? accent : ink;
    ctx.lineWidth = 1.4 * px;
    ctx.stroke();
  }
  ctx.restore();
}

const CHANNEL_COLOR = {
  size: { dark: "#60a5fa", light: "#2563eb" },
  spacing: { dark: "#34d399", light: "#059669" },
  angle: { dark: "#fbbf24", light: "#d97706" },
  shape: { dark: "#f472b6", light: "#db2777" },
};

function drawController(ctx, controller, { source = controller, selected, active, imageElements, px, dark }) {
  const palette = CHANNEL_COLOR[controller.channel] || CHANNEL_COLOR.size;
  const color = dark ? palette.dark : palette.light;
  const ink = dark ? "#0f0f11" : "#ffffff";

  if (controller.kind === "image") {
    const placement = controller.image?.placement;
    if (!placement) return;
    const corners = placementCorners(placement);
    const image = imageElements?.[controller.image.assetId];
    if (image) {
      ctx.save();
      ctx.translate(placement.x + placement.w / 2, placement.y + placement.h / 2);
      ctx.rotate(((placement.rotation || 0) * Math.PI) / 180);
      ctx.globalAlpha *= 0.45;
      ctx.drawImage(image, -placement.w / 2, -placement.h / 2, placement.w, placement.h);
      ctx.restore();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = (selected ? 1.6 : 1) * px;
    ctx.setLineDash(image ? [] : [3 * px, 3 * px]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const path = controllerPolyline(controller, source);
    if (!path.length) return;
    if (path.length > 1) {
      // The reach, as a band around the path — the shape of the field, drawn
      // with a fat translucent stroke rather than by offsetting the polyline.
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha *= bandAlpha(controller.radius);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.2, (controller.radius || 1) * 2);
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = color;
      ctx.lineWidth = (selected ? 1.8 : 1.2) * px;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.globalAlpha *= bandAlpha(controller.radius);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(path[0].x, path[0].y, Math.max(0.1, controller.radius || 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = color;
      ctx.lineWidth = (selected ? 1.4 : 0.9) * px;
      ctx.setLineDash([3 * px, 3 * px]);
      ctx.beginPath();
      ctx.arc(path[0].x, path[0].y, Math.max(0.1, controller.radius || 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // A one-sided controller shows which way it faces, once, at the middle.
    if (controller.oneSided && path.length > 1) {
      const mid = Math.floor((path.length - 1) / 2);
      const a = path[mid],
        b = path[mid + 1] || path[mid];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = (-(b.y - a.y) / len) * controller.oneSided;
      const ny = ((b.x - a.x) / len) * controller.oneSided;
      const ox = (a.x + b.x) / 2,
        oy = (a.y + b.y) / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2 * px;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + nx * 9 * px, oy + ny * 9 * px);
      ctx.stroke();
    }
  }

  if (!active) return;
  // A cubic's two inner points are tangent handles, and read as such only with
  // the arm drawn from the anchor they belong to — the convention every vector
  // editor shares. Drawn under the handles, in the controller's colour, thin.
  const points = source.geometry?.points || [];
  if (source.kind === "curve" && points.length >= 4 && source === controller) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = 1 * px;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.moveTo(points[3].x, points[3].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.stroke();
    ctx.restore();
  }
  // The polyline's chord under a smoothed reach band: the vertices are what
  // the handles move, so the straight line between them is what to read.
  for (const handle of controllerHandles(controller, source)) {
    const tangent = source.kind === "curve" && handle.role === "mid";
    const r = (handle.role === "radius" || handle.role === "rotate" ? 4 : tangent ? 3.2 : handle.role === "mid" ? 3.6 : selected ? 4.8 : 4.4) * px; // prettier-ignore
    const hollow = handle.role === "radius" || handle.role === "rotate" || handle.role === "size" || tangent;
    ctx.beginPath();
    if (handle.role === "size") {
      // The image's corner handle is a square, as a resize grip is everywhere.
      ctx.rect(handle.x - r, handle.y - r, 2 * r, 2 * r);
    } else if (tangent) {
      // Tangent handles are diamonds, so the anchors stay the round ones.
      ctx.moveTo(handle.x, handle.y - r * 1.25);
      ctx.lineTo(handle.x + r * 1.25, handle.y);
      ctx.lineTo(handle.x, handle.y + r * 1.25);
      ctx.lineTo(handle.x - r * 1.25, handle.y);
      ctx.closePath();
    } else {
      ctx.arc(handle.x, handle.y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = hollow ? ink : color;
    ctx.fill();
    ctx.strokeStyle = hollow ? color : ink;
    ctx.lineWidth = (selected ? 1.6 : 1.2) * px;
    ctx.stroke();
  }
}
