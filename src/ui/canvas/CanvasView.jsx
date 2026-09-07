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
import { isPointInsideHole } from "../../geometry/shapes.js";
import { resolveSyncedGeometry } from "../../fields/controllers.js";
import { controllerBodyDistance, hitTestController, moveControllerHandle } from "../../fields/controller-gizmo.js";
import { hitTestPath, movePathVertex, pathBodyDistance } from "../../layouts/path-gizmo.js";
import { cutoutBodyDistance, hitTestBoundary, moveBoundaryHandle, translateCutout } from "../../geometry/boundary-gizmo.js"; // prettier-ignore
import { lockDelta } from "../../geometry/snap.js";
import { drawScene } from "../../render/canvas-renderer.js";
import { canvasToSheet, zoomAbout } from "../../render/view.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO, modeColor } from "../theme.js";
import { StatusBar, VariationHud } from "./Hud.jsx";
import { ToolRail } from "./ToolRail.jsx";

// A pointer that never travelled this far (in screen pixels) was a click.
const CLICK_SLOP = 5;
// Below this a canvas drag reads as a click, so a line or curve drawn by
// accident does not collapse into a zero-length one that cannot be grabbed.
const MIN_DRAW_MM = 2;
// How close (screen px) a pointer has to be to a handle, or to a body, to take it.
const HIT_PX = 14;
const lockedDelta = (dx, dy, shift) => (shift ? lockDelta(dx, dy) : { dx, dy });

// The floating canvas card: draws the scene, and owns pan/zoom, hole-removal
// clicks and every on-canvas drag — gizmo handles, controller and curve bodies,
// the drawing tools and the pen.
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
  const { dark, showHud, mode, holeRemovalMode, variationEditMode, pan, setPan, zoom, setZoom, setVariationHud } = ui;
  const { fieldEditMode, activeChannel, fieldTool, selectedControllerId, pathTool, penStart } = ui;
  const { pathEditMode, selectedPath, boundaryEditMode, selectedCutoutId } = ui;
  const pathBlock = doc.layout.path;
  const boundary = doc.boundary;
  const { variation, fields } = doc;
  const { holeColor, bgColor } = doc.appearance;
  const { perfX: marginLeft, perfY: marginTop, perfW, perfH, taperActive } = geometry;

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const viewRef = useRef(null); // last view transform returned by drawScene
  const [isPanning, setIsPanning] = useState(false);
  const [hover, setHover] = useState(null); // "handle" | "body" | null, for the cursor
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const pointerDownPos = useRef(null);
  const variationDrag = useRef(null);
  const controllerDrag = useRef(null); // { id, handle } while a handle is held
  const bodyDrag = useRef(null); // { kind, id | index, start, applied, moved } while a body is held
  const pathDrag = useRef(null); // { pathIndex, pointIndex } while a path vertex is held
  const boundaryDrag = useRef(null); // a boundary handle while it is held
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
      penStart,
      trim: doc.boundary.trim,
      boundary,
      boundaryEditMode,
      selectedCutoutId,
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
      penStart,
      doc.boundary.trim,
      boundary,
      boundaryEditMode,
      selectedCutoutId,
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

  // Every field handler below requires showHud, so the cursor and the hit tests
  // have to as well — otherwise hiding the overlay leaves a crosshair over a
  // canvas where clicks only pan, with no rail, no controllers and no badge.
  const fieldActive = fieldEditMode && fields.enabled && showHud;
  const pathActive = pathEditMode && showHud;
  const boundaryActive = boundaryEditMode && showHud;
  const variationActive = variation.enabled && variationEditMode && showHud && !!selectedVariationLayer;

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
  // The selected controller wins a tie, so its handles stay reachable even
  // where another controller's overlap them.
  const orderedControllers = useCallback(() => {
    const candidates = fields.controllers.filter(c => c.channel === activeChannel);
    return candidates.slice().sort((a, b) => (a.id === selectedControllerId ? -1 : 0) - (b.id === selectedControllerId ? -1 : 0)); // prettier-ignore
  }, [fields.controllers, activeChannel, selectedControllerId]);

  // What is under a sheet point, in the current mode: a handle, a body, or
  // nothing. One function answers both the pointer-down and the hover cursor,
  // so the cursor can never promise a grab the press does not deliver.
  const probe = useCallback(
    (sheet, view) => {
      const px = HIT_PX / view.baseScale;
      if (boundaryActive) {
        const hit = hitTestBoundary(boundary, sheet.x, sheet.y, view.baseScale, HIT_PX);
        if (hit) return { kind: "boundary", handle: hit };
        for (const cutout of boundary.cutouts) {
          if (cutoutBodyDistance(cutout, sheet.x, sheet.y) <= px) return { kind: "cutout", id: cutout.id };
        }
        return null;
      }
      if (pathActive) {
        const hit = hitTestPath(pathBlock.paths, sheet.x, sheet.y, view.baseScale, HIT_PX);
        if (hit) return { kind: "pathVertex", ...hit };
        if (pathTool) return null; // the pen ignores bodies: every click is a vertex
        let closest = -1,
          closestDist = Infinity;
        pathBlock.paths.forEach((path, index) => {
          const d = pathBodyDistance(path, sheet.x, sheet.y, pathBlock.smooth !== false);
          if (d < closestDist) {
            closestDist = d;
            closest = index;
          }
        });
        if (closest >= 0 && closestDist <= px) return { kind: "pathBody", index: closest };
        return null;
      }
      if (fieldActive) {
        const list = fields.controllers;
        for (const controller of orderedControllers()) {
          const source = sourceOf(controller, list);
          const handle = hitTestController(controller, sheet.x, sheet.y, view.baseScale, HIT_PX, source);
          if (handle) return { kind: "controllerHandle", id: controller.id, handle };
        }
        if (fieldTool) return null; // an armed tool draws on empty ground and on bodies alike
        let closest = null,
          closestDist = Infinity;
        for (const controller of list) {
          if (controller.channel !== activeChannel) continue;
          const d = controllerBodyDistance(controller, sheet.x, sheet.y, sourceOf(controller, list));
          if (d < closestDist) {
            closestDist = d;
            closest = controller;
          }
        }
        if (closest && closestDist <= px) return { kind: "controllerBody", id: closest.id };
        return null;
      }
      if (variationActive) {
        const g = computeGizmo(selectedVariationLayer, geom, 12 / view.baseScale);
        const hit = hitTestGizmo(g, sheet.x, sheet.y, view.baseScale);
        if (hit) return { kind: "gizmo", handle: hit };
      }
      return null;
    },
    [boundaryActive, boundary, pathActive, pathBlock, pathTool, fieldActive, fields.controllers, orderedControllers, sourceOf, fieldTool, activeChannel, variationActive, selectedVariationLayer, geom] // prettier-ignore
  );

  const handlePointerDown = useCallback(
    e => {
      if (e.button !== 0) return;
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
      const view = viewRef.current;
      const sheet = view && !spacePressed.current ? clientToSheet(e.clientX, e.clientY) : null;
      const hit = sheet ? probe(sheet, view) : null;

      if (hit?.kind === "boundary") {
        boundaryDrag.current = hit.handle;
        if (hit.handle.cutout !== undefined && hit.handle.cutout !== selectedCutoutId) actions.selectCutout(hit.handle.cutout); // prettier-ignore
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (hit?.kind === "pathVertex") {
        pathDrag.current = { pathIndex: hit.pathIndex, pointIndex: hit.pointIndex };
        if (hit.pathIndex !== selectedPath) actions.selectPath(hit.pathIndex);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (hit?.kind === "controllerHandle") {
        controllerDrag.current = { id: hit.id, handle: hit.handle };
        // Selecting is UI state, so grabbing an unselected controller's handle
        // costs no undo step of its own.
        if (hit.id !== selectedControllerId) actions.selectController(hit.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      // A body: a click selects it, a drag moves the whole thing. Which of the
      // two it is only becomes clear once the pointer has travelled, so the
      // press just remembers where it started.
      if (hit?.kind === "controllerBody" || hit?.kind === "pathBody" || hit?.kind === "cutout") {
        bodyDrag.current = { ...hit, start: sheet, applied: { dx: 0, dy: 0 }, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (hit?.kind === "gizmo") {
        variationDrag.current = { handle: hit.handle, startVariation: cloneVariation(history.ref.current) };
        if (hit.handle === "stop" || hit.handle === "curve") showShapeHud(selectedVariationLayer);
        else setVariationHud(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (sheet && fieldActive && (fieldTool === "line" || fieldTool === "curve")) {
        drawDrag.current = { kind: fieldTool, from: sheet };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pan, probe, clientToSheet, showShapeHud, setVariationHud, history, selectedVariationLayer, fieldActive, fieldTool, actions, selectedControllerId, selectedPath, selectedCutoutId] // prettier-ignore
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
        const patch = moveControllerHandle(controller, handle, sheet.x, sheet.y, e.shiftKey, sourceOf(controller, live)); // prettier-ignore
        if (patch) actions.updateController(id, patch, true);
        return;
      }
      if (bodyDrag.current) {
        const drag = bodyDrag.current;
        if (!drag.moved) {
          const start = pointerDownPos.current;
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < CLICK_SLOP) return;
          drag.moved = true;
        }
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        // The move is measured from where the drag STARTED and applied as the
        // difference from what has been applied so far, so Shift's axis lock
        // holds over the whole gesture rather than per pointer event.
        const total = lockedDelta(sheet.x - drag.start.x, sheet.y - drag.start.y, e.shiftKey);
        const dx = total.dx - drag.applied.dx,
          dy = total.dy - drag.applied.dy;
        drag.applied = total;
        if (drag.kind === "controllerBody") actions.moveController(drag.id, dx, dy, false);
        else if (drag.kind === "pathBody") actions.movePath(drag.index, dx, dy, false);
        else if (drag.kind === "cutout") {
          const cutout = api.ref.current.boundary.cutouts.find(c => c.id === drag.id);
          if (cutout) {
            const { x, y, points } = translateCutout(cutout, dx, dy);
            actions.updateCutout(drag.id, cutout.shape === "Polygon" ? { points } : { x, y }, true);
          }
        }
        return;
      }
      if (boundaryDrag.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        const patch = moveBoundaryHandle(api.ref.current.boundary, boundaryDrag.current, sheet.x, sheet.y, e.shiftKey);
        if (patch) actions.patchBoundary(patch, true);
        return;
      }
      if (pathDrag.current) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (!sheet) return;
        const { pathIndex, pointIndex } = pathDrag.current;
        const paths = api.ref.current.layout.path.paths;
        if (!paths[pathIndex]?.points[pointIndex]) return;
        actions.setPaths(movePathVertex(paths, pathIndex, pointIndex, sheet.x, sheet.y, e.shiftKey), true);
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
      if (isPanning) {
        setPan({
          x: panOrigin.current.x + (e.clientX - panStart.current.x),
          y: panOrigin.current.y + (e.clientY - panStart.current.y),
        });
        return;
      }
      // Nothing held: say what a press here would take, through the cursor.
      const view = viewRef.current;
      if (!view || spacePressed.current) {
        if (hover) setHover(null);
        return;
      }
      const sheet = clientToSheet(e.clientX, e.clientY);
      const hit = sheet ? probe(sheet, view) : null;
      const next = !hit
        ? null
        : hit.kind === "controllerBody" || hit.kind === "pathBody" || hit.kind === "cutout"
          ? "body"
          : "handle";
      if (next !== hover) setHover(next);
    },
    [isPanning, hover, probe, history, clientToSheet, selectedLayerLive, geom, showShapeHud, setPan, actions, api, fieldsLive, draftFromDrag, sourceOf] // prettier-ignore
  );

  const handlePointerUp = useCallback(
    e => {
      if (controllerDrag.current) {
        controllerDrag.current = null;
        api.closeGroup(); // the whole drag is one undo step
        pointerDownPos.current = null;
        return;
      }
      if (bodyDrag.current) {
        const drag = bodyDrag.current;
        bodyDrag.current = null;
        pointerDownPos.current = null;
        if (drag.moved) {
          api.closeGroup();
          return;
        }
        // Never moved: it was a click, and a click on a body selects it.
        if (drag.kind === "controllerBody" && drag.id !== selectedControllerId) actions.selectController(drag.id);
        else if (drag.kind === "pathBody" && drag.index !== selectedPath) actions.selectPath(drag.index);
        else if (drag.kind === "cutout" && drag.id !== selectedCutoutId) actions.selectCutout(drag.id);
        return;
      }
      if (pathDrag.current) {
        pathDrag.current = null;
        api.closeGroup(); // the whole drag is one undo step
        pointerDownPos.current = null;
        return;
      }
      if (boundaryDrag.current) {
        boundaryDrag.current = null;
        api.closeGroup();
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
      pointerDownPos.current = null;
      if (!wasClick || spacePressed.current) return;
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (!sheet) return;

      // A click on empty canvas while editing fields drops a new controller
      // when a tool is armed.
      if (fieldActive && (fieldTool === "point" || fieldTool === "line" || fieldTool === "curve")) {
        actions.addController("point", { points: [{ x: sheet.x, y: sheet.y }] });
        return;
      }
      // The pen: every click in Path mode is a vertex.
      if (pathActive && pathTool === "pen") {
        actions.penClick(sheet.x, sheet.y, e.shiftKey);
        return;
      }
      // A click (not a drag) in removal mode toggles the nearest hole.
      if (holeRemovalMode) {
        let insideIdx = -1,
          nearestIdx = -1,
          nearestDist = Infinity;
        holes.forEach((h, i) => {
          if (h.culled) return; // already gone from the pattern
          // Landing inside the hole picks it, whatever shape it is. For a Flow
          // Lines slot that is the ONLY meaningful test — its origin is the
          // middle of a line that may run the width of the panel, so the
          // fallback below would pick whichever line's middle happened to be
          // nearest rather than the one under the cursor.
          if (insideIdx < 0 && isPointInsideHole(sheet.x, sheet.y, h, geometry.holeShape)) insideIdx = i;
          if (h.stroke) return;
          // Otherwise the nearest hole within reach, so a click that just
          // misses a small hole still removes it.
          const d = Math.hypot(h.x - sheet.x, h.y - sheet.y);
          const hitRadius = Math.max(1.5, Math.max(h.w, h.h) * 0.75);
          if (d < hitRadius && d < nearestDist) {
            nearestDist = d;
            nearestIdx = i;
          }
        });
        const picked = insideIdx >= 0 ? insideIdx : nearestIdx;
        if (picked >= 0) actions.toggleRemovedHole(picked);
      }
    },
    [holeRemovalMode, holes, geometry.holeShape, history, clientToSheet, actions, setVariationHud, api, draftFromDrag, fieldActive, fieldTool, pathActive, pathTool, selectedControllerId, selectedPath, selectedCutoutId] // prettier-ignore
  );

  // A double-click: on a vertex, takes it away; on an edge or a curve, puts one
  // there. The same idiom for the boundary, the Path curves and a polyline
  // controller, with the same tolerance as a handle hit.
  const handleDoubleClick = useCallback(
    e => {
      if (!showHud || spacePressed.current) return;
      const view = viewRef.current;
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (!view || !sheet) return;
      const tolerance = HIT_PX / view.baseScale;
      if (boundaryActive) {
        const hit = hitTestBoundary(boundary, sheet.x, sheet.y, view.baseScale, HIT_PX);
        if (hit?.role === "vertex") actions.removeBoundaryVertexAt(hit);
        else actions.addBoundaryVertexAt(sheet.x, sheet.y, tolerance);
        return;
      }
      if (pathActive && !pathTool) {
        const hit = hitTestPath(pathBlock.paths, sheet.x, sheet.y, view.baseScale, HIT_PX);
        if (hit) actions.removePathVertexAtIndex(hit.pathIndex, hit.pointIndex);
        else actions.insertPathVertexAtPoint(selectedPath, sheet.x, sheet.y, tolerance);
        return;
      }
      if (fieldActive && !fieldTool) {
        for (const controller of orderedControllers()) {
          if (controller.kind !== "polyline" || controller.syncWith) continue;
          const handle = hitTestController(controller, sheet.x, sheet.y, view.baseScale, HIT_PX);
          const vertex = /^p(\d+)$/.exec(handle || "");
          if (vertex) {
            actions.removeControllerVertexAt(controller.id, Number(vertex[1]));
            return;
          }
          if (controllerBodyDistance(controller, sheet.x, sheet.y) <= tolerance) {
            actions.insertControllerVertexAt(controller.id, sheet.x, sheet.y, tolerance);
            return;
          }
        }
      }
    },
    [showHud, boundaryActive, boundary, pathActive, pathTool, pathBlock, selectedPath, fieldActive, fieldTool, orderedControllers, clientToSheet, actions] // prettier-ignore
  );

  const editing = variationActive || fieldActive || pathActive || boundaryActive;
  const cursor = isPanning
    ? "grabbing"
    : hover === "handle"
      ? "pointer"
      : hover === "body"
        ? "move"
        : pathActive && pathTool
          ? "crosshair"
          : fieldActive && fieldTool
            ? "crosshair"
            : editing || holeRemovalMode
              ? "crosshair"
              : "grab";

  const modeBadge = (() => {
    if (holeRemovalMode)
      return ["remove", `HOLE REMOVAL MODE${stats.removedHoleCount > 0 ? ` (${stats.removedHoleCount} removed)` : ""}`, "click a hole to remove or restore it"]; // prettier-ignore
    if (variationActive) return ["variation", "EDIT VARIATION", "drag the handles · Shift snaps · Space to pan"];
    if (pathActive)
      return [
        "path",
        `EDIT PATH${pathBlock.paths.length > 1 ? ` ${selectedPath + 1}/${pathBlock.paths.length}` : ""}`,
        pathTool === "pen"
          ? "pen: click to add a vertex · Shift locks 45° · Esc to put it away"
          : "drag a vertex or the curve · double-click to add or drop a vertex · Space to pan",
      ];
    if (boundaryActive)
      return ["boundary", "EDIT BOUNDARY", "drag a vertex or a cutout · double-click an edge to add a vertex, a vertex to drop it · Space to pan"]; // prettier-ignore
    if (fieldActive)
      return fieldTool
        ? ["fields", `${fieldTool === "point" ? "CLICK" : "DRAG"} TO PLACE ${fieldTool.toUpperCase()}`, "Esc to stop"]
        : ["fields", `${activeChannel.toUpperCase()} FIELD`, "drag a controller or its handles · Shift locks 45° · Delete removes it · Space to pan"]; // prettier-ignore
    return null;
  })();

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        boxShadow: theme.floatShadow,
        background: theme.canvasBg,
        minWidth: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor, touchAction: "none", display: "block" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => hover && setHover(null)}
        onDoubleClick={handleDoubleClick}
      />
      {showHud && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            pointerEvents: "none",
          }}
        >
          {modeBadge && (
            <Badge key={modeBadge[1]} color={modeColor(theme, modeBadge[0])} dark={dark} hint={modeBadge[2]}>
              {modeBadge[1]}
            </Badge>
          )}
          {stats.hasOverlap && (
            <Badge color={theme.warn} dark={dark}>
              <TriangleAlert size={10} /> Holes overlap
            </Badge>
          )}
          {taperActive && stats.hasClosedHoles && (
            <Badge color={theme.warn} dark={dark}>
              <TriangleAlert size={10} /> {stats.closedHoleCount}/{stats.activeHoleCount} holes closed
            </Badge>
          )}
        </div>
      )}
      {showHud && mode !== "select" && mode !== "variation" && <ToolRail />}
      {showHud && ui.variationHud && <VariationHud />}
      <StatusBar />
    </div>
  );
}

// The mode badge: the mode's name in its colour, and — quieter — what the
// pointer does in it. One glance says which mode the canvas is in and how to
// use it; the tests read the name.
function Badge({ color, dark, hint, children }) {
  return (
    <span
      className="pg-fade-in"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        color: dark ? "#f4f4f5" : "#fff",
        background: color,
        padding: "4px 9px",
        borderRadius: 6,
        fontFamily: MONO,
        fontWeight: 600,
        letterSpacing: 0.3,
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{children}</span>
      {hint && <span style={{ fontWeight: 400, opacity: 0.85, letterSpacing: 0 }}>· {hint}</span>}
    </span>
  );
}
