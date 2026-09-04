import { useCallback, useEffect, useMemo, useState } from "react";
import { CUSTOM_SIZE_SHAPES, DIN_PRESETS } from "../core/constants.js";
import { cloneVariation, createDocument } from "../core/document.js";
import { buildParams, computeStats, decorateHoles, deriveGeometry, filterActive } from "../core/pipeline.js";
import {
  FILE_EXTENSION,
  FILE_MIME,
  decodeShareHash,
  deserializeDocument,
  encodeShareHash,
  fileStem,
  loadCurrent,
  loadRecent,
  migrateDocument,
  saveCurrent,
  serializeDocument,
  touchRecent,
} from "../core/persistence.js";
import { generateHoles } from "../layouts/grid.js";
import { findOverlaps } from "../geometry/ligament.js";
import { VARIATION_PRESETS, createVariationLayer, randomizeVariationLayer } from "../fields/variation-engine.js";
import { generateSVGString } from "../export/svg.js";
import { renderPNGBlob } from "../export/png.js";
import { downloadBlob, downloadText } from "../export/download.js";
import { getTheme, MONO } from "./theme.js";
import { useDocument } from "./useDocument.js";
import { EditorContext } from "./EditorContext.jsx";
import { GlobalStyles } from "./GlobalStyles.jsx";
import { TopBar } from "./TopBar.jsx";
import { CanvasView } from "./canvas/CanvasView.jsx";
import { Sidebar } from "./Sidebar.jsx";

const AUTOSAVE_MS = 300;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Share link in the URL beats the autosaved document, which beats a fresh one.
function loadInitialDocument() {
  try {
    const shared = decodeShareHash(window.location.hash);
    if (shared) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return shared;
    }
  } catch (err) {
    console.warn("Ignoring damaged share link:", err);
  }
  const store = storage();
  return (store && loadCurrent(store)) || createDocument();
}

export default function App() {
  const [doc, api] = useDocument(loadInitialDocument);

  // ─── UI-only state (never saved with the document) ─────────────────
  const [dark, setDark] = useState(true);
  const [showHud, setShowHud] = useState(true); // one switch for every on-canvas overlay
  const [holeRemovalMode, setHoleRemovalMode] = useState(false);
  const [variationEditMode, setVariationEditMode] = useState(false);
  const [variationAdvanced, setVariationAdvanced] = useState(false);
  const [variationHud, setVariationHud] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [savedDoc, setSavedDoc] = useState(null); // the last document written to localStorage
  const [recent, setRecent] = useState(() => {
    const store = storage();
    return store ? loadRecent(store) : [];
  });
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

  // ─── Autosave (localStorage) ──────────────────────────────────────
  useEffect(() => {
    const store = storage();
    if (!store) return;
    const t = window.setTimeout(() => {
      try {
        saveCurrent(store, doc);
        setRecent(touchRecent(store, doc));
        setSavedDoc(doc);
      } catch (err) {
        console.warn("Autosave failed:", err);
      }
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [doc]);
  const saveStatus = !storage() ? "idle" : savedDoc === doc ? "saved" : "saving";

  // ─── Variation history adapter ────────────────────────────────────
  // The variation panel and canvas gizmo edit the variation block through this
  // small API; underneath it is the global document history.
  const history = useMemo(
    () => ({
      ref: {
        get current() {
          return api.ref.current.variation;
        },
      },
      // Discrete edit → its own undo step.
      commit: updater =>
        api.update(d => {
          const next = typeof updater === "function" ? updater(cloneVariation(d.variation)) : updater;
          return JSON.stringify(next) === JSON.stringify(d.variation) ? d : { ...d, variation: next };
        }),
      // Continuous edit (slider / handle drag) → coalesced into one step.
      live: updater =>
        api.update(
          d => ({ ...d, variation: typeof updater === "function" ? updater(cloneVariation(d.variation)) : updater }),
          { merge: "variation" }
        ),
      endDrag: () => api.closeGroup(),
      undo: api.undo,
      redo: api.redo,
      canUndo: api.canUndo,
      canRedo: api.canRedo,
    }),
    [api]
  );
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
          : { "layout.edgeGapX": v, presetIndex: 0 },
        { merge: "layout.edgeGapX" }
      );
    const setEdgeGapY = v => api.patch({ "layout.edgeGapY": v, presetIndex: 0 }, { merge: "layout.edgeGapY" });
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
          : { "layout.radial.edgeGap": v },
        { merge: "layout.radial.edgeGap" }
      );
    const setCircumEdgeGap = v => api.set("layout.radial.circumGap", v);
    const toggleRadialLinked = () =>
      api.patch(
        doc.layout.radial.linked
          ? { "layout.radial.linked": false }
          : { "layout.radial.linked": true, "layout.radial.circumGap": doc.layout.radial.edgeGap }
      );
    const setSunflowerGap = v =>
      api.patch({ "layout.radial.edgeGap": v, "layout.radial.circumGap": v }, { merge: "layout.radial.sunflower" });
    const setMarginUniform = v =>
      api.patch(
        {
          "boundary.margins.top": v,
          "boundary.margins.bottom": v,
          "boundary.margins.left": v,
          "boundary.margins.right": v,
        },
        { merge: "boundary.margins" }
      );
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
    const setWithPresetReset = (path, v) => api.patch({ [path]: v, presetIndex: 0 }, { merge: path });
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
      `${fileStem(doc)}.svg`,
      "image/svg+xml"
    );
  }, [activeHoles, params, holeColor, bgColor, doc]);
  const exportPNG = useCallback(() => {
    renderPNGBlob({ activeHoles, params, holeColor, bgColor, dark }).then(blob =>
      downloadBlob(blob, `${fileStem(doc)}.png`)
    );
  }, [activeHoles, params, holeColor, bgColor, dark, doc]);

  // ─── Project: new / open / save / share / recent ──────────────────
  const loadDocument = useCallback(
    next => {
      api.replace(next);
      setVariationEditMode(false);
      setHoleRemovalMode(false);
      setVariationHud(null);
    },
    [api]
  );
  const openFile = useCallback(
    file => {
      file
        .text()
        .then(text => loadDocument(deserializeDocument(text)))
        .catch(err => window.alert(`Could not open ${file.name}: ${err.message}`));
    },
    [loadDocument]
  );
  const project = useMemo(
    () => ({
      saveStatus,
      recent,
      fileExtension: FILE_EXTENSION,
      newDocument: () => loadDocument(createDocument()),
      openFile,
      openRecent: id => {
        const entry = recent.find(e => e.id === id);
        if (!entry) return;
        try {
          loadDocument(migrateDocument(entry.doc));
        } catch (err) {
          window.alert(`Could not open ${entry.name}: ${err.message}`);
        }
      },
      saveFile: () =>
        downloadText(serializeDocument(api.ref.current), `${fileStem(api.ref.current)}${FILE_EXTENSION}`, FILE_MIME),
      shareLink: async () => {
        const url = `${window.location.origin}${window.location.pathname}${encodeShareHash(api.ref.current)}`;
        try {
          await navigator.clipboard.writeText(url);
          return true;
        } catch {
          window.prompt("Copy this link:", url);
          return false;
        }
      },
    }),
    [saveStatus, recent, loadDocument, openFile, api]
  );

  // Keyboard shortcuts: undo / redo / save. Text fields keep their own undo.
  useEffect(() => {
    const onKey = e => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // Only text-editing fields keep the browser's own undo; sliders and buttons pass it through.
      const t = e.target;
      const inField =
        t?.isContentEditable ||
        t?.tagName === "TEXTAREA" ||
        (t?.tagName === "INPUT" && !/^(range|checkbox|radio|button|file|color)$/.test(t.type));
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        project.saveFile();
      } else if (!inField && key === "z" && !e.shiftKey) {
        e.preventDefault();
        api.undo();
      } else if (!inField && ((key === "z" && e.shiftKey) || key === "y")) {
        e.preventDefault();
        api.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, project]);

  // Drop a document file anywhere on the page to open it.
  useEffect(() => {
    const onDragOver = e => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onDrop = e => {
      const file = [...(e.dataTransfer?.files || [])].find(f => /\.json$/i.test(f.name));
      if (!file) return;
      e.preventDefault();
      openFile(file);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openFile]);

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
    project,
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
