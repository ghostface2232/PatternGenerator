import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { clamp } from "../../core/math.js";
import { cloneVariation } from "../../core/document.js";
import {
  computeGizmo,
  gizmoPatchForCenter,
  gizmoPatchForCurve,
  gizmoPatchForReach,
  gizmoPatchForStop,
  gizmoUsesPosition,
  hitTestGizmo,
} from "../../fields/gizmo.js";
import { resolveSyncedGeometry } from "../../fields/controllers.js";
import { controllerBodyDistance, hitTestController, moveControllerHandle } from "../../fields/controller-gizmo.js";
import { hitTestPath, movePathVertex, pathBodyDistance } from "../../layouts/path-gizmo.js";
import { drawScene } from "../../render/canvas-renderer.js";
import { canvasToSheet, zoomAbout } from "../../render/view.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";
import { StatsHud, VariationHud } from "./Hud.jsx";
import { ToolRail } from "./ToolRail.jsx";

// A pointer that never travelled this far (in screen pixels) was a click.
const CLICK_SLOP = 5;
// Below this a canvas drag reads as a click, so a line or curve drawn by
// accident does not collapse into a zero-length one that cannot be grabbed.
const MIN_DRAW_MM = 2;

// The floating canvas card: draws the scene, and owns pan/zoom, hole-removal
// clicks and variation-gizmo drags.
export function CanvasView() {
  const {
    doc,
    api,
    theme,
    ui,
    params,
    geometry,
    holes,
    removedSet,
    overlaps,
    stats,
    history,
    selectedVariationLayer,
    field,
    imageElements,
    actions,
  } = useEditor();
  const { dark, showHud, holeRemovalMode, variationEditMode, pan, setPan, zoom, setZoom, setVariationHud } = ui;
  const { fieldEditMode, activeChannel, fieldTool, setFieldTool, selectedControllerId } = ui;
  const { pathEditMode, selectedPath } = ui;
  const pathBlock = doc.layout.path;
  const { variation, fields } = doc;
  const { holeColor, bgColor } = doc.appearance;
  const { marginLeft, marginTop } = params;
  const { perfW, perfH, taperActive } = geometry;

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const viewRef = useRef(null); // last view transform returned by drawScene
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const pointerDownPos = useRef(null);
  const variationDrag = useRef(null);
  const controllerDrag = useRef(null); // { id, handle } while a handle is held
  const pathDrag = useRef(null); // { pathIndex, pointIndex } while a path vertex is held
  const drawDrag = useRef(null); // { kind, from } while a line/curve is being drawn
  const [drawPreview, setDrawPreview] = useState(null);
  const spacePressed = useRef(false);

  useEffect(() => {
    const down = e => {
      if (e.code === "Space") spacePressed.current = true;
    };
    const up = e => {
      if (e.code === "Space") spacePressed.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────
  const scene = useMemo(
    () => ({
      dark,
      pan,
      zoom,
      params,
      holes,
      overlaps,
      removedSet,
      perfMode: stats.perfMode,
      holeCount: stats.holeCount,
      holeShape: geometry.holeShape,
      showHud,
      variation,
      variationEditMode,
      selectedVariationLayer,
      fields: drawPreview ? { ...fields, controllers: [...fields.controllers, drawPreview] } : fields,
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
    }),
    [
      dark,
      pan,
      zoom,
      params,
      holes,
      overlaps,
      removedSet,
      stats.perfMode,
      stats.holeCount,
      showHud,
      variation,
      variationEditMode,
      selectedVariationLayer,
      fields,
      drawPreview,
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
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    viewRef.current = drawScene(canvas, scene);
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = containerRef.current.getBoundingClientRect();
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      setPan(p => ({ ...p })); // force a redraw
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [setPan]);

  // ─── Pointer handling ─────────────────────────────────────────────
  const clientToSheet = useCallback((clientX, clientY) => {
    const view = viewRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!view || !rect) return null;
    return canvasToSheet(view, clientX - rect.left, clientY - rect.top);
  }, []);

  // Wheel zoom toward the cursor. Attached natively (non-passive) because React
  // registers onWheel as passive, which makes preventDefault() a no-op.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom(z => {
        const nz = clamp(z * factor, 0.1, 20);
        setPan(p => zoomAbout(p, z, nz, mx, my, rect.width, rect.height));
        return nz;
      });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [setZoom, setPan]);

  const selectedLayerLive = useCallback(() => {
    const v = history.ref.current;
    return v.layers.find(l => l.id === v.selectedLayerId) || v.layers[0];
  }, [history]);

  const showShapeHud = useCallback(
    layer => {
      const usesPosition = gizmoUsesPosition(layer);
      setVariationHud({
        positionLabel: usesPosition ? "Position" : "Phase",
        positionValue: usesPosition ? layer.position : layer.phase,
        exponent: layer.exponent,
      });
    },
    [setVariationHud]
  );

  const geom = useMemo(() => ({ marginLeft, marginTop, perfW, perfH }), [marginLeft, marginTop, perfW, perfH]);

  // Controllers on the channel being edited, nearest handle first. Only the
  // active channel is grabbable — the others are drawn faintly for reference, so
  // a stray click on one must not start dragging it.
  const fieldsLive = useCallback(() => api.ref.current.fields, [api]);
  // A synced controller is measured against the controller it follows, so that
  // is what the canvas draws and what its handles have to address.
  const sourceOf = useCallback(
    (controller, list) => resolveSyncedGeometry(controller, new Map(list.map(c => [c.id, c]))),
    []
  );

  const handlePointerDown = useCallback(
    e => {
      if (e.button !== 0) return;
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      const view = viewRef.current;

      if (pathEditMode && showHud && !spacePressed.current && view) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        const hit = sheet && hitTestPath(pathBlock.paths, sheet.x, sheet.y, view.baseScale);
        if (hit) {
          pathDrag.current = hit;
          if (hit.pathIndex !== selectedPath) actions.selectPath(hit.pathIndex);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }

      if (fieldEditMode && fields.enabled && showHud && !spacePressed.current && view) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (sheet) {
          // The selected controller wins a tie, so its handles stay reachable
          // even where another controller's overlap them.
          const candidates = fields.controllers.filter(c => c.channel === activeChannel);
          const ordered = candidates.slice().sort((a, b) => (a.id === selectedControllerId ? -1 : 0) - (b.id === selectedControllerId ? -1 : 0)); // prettier-ignore
          for (const controller of ordered) {
            const source = sourceOf(controller, fields.controllers);
            const handle = hitTestController(controller, sheet.x, sheet.y, view.baseScale, 14, source);
            if (handle) {
              controllerDrag.current = { id: controller.id, handle };
              // Selecting is UI state, so grabbing an unselected controller's
              // handle costs no undo step of its own.
              if (controller.id !== selectedControllerId) actions.selectController(controller.id);
              e.currentTarget.setPointerCapture(e.pointerId);
              return;
            }
          }
          if (fieldTool === "line" || fieldTool === "curve") {
            drawDrag.current = { kind: fieldTool, from: sheet };
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      if (
        variation.enabled &&
        variationEditMode &&
        showHud &&
        !spacePressed.current &&
        selectedVariationLayer &&
        view
      ) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (sheet) {
          const g = computeGizmo(selectedVariationLayer, geom, 12 / view.baseScale);
          const hit = hitTestGizmo(g, sheet.x, sheet.y, view.baseScale);
          if (hit) {
            variationDrag.current = { handle: hit, startVariation: cloneVariation(history.ref.current) };
            if (hit === "stop" || hit === "curve") showShapeHud(selectedVariationLayer);
            else setVariationHud(null);
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
          }
        }
      }
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [
      pan,
      variation.enabled,
      variationEditMode,
      showHud,
      selectedVariationLayer,
      geom,
      clientToSheet,
      showShapeHud,
      setVariationHud,
      history,
      fieldEditMode,
      fields,
      activeChannel,
      fieldTool,
      actions,
      selectedControllerId,
      sourceOf,
      pathEditMode,
      pathBlock,
      selectedPath,
    ]
  );

  // The two-point drag that draws a line or a curve, as a controller-shaped
  // preview the renderer can draw without knowing anything about drafting.
  const draftFromDrag = useCallback(
    (kind, from, to) => {
      const points =
        kind === "curve"
          ? [
              from,
              { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 - (to.x - from.x) * 0.25 },
              { x: from.x + ((to.x - from.x) * 2) / 3, y: from.y + ((to.y - from.y) * 2) / 3 + (to.x - from.x) * 0.25 },
              to,
            ]
          : [from, to];
      return {
        id: "__draft__",
        channel: activeChannel,
        kind,
        enabled: true,
        geometry: { points },
        target: 0,
        radius: Math.max(1, Math.round(Math.min(geom.perfW, geom.perfH) * 0.25)),
        falloff: "smooth",
        oneSided: 0,
        strength: 1,
        syncWith: null,
        image: null,
      };
    },
    [activeChannel, geom.perfW, geom.perfH]
  );

  const handlePointerMove = useCallback(
    e => {
      if (controllerDrag.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        const { id, handle } = controllerDrag.current;
        const live = fieldsLive().controllers;
        const controller = live.find(c => c.id === id);
        if (!controller) return;
        const patch = moveControllerHandle(
          controller,
          handle,
          sheet.x,
          sheet.y,
          e.shiftKey,
          sourceOf(controller, live)
        );
        if (patch) actions.updateController(id, patch, true);
        return;
      }
      if (pathDrag.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        const { pathIndex, pointIndex } = pathDrag.current;
        const paths = api.ref.current.layout.path.paths;
        if (!paths[pathIndex]?.points[pointIndex]) return;
        actions.setPaths(movePathVertex(paths, pathIndex, pointIndex, sheet.x, sheet.y), true);
        return;
      }
      if (drawDrag.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        setDrawPreview(draftFromDrag(drawDrag.current.kind, drawDrag.current.from, sheet));
        return;
      }
      if (variationDrag.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        const layer = selectedLayerLive();
        if (!layer) return;
        const handle = variationDrag.current.handle;
        const shift = e.shiftKey;
        let patch;
        if (handle === "center") patch = gizmoPatchForCenter(sheet.x, sheet.y, geom, shift);
        else if (handle === "reach")
          patch = gizmoPatchForReach(sheet.x, sheet.y, layer, geom, layer.space === "Angular", shift);
        else if (handle === "stop") patch = gizmoPatchForStop(sheet.x, sheet.y, layer, geom, shift);
        else patch = gizmoPatchForCurve(sheet.x, sheet.y, layer, geom, shift);
        history.live(current => ({
          ...current,
          layers: current.layers.map(l => (l.id === current.selectedLayerId ? { ...l, ...patch } : l)),
        }));
        if (handle === "stop" || handle === "curve") showShapeHud({ ...layer, ...patch });
        return;
      }
      if (!isPanning) return;
      setPan({
        x: panOrigin.current.x + (e.clientX - panStart.current.x),
        y: panOrigin.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning, history, clientToSheet, selectedLayerLive, geom, showShapeHud, setPan, actions, api, fieldsLive, draftFromDrag, sourceOf] // prettier-ignore
  );

  const handlePointerUp = useCallback(
    e => {
      if (controllerDrag.current) {
        controllerDrag.current = null;
        api.closeGroup(); // the whole drag is one undo step
        pointerDownPos.current = null;
        return;
      }
      if (pathDrag.current) {
        pathDrag.current = null;
        api.closeGroup(); // the whole drag is one undo step
        pointerDownPos.current = null;
        return;
      }
      if (drawDrag.current) {
        const { kind, from } = drawDrag.current;
        drawDrag.current = null;
        setDrawPreview(null);
        const sheet = clientToSheet(e.clientX, e.clientY);
        // Too short to be a deliberate stroke → treat it as a click, which the
        // branch below turns into a point (or a selection).
        if (sheet && Math.hypot(sheet.x - from.x, sheet.y - from.y) >= MIN_DRAW_MM) {
          actions.addController(kind, draftFromDrag(kind, from, sheet).geometry);
          pointerDownPos.current = null;
          return;
        }
      }
      if (variationDrag.current) {
        const { startVariation } = variationDrag.current;
        variationDrag.current = null;
        history.endDrag(startVariation);
        window.setTimeout(() => setVariationHud(null), 650);
        pointerDownPos.current = null;
        return;
      }
      setIsPanning(false);
      const wasClick =
        pointerDownPos.current &&
        Math.abs(e.clientX - pointerDownPos.current.x) < CLICK_SLOP &&
        Math.abs(e.clientY - pointerDownPos.current.y) < CLICK_SLOP;

      // A click on the canvas while editing fields either drops a new
      // controller (a tool is armed) or picks the one under the cursor.
      if (fieldEditMode && fields.enabled && showHud && wasClick && !spacePressed.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (sheet) {
          if (fieldTool === "point" || fieldTool === "line" || fieldTool === "curve") {
            actions.addController("point", { points: [{ x: sheet.x, y: sheet.y }] });
            pointerDownPos.current = null;
            return;
          }
          const view = viewRef.current;
          let closest = null,
            closestDist = Infinity;
          for (const controller of fields.controllers) {
            if (controller.channel !== activeChannel) continue;
            const d = controllerBodyDistance(controller, sheet.x, sheet.y, sourceOf(controller, fields.controllers));
            if (d < closestDist) {
              closestDist = d;
              closest = controller;
            }
          }
          // Same tolerance as a handle hit: within ~14 screen pixels of the body.
          if (closest && closestDist * (view?.baseScale || 1) < 14 && closest.id !== selectedControllerId) {
            actions.selectController(closest.id);
            pointerDownPos.current = null;
            return;
          }
        }
      }

      // A click on another curve while editing paths selects it, the same way a
      // click on another controller selects that.
      if (pathEditMode && showHud && wasClick && !spacePressed.current && pathBlock.paths.length > 1) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        const view = viewRef.current;
        if (sheet) {
          let closest = -1,
            closestDist = Infinity;
          pathBlock.paths.forEach((path, index) => {
            const d = pathBodyDistance(path, sheet.x, sheet.y, pathBlock.smooth !== false);
            if (d < closestDist) {
              closestDist = d;
              closest = index;
            }
          });
          if (closest >= 0 && closestDist * (view?.baseScale || 1) < 14 && closest !== selectedPath) {
            actions.selectPath(closest);
            pointerDownPos.current = null;
            return;
          }
        }
      }

      // A click (not a drag) in removal mode toggles the nearest hole.
      if (holeRemovalMode && wasClick) {
        {
          const sheet = clientToSheet(e.clientX, e.clientY);
          if (sheet) {
            let closestIdx = -1,
              closestDist = Infinity;
            holes.forEach((h, i) => {
              if (h.culled) return; // already gone from the pattern
              const d = Math.hypot(h.x - sheet.x, h.y - sheet.y);
              const hitRadius = Math.max(1.5, Math.max(h.w, h.h) * 0.75);
              if (d < hitRadius && d < closestDist) {
                closestDist = d;
                closestIdx = i;
              }
            });
            if (closestIdx >= 0) actions.toggleRemovedHole(closestIdx);
          }
        }
      }
      pointerDownPos.current = null;
    },
    [
      holeRemovalMode,
      holes,
      history,
      clientToSheet,
      actions,
      setVariationHud,
      api,
      draftFromDrag,
      fieldEditMode,
      fields,
      showHud,
      fieldTool,
      activeChannel,
      selectedControllerId,
      sourceOf,
      pathEditMode,
      pathBlock,
      selectedPath,
    ]
  );

  // Escape puts the drawing tool away without leaving edit mode.
  useEffect(() => {
    if (!fieldTool) return;
    const onKey = e => {
      if (e.key === "Escape") setFieldTool(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fieldTool, setFieldTool]);

  // Every field handler below also requires showHud, so the cursor has to as
  // well — otherwise hiding the overlay leaves a crosshair over a canvas where
  // clicks only pan, with no rail, no controllers drawn and no badge.
  const fieldActive = fieldEditMode && fields.enabled && showHud;
  const pathActive = pathEditMode && showHud;
  const cursor =
    (variation.enabled && variationEditMode) || fieldActive || pathActive
      ? "crosshair"
      : isPanning
        ? "grabbing"
        : holeRemovalMode
          ? "crosshair"
          : "grab";

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        order: 2,
        borderRadius: 16,
        boxShadow: theme.floatShadow,
        background: theme.canvasBg,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor, touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {showHud && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          <StatsHud />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stats.hasOverlap && (
              <Badge color={theme.warn}>
                <TriangleAlert size={10} /> Holes overlap
              </Badge>
            )}
            {taperActive && stats.hasClosedHoles && (
              <Badge color={theme.warn}>
                <TriangleAlert size={10} /> {stats.closedHoleCount}/{stats.activeHoleCount} holes closed
              </Badge>
            )}
            {holeRemovalMode && (
              <Badge color={dark ? "#7c3aed" : "#6d28d9"}>
                HOLE REMOVAL MODE{stats.removedHoleCount > 0 ? ` (${stats.removedHoleCount} removed)` : ""}
              </Badge>
            )}
            {variation.enabled && variationEditMode && (
              <Badge color={dark ? "#2563eb" : "#1d4ed8"}>EDIT VARIATION · SPACE TO PAN</Badge>
            )}
            {pathActive && (
              <Badge color={dark ? "#ea580c" : "#c2410c"}>
                EDIT PATH{pathBlock.paths.length > 1 ? ` ${selectedPath + 1}/${pathBlock.paths.length}` : ""} · SPACE TO
                PAN
              </Badge>
            )}
            {fieldActive && (
              <Badge color={dark ? "#4f46e5" : "#4338ca"}>
                {fieldTool
                  ? `${fieldTool === "point" ? "CLICK" : "DRAG"} TO PLACE ${fieldTool.toUpperCase()} · ESC TO STOP`
                  : `${activeChannel.toUpperCase()} FIELD · SPACE TO PAN`}
              </Badge>
            )}
          </div>
        </div>
      )}
      {showHud && fieldActive && <ToolRail />}
      {showHud && ui.variationHud && <VariationHud />}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        color: "#fff",
        background: color,
        padding: "3px 8px",
        borderRadius: 4,
        fontFamily: MONO,
      }}
    >
      {children}
    </span>
  );
}
