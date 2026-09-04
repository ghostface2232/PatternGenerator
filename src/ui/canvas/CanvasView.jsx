import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { clamp } from "../../core/math.js";
import { cloneVariation } from "../../core/document.js";
import {
  computeGizmo, gizmoPatchForCenter, gizmoPatchForCurve, gizmoPatchForReach, gizmoPatchForStop,
  gizmoUsesPosition, hitTestGizmo,
} from "../../fields/gizmo.js";
import { drawScene } from "../../render/canvas-renderer.js";
import { canvasToSheet, zoomAbout } from "../../render/view.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";
import { StatsHud, VariationHud } from "./Hud.jsx";

// The floating canvas card: draws the scene, and owns pan/zoom, hole-removal
// clicks and variation-gizmo drags.
export function CanvasView() {
  const { doc, theme, ui, params, geometry, holes, removedSet, overlaps, stats, history, selectedVariationLayer, actions } = useEditor();
  const { dark, showHud, holeRemovalMode, variationEditMode, pan, setPan, zoom, setZoom, setVariationHud } = ui;
  const { variation } = doc;
  const { holeColor, bgColor } = doc.appearance;
  const { marginLeft, marginTop } = params;
  const { perfW, perfH, taperActive } = geometry;

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const viewRef = useRef(null);          // last view transform returned by drawScene
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const pointerDownPos = useRef(null);
  const variationDrag = useRef(null);
  const spacePressed = useRef(false);

  useEffect(() => {
    const down = e => { if (e.code === "Space") spacePressed.current = true; };
    const up = e => { if (e.code === "Space") spacePressed.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────
  const scene = useMemo(() => ({
    dark, pan, zoom, params, holes, overlaps, removedSet, perfMode: stats.perfMode, holeCount: stats.holeCount,
    holeShape: doc.hole.shape, showHud, variation, variationEditMode, selectedVariationLayer, taperActive,
    holeColor, bgColor, geometry,
  }), [dark, pan, zoom, params, holes, overlaps, removedSet, stats.perfMode, stats.holeCount, doc.hole.shape, showHud, variation, variationEditMode, selectedVariationLayer, taperActive, holeColor, bgColor, geometry]);

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
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
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

  const showShapeHud = useCallback(layer => {
    const usesPosition = gizmoUsesPosition(layer);
    setVariationHud({
      positionLabel: usesPosition ? "Position" : "Phase",
      positionValue: usesPosition ? layer.position : layer.phase,
      exponent: layer.exponent,
    });
  }, [setVariationHud]);

  const geom = useMemo(() => ({ marginLeft, marginTop, perfW, perfH }), [marginLeft, marginTop, perfW, perfH]);

  const handlePointerDown = useCallback(e => {
    if (e.button !== 0) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    const view = viewRef.current;
    if (variation.enabled && variationEditMode && showHud && !spacePressed.current && selectedVariationLayer && view) {
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (sheet) {
        const g = computeGizmo(selectedVariationLayer, geom, 12 / view.baseScale);
        const hit = hitTestGizmo(g, sheet.x, sheet.y, view.baseScale);
        if (hit) {
          variationDrag.current = { handle: hit, startVariation: cloneVariation(history.ref.current) };
          if (hit === "stop" || hit === "curve") showShapeHud(selectedVariationLayer); else setVariationHud(null);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan, variation.enabled, variationEditMode, showHud, selectedVariationLayer, geom, clientToSheet, showShapeHud, setVariationHud, history]);

  const handlePointerMove = useCallback(e => {
    if (variationDrag.current) {
      const sheet = clientToSheet(e.clientX, e.clientY);
      if (!sheet) return;
      const layer = selectedLayerLive();
      if (!layer) return;
      const handle = variationDrag.current.handle;
      const shift = e.shiftKey;
      let patch;
      if (handle === "center") patch = gizmoPatchForCenter(sheet.x, sheet.y, geom, shift);
      else if (handle === "reach") patch = gizmoPatchForReach(sheet.x, sheet.y, layer, geom, layer.space === "Angular", shift);
      else if (handle === "stop") patch = gizmoPatchForStop(sheet.x, sheet.y, layer, geom, shift);
      else patch = gizmoPatchForCurve(sheet.x, sheet.y, layer, geom, shift);
      history.live(current => ({
        ...current,
        layers: current.layers.map(l => l.id === current.selectedLayerId ? { ...l, ...patch } : l),
      }));
      if (handle === "stop" || handle === "curve") showShapeHud({ ...layer, ...patch });
      return;
    }
    if (!isPanning) return;
    setPan({ x: panOrigin.current.x + (e.clientX - panStart.current.x), y: panOrigin.current.y + (e.clientY - panStart.current.y) });
  }, [isPanning, history, clientToSheet, selectedLayerLive, geom, showShapeHud, setPan]);

  const handlePointerUp = useCallback(e => {
    if (variationDrag.current) {
      const { startVariation } = variationDrag.current;
      variationDrag.current = null;
      history.recordDragFrom(startVariation);
      window.setTimeout(() => setVariationHud(null), 650);
      pointerDownPos.current = null;
      return;
    }
    setIsPanning(false);
    // A click (not a drag) in removal mode toggles the nearest hole.
    if (holeRemovalMode && pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const sheet = clientToSheet(e.clientX, e.clientY);
        if (sheet) {
          let closestIdx = -1, closestDist = Infinity;
          holes.forEach((h, i) => {
            if (h.culled) return; // already gone from the pattern
            const d = Math.hypot(h.x - sheet.x, h.y - sheet.y);
            const hitRadius = Math.max(1.5, Math.max(h.w, h.h) * 0.75);
            if (d < hitRadius && d < closestDist) { closestDist = d; closestIdx = i; }
          });
          if (closestIdx >= 0) actions.toggleRemovedHole(closestIdx);
        }
      }
    }
    pointerDownPos.current = null;
  }, [holeRemovalMode, holes, history, clientToSheet, actions, setVariationHud]);

  const cursor = variation.enabled && variationEditMode ? "crosshair" : isPanning ? "grabbing" : holeRemovalMode ? "crosshair" : "grab";

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", order: 2, borderRadius: 16, boxShadow: theme.floatShadow, background: theme.canvasBg }}>
      <canvas ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor, touchAction: "none" }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      />
      {showHud && (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          <StatsHud />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stats.hasOverlap && <Badge color={theme.warn}><TriangleAlert size={10} /> Holes overlap</Badge>}
            {taperActive && stats.hasClosedHoles && <Badge color={theme.warn}><TriangleAlert size={10} /> {stats.closedHoleCount}/{stats.activeHoleCount} holes closed</Badge>}
            {holeRemovalMode && <Badge color={dark ? "#7c3aed" : "#6d28d9"}>HOLE REMOVAL MODE{removedSet.size > 0 ? ` (${removedSet.size} removed)` : ""}</Badge>}
            {variation.enabled && variationEditMode && <Badge color={dark ? "#2563eb" : "#1d4ed8"}>EDIT VARIATION · SPACE TO PAN</Badge>}
          </div>
        </div>
      )}
      {showHud && ui.variationHud && <VariationHud />}
    </div>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#fff", background: color, padding: "3px 8px", borderRadius: 4, fontFamily: MONO }}>
      {children}
    </span>
  );
}
