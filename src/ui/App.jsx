import { useCallback, useEffect, useMemo, useState } from "react";
import { CUSTOM_SIZE_SHAPES, DIN_PRESETS } from "../core/constants.js";
import { buildParams, computeStats, decorateHoles, deriveGeometry, filterActive } from "../core/pipeline.js";
import { generateHoles } from "../layouts/grid.js";
import { findOverlaps } from "../geometry/ligament.js";
import { VARIATION_PRESETS, createVariationLayer, randomizeVariationLayer } from "../fields/variation-engine.js";
import { generateSVGString } from "../export/svg.js";
import { renderPNGBlob } from "../export/png.js";
import { downloadBlob, downloadText } from "../export/download.js";
import { getTheme, MONO } from "./theme.js";
import { useDocument } from "./useDocument.js";
import { useVariationHistory } from "./useVariationHistory.js";
import { EditorContext } from "./EditorContext.jsx";
import { GlobalStyles } from "./GlobalStyles.jsx";
import { TopBar } from "./TopBar.jsx";
import { CanvasView } from "./canvas/CanvasView.jsx";
import { Sidebar } from "./Sidebar.jsx";

export default function App() {
  const [doc, api] = useDocument();

  // ─── UI-only state (never saved with the document) ─────────────────
  const [dark, setDark] = useState(true);
  const [showHud, setShowHud] = useState(true); // one switch for every on-canvas overlay
  const [holeRemovalMode, setHoleRemovalMode] = useState(false);
  const [variationEditMode, setVariationEditMode] = useState(false);
  const [variationAdvanced, setVariationAdvanced] = useState(false);
  const [variationHud, setVariationHud] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const theme = useMemo(() => getTheme(dark), [dark]);

  // ─── Derived pipeline (memoised step by step) ──────────────────────
  // setIn() shares untouched branches, so keying memos on the sub-objects means
  // e.g. a colour or removed-hole edit never regenerates the pattern.
  const { hole, layout, sheet, boundary, taper, variation } = doc;
  const patternDoc = useMemo(() => ({ hole, layout, sheet, boundary, taper }), [hole, layout, sheet, boundary, taper]);
  const geometry = useMemo(() => deriveGeometry(patternDoc), [patternDoc]);
  const params = useMemo(() => buildParams(patternDoc, geometry), [patternDoc, geometry]);
  const baseHoles = useMemo(() => generateHoles(params), [params]);
  const holeDoc = useMemo(() => ({ ...patternDoc, variation }), [patternDoc, variation]);
  const holes = useMemo(() => decorateHoles(baseHoles, holeDoc, geometry), [baseHoles, holeDoc, geometry]);
  const removedSet = useMemo(() => new Set(doc.removedHoles), [doc.removedHoles]);
  const activeHoles = useMemo(() => filterActive(holes, removedSet), [holes, removedSet]);
  const overlaps = useMemo(() => findOverlaps(activeHoles, hole.shape), [activeHoles, hole.shape]);
  const stats = useMemo(
    () => computeStats({ doc: holeDoc, g: geometry, params, holes, activeHoles, removedSet, overlaps }),
    [holeDoc, geometry, params, holes, activeHoles, removedSet, overlaps]
  );

  // Hole indices are only meaningful for the pattern they were generated from.
  useEffect(() => {
    if (doc.removedHoles.length) api.set("removedHoles", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // ─── Variation history (undo/redo scoped to the variation block) ───
  const setVariation = useCallback(next => api.set("variation", next), [api]);
  const history = useVariationHistory(variation, setVariation);
  const selectedVariationLayer = useMemo(
    () => variation.layers.find(l => l.id === variation.selectedLayerId) || variation.layers[0],
    [variation]
  );

  // ─── Compound edits (things that touch more than one field) ────────
  const actions = useMemo(() => {
    const setShape = shape => {
      const { hole } = doc;
      const patch = { "hole.shape": shape };
      if (CUSTOM_SIZE_SHAPES.includes(shape) && !CUSTOM_SIZE_SHAPES.includes(hole.shape)) {
        // Switching from Circle/Hex → custom size: init from diameter
        patch["hole.w"] = shape === "Pill" ? hole.diameter * 2 : hole.diameter;
        patch["hole.h"] = shape === "Triangle" ? (hole.diameter * Math.sqrt(3)) / 2 : hole.diameter;
      }
      api.patch(patch);
    };
    const setEdgeGapX = v =>
      api.patch(
        doc.layout.gapLinked
          ? { "layout.edgeGapX": v, "layout.edgeGapY": v, presetIndex: 0 }
          : { "layout.edgeGapX": v, presetIndex: 0 }
      );
    const setEdgeGapY = v => api.patch({ "layout.edgeGapY": v, presetIndex: 0 });
    const toggleGapLinked = () =>
      api.patch(
        doc.layout.gapLinked
          ? { "layout.gapLinked": false }
          : { "layout.gapLinked": true, "layout.edgeGapY": doc.layout.edgeGapX }
      );
    const setRadialEdgeGap = v =>
      api.patch(
        doc.layout.radial.linked
          ? { "layout.radial.edgeGap": v, "layout.radial.circumGap": v }
          : { "layout.radial.edgeGap": v }
      );
    const setCircumEdgeGap = v => api.set("layout.radial.circumGap", v);
    const toggleRadialLinked = () =>
      api.patch(
        doc.layout.radial.linked
          ? { "layout.radial.linked": false }
          : { "layout.radial.linked": true, "layout.radial.circumGap": doc.layout.radial.edgeGap }
      );
    const setSunflowerGap = v => api.patch({ "layout.radial.edgeGap": v, "layout.radial.circumGap": v });
    const setMarginUniform = v =>
      api.patch({
        "boundary.margins.top": v,
        "boundary.margins.bottom": v,
        "boundary.margins.left": v,
        "boundary.margins.right": v,
      });
    const toggleMarginLinked = () => {
      const m = doc.boundary.margins.top;
      api.patch(
        doc.boundary.marginLinked
          ? { "boundary.marginLinked": false }
          : {
              "boundary.marginLinked": true,
              "boundary.margins.bottom": m,
              "boundary.margins.left": m,
              "boundary.margins.right": m,
            }
      );
    };
    const applyPreset = idx => {
      if (idx === 0) {
        api.set("presetIndex", 0);
        return;
      }
      const p = DIN_PRESETS[idx];
      api.patch({
        presetIndex: idx,
        "hole.diameter": p.d,
        "layout.edgeGapX": Math.max(0, p.pitchX - p.d),
        "layout.edgeGapY": Math.max(0, p.pitchY - p.d),
        "layout.type": p.pattern,
      });
    };
    // Any hand edit of a preset-controlled field drops back to "Custom".
    const setWithPresetReset = (path, v) => api.patch({ [path]: v, presetIndex: 0 });
    const toggleRemovedHole = idx =>
      api.update(d => {
        const next = new Set(d.removedHoles);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return { ...d, removedHoles: [...next] };
      });
    const clearRemovedHoles = () => api.set("removedHoles", []);

    // Variation block
    const setVariationEnabled = enabled => {
      history.commit(current => ({ ...current, enabled }));
      if (!enabled) setVariationEditMode(false);
    };
    const toggleVariationEditMode = () => {
      const next = !variationEditMode;
      setVariationEditMode(next);
      if (next) {
        setHoleRemovalMode(false);
        if (!history.ref.current.enabled) history.commit(current => ({ ...current, enabled: true }));
      }
    };
    const updateSelectedLayer = (patch, record = false) => {
      const apply = current => ({
        ...current,
        layers: current.layers.map(layer => (layer.id === current.selectedLayerId ? { ...layer, ...patch } : layer)),
      });
      if (record) history.commit(apply);
      else history.live(apply);
    };
    const applyVariationPreset = name => {
      const preset = VARIATION_PRESETS[name];
      if (!preset) return;
      history.commit(current => {
        const selectedId = current.selectedLayerId || current.layers[0]?.id || "layer-1";
        const baseLayer =
          current.layers.find(layer => layer.id === selectedId) || current.layers[0] || createVariationLayer(1);
        return {
          ...current,
          enabled: true,
          minScale: preset.minScale,
          maxScale: preset.maxScale,
          selectedLayerId: baseLayer.id,
          layers: [{ ...baseLayer, ...preset.layer, enabled: true }],
        };
      });
      setVariationEditMode(true);
    };
    const addVariationLayer = () => {
      if (history.ref.current.layers.length >= 3) return;
      history.commit(current => {
        const layer = createVariationLayer(current.layers.length + 1);
        return { ...current, enabled: true, layers: [...current.layers, layer], selectedLayerId: layer.id };
      });
    };
    const removeSelectedVariationLayer = () => {
      if (history.ref.current.layers.length <= 1) return;
      history.commit(current => {
        const layers = current.layers.filter(layer => layer.id !== current.selectedLayerId);
        return { ...current, layers, selectedLayerId: layers[0].id };
      });
    };
    const randomizeVariation = () => {
      history.commit(current => ({
        ...current,
        enabled: true,
        layers: current.layers.map(layer => randomizeVariationLayer(layer)),
      }));
      setVariationEditMode(true);
    };
    const setHoleRemoval = on => {
      setHoleRemovalMode(on);
      if (on) setVariationEditMode(false);
    };
    const resetView = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };

    return {
      setShape,
      setEdgeGapX,
      setEdgeGapY,
      toggleGapLinked,
      setRadialEdgeGap,
      setCircumEdgeGap,
      toggleRadialLinked,
      setSunflowerGap,
      setMarginUniform,
      toggleMarginLinked,
      applyPreset,
      setWithPresetReset,
      toggleRemovedHole,
      clearRemovedHoles,
      setVariationEnabled,
      toggleVariationEditMode,
      updateSelectedLayer,
      applyVariationPreset,
      addVariationLayer,
      removeSelectedVariationLayer,
      randomizeVariation,
      setHoleRemoval,
      resetView,
    };
  }, [doc, api, history, variationEditMode]);

  // ─── Exports ──────────────────────────────────────────────────────
  const { holeColor, bgColor } = doc.appearance;
  const exportSVG = useCallback(() => {
    downloadText(
      generateSVGString(activeHoles, { ...params, holeColor, bgColor }),
      "perforation_pattern.svg",
      "image/svg+xml"
    );
  }, [activeHoles, params, holeColor, bgColor]);
  const exportPNG = useCallback(() => {
    renderPNGBlob({ activeHoles, params, holeColor, bgColor, dark }).then(blob =>
      downloadBlob(blob, "perforation_pattern.png")
    );
  }, [activeHoles, params, holeColor, bgColor, dark]);

  const ui = {
    dark,
    setDark,
    showHud,
    setShowHud,
    holeRemovalMode,
    variationEditMode,
    variationAdvanced,
    setVariationAdvanced,
    variationHud,
    setVariationHud,
    pan,
    setPan,
    zoom,
    setZoom,
  };
  const value = {
    doc,
    api,
    theme,
    ui,
    geometry,
    params,
    holes,
    activeHoles,
    removedSet,
    overlaps,
    stats,
    history,
    selectedVariationLayer,
    actions,
    exportSVG,
    exportPNG,
  };

  return (
    <EditorContext.Provider value={value}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100vw",
          height: "100vh",
          padding: 10,
          background: theme.appBg,
          color: theme.textPrimary,
          fontFamily: `${MONO}, -apple-system, sans-serif`,
          overflow: "hidden",
          WebkitFontSmoothing: "antialiased",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <GlobalStyles theme={theme} />
        <TopBar />
        {/* Body: floating sidebar (left) + floating canvas (right, via flex order) */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 10 }}>
          <CanvasView />
          <Sidebar />
        </div>
      </div>
    </EditorContext.Provider>
  );
}
