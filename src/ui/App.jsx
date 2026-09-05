import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOM_SIZE_SHAPES, DIN_PRESETS, MAX_PATHS, MAX_VARIATION_LAYERS } from "../core/constants.js";
import { cloneVariation, createDocument } from "../core/document.js";
import {
  buildParams,
  compileDocumentField,
  fieldContext,
  compilePlacement,
  computeStats,
  decorateHoles,
  deriveGeometry,
  filterActive,
} from "../core/pipeline.js";
import {
  FILE_EXTENSION,
  FILE_MIME,
  decodeShareHash,
  deserializeDocument,
  encodeShareHash,
  fileStem,
  hasAssets,
  newAssetId,
  pruneAssets,
  STORAGE_KEY_CURRENT,
  loadCurrent,
  loadRecent,
  migrateDocument,
  saveCurrent,
  serializeDocument,
  touchRecent,
} from "../core/persistence.js";
import { generateHoles, layoutPlacementChannels } from "../layouts/index.js";
import { addPathVertex, newPath, removePathVertex } from "../layouts/path-gizmo.js";
import { findOverlaps } from "../geometry/ligament.js";
import { VARIATION_PRESETS, createVariationLayer, randomizeVariationLayer } from "../fields/variation-engine.js";
import { EDITABLE_CHANNELS, MAX_CONTROLLERS, createController, imageChannels } from "../fields/controllers.js";
import { readImageFile, splitImageMaps, useImageMaps } from "./useImageMaps.js";
import { generateSVGParts } from "../export/svg.js";
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

// True when the document we start with is byte-for-byte what localStorage
// already holds, so this tab has nothing to write until the user edits it.
// Without it a freshly opened, untouched tab writes its copy ~850 ms after load
// (mount plus the debounce) over whatever another tab saved in between.
let startedClean = false;

// Share link in the URL beats the autosaved document, which beats a fresh one.
function loadInitialDocument() {
  startedClean = false;
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
  const stored = store && loadCurrent(store);
  if (!stored) return createDocument();
  // A document an older version wrote may normalise on load; then it is dirty
  // and gets its one write, correctly.
  startedClean = serializeDocument(stored, false) === store.getItem(STORAGE_KEY_CURRENT);
  return stored;
}

// The compiled placement inputs, memoised by VALUE rather than by identity.
//
// `compilePlacement` returns a fresh object for every edit of the document, but
// only a change to its SIGNATURE can move a hole — and regenerating the pattern
// costs orders of magnitude more than compiling the field. Keyed on identity
// alone, a document holding one spacing controller re-ran the whole layout on
// every frame of an unrelated size-controller drag: measured at about 200 ms a
// frame on an 11 k-hole scatter, for byte-identical centres.
//
// Held in state and adjusted during render — React's own pattern for "I have a
// new value but it means the same thing as the old one". The adjusting render
// re-runs immediately, and only when the signature genuinely changed, in which
// case the pattern was going to be regenerated anyway; the memo below sees the
// same object both times, so it still generates once. A ref would read more
// simply and is what the lint rules forbid, correctly: this value IS needed for
// rendering.
function usePlacementField(doc) {
  const compiled = useMemo(() => compilePlacement(doc), [doc]);
  const [held, setHeld] = useState(compiled);
  if ((held?.signature ?? null) !== (compiled?.signature ?? null)) {
    setHeld(compiled);
    return compiled;
  }
  return held;
}

export default function App() {
  const [doc, api] = useDocument(loadInitialDocument);
  const closeHistoryGroup = api.closeGroup;

  // Continuous edits coalesce while a pointer gesture is active. End the group
  // at the browser boundary so two quick slider or colour-picker drags remain
  // separate undo steps, including when pointer capture moves the release away
  // from the control that started the gesture.
  useEffect(() => {
    window.addEventListener("pointerup", closeHistoryGroup);
    window.addEventListener("pointercancel", closeHistoryGroup);
    return () => {
      window.removeEventListener("pointerup", closeHistoryGroup);
      window.removeEventListener("pointercancel", closeHistoryGroup);
    };
  }, [closeHistoryGroup]);

  // ─── UI-only state (never saved with the document) ─────────────────
  const [dark, setDark] = useState(true);
  const [showHud, setShowHud] = useState(true); // one switch for every on-canvas overlay
  const [holeRemovalMode, setHoleRemovalMode] = useState(false);
  const [variationEditMode, setVariationEditMode] = useState(false);
  const [variationAdvanced, setVariationAdvanced] = useState(false);
  const [variationHud, setVariationHud] = useState(null);
  const [fieldEditMode, setFieldEditMode] = useState(false);
  const [pathEditModeOn, setPathEditMode] = useState(false);
  const [activeChannel, setActiveChannel] = useState(EDITABLE_CHANNELS[0]);
  const [fieldTool, setFieldTool] = useState(null); // armed kind for click-to-add on the canvas
  // Which controller the inspector is showing. UI state, like every other
  // selection and mode here: in the document it would be one undo step per
  // click, and clicking between controllers would evict real edits from a
  // hundred-step history.
  const [selectedId, setSelectedId] = useState(null);
  // Which Path curve the panel shows and the canvas highlights. UI state for the
  // same reason a controller selection is: it changes on every click.
  const [selectedPathIndex, setSelectedPath] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [savedDoc, setSavedDoc] = useState(() => (startedClean ? doc : null)); // last written to localStorage
  const [saveError, setSaveError] = useState(false);
  const [recent, setRecent] = useState(() => {
    const store = storage();
    return store ? loadRecent(store) : [];
  });
  const theme = useMemo(() => getTheme(dark), [dark]);

  // ─── Derived pipeline (memoised step by step) ──────────────────────
  // setIn() shares untouched branches, so keying memos on the sub-objects means
  // e.g. a colour or removed-hole edit never regenerates the pattern.
  const { hole, layout, sheet, boundary, taper, variation, fields } = doc;
  // Both of these are UI state ABOUT the document, so both are derived rather
  // than trusted: undo can shorten the curve list under a selection, and leaving
  // another mode does not stop this one being on. Clamping here rather than at
  // every edit means neither can outlive what it points at — a selection past
  // the end threw on the next "+ vertex", and an edit mode still on after the
  // layout type changed left the canvas dragging invisible handles with the
  // badge describing it and no control left on screen to switch it off.
  // Left on rather than merely ignored: turning it off here means coming back to
  // Path later arrives with the canvas quiet, which is what leaving a mode ought
  // to mean. Adjusting state during render is React's own answer to "this state
  // no longer matches the props"; the `&&` keeps this render correct as well,
  // since the re-render happens after it.
  if (pathEditModeOn && layout.type !== "Path") setPathEditMode(false);
  const pathEditMode = pathEditModeOn && layout.type === "Path";
  const selectedPath = Math.max(0, Math.min(selectedPathIndex, layout.path.paths.length - 1));
  const patternDoc = useMemo(() => ({ hole, layout, sheet, boundary, taper }), [hole, layout, sheet, boundary, taper]);
  const geometry = useMemo(() => deriveGeometry(patternDoc), [patternDoc]);
  const params = useMemo(() => buildParams(patternDoc, geometry), [patternDoc, geometry]);
  // The placement inputs that are not primitives: the spacing channel and the
  // Path curves. Held by signature (see usePlacementField) so that editing a
  // size, angle or shape controller leaves the generated centres alone instead
  // of regenerating the whole pattern for an identical result.
  const placement = usePlacementField(doc);
  const baseHoles = useMemo(() => generateHoles(params, placement), [params, placement]);
  // Decoding an image is asynchronous and lives outside the document, so the
  // maps arrive after the first render and simply recompile the field then.
  const decodedImages = useImageMaps(doc.assets);
  // Filtered against the document that is loaded NOW. Asset ids are per-document
  // counters, so "asset-1" is the norm everywhere; without this, the moment
  // between loading a new document and its picture finishing decoding would
  // render it with the previous document's bitmap under the same id.
  const { maps: imageMaps, images: imageElements } = useMemo(
    () => splitImageMaps(decodedImages, doc.assets),
    [decodedImages, doc.assets]
  );
  const field = useMemo(
    () => compileDocumentField(fields, fieldContext(layout.type, imageMaps)),
    [fields, imageMaps, layout.type]
  );
  const holeDoc = useMemo(() => ({ ...patternDoc, variation, fields }), [patternDoc, variation, fields]);
  const holes = useMemo(
    () => decorateHoles(baseHoles, holeDoc, geometry, field),
    [baseHoles, holeDoc, geometry, field]
  );
  const removedSet = useMemo(() => new Set(doc.removedHoles), [doc.removedHoles]);
  const activeHoles = useMemo(() => filterActive(holes, removedSet), [holes, removedSet]);
  // `geometry.holeShape`, not `hole.shape`: Voronoi draws each hole as its own
  // cell, and two cells are compared as the polygons they are.
  const overlaps = useMemo(() => findOverlaps(activeHoles, geometry.holeShape), [activeHoles, geometry.holeShape]);
  const stats = useMemo(
    () => computeStats({ doc: holeDoc, g: geometry, params, holes, activeHoles, removedSet, overlaps, field }),
    [holeDoc, geometry, params, holes, activeHoles, removedSet, overlaps, field]
  );
  // A selection can outlive what it points at (undo, delete, loading a document),
  // so it is resolved rather than trusted — and falls back to the first
  // controller on the channel being edited, so the inspector is never blank
  // while that channel has something in it. `selectedId` is therefore a hint;
  // `selectedController` is the answer, and the canvas highlights the same one.
  const selectedController = useMemo(() => {
    const list = fields.controllers;
    return list.find(c => c.id === selectedId) || list.find(c => c.channel === activeChannel) || null;
  }, [fields, selectedId, activeChannel]);
  const selectedControllerId = selectedController?.id ?? null;
  // Where a new controller is placed, and the frame the panel reports in.
  const perfArea = useMemo(
    () => ({ x: params.marginLeft, y: params.marginTop, w: geometry.perfW, h: geometry.perfH }),
    [params.marginLeft, params.marginTop, geometry.perfW, geometry.perfH]
  );

  // ─── Autosave (localStorage) ──────────────────────────────────────
  // Removed-hole indices are dropped by the reducer when the pattern changes,
  // so a loaded document keeps the removals it was saved with.
  const savedRef = useRef(startedClean ? doc : null); // same as savedDoc, readable from event handlers
  const recentRef = useRef(null); // last document upserted into the recent list
  // Write only what is genuinely unsaved. A tab that has not been touched since
  // it loaded must stay quiet: writing its copy would undo whatever another tab
  // saved in the meantime, and both share the one `current` key. The guard sits
  // here rather than at the call sites so that a debounce still armed behind an
  // unload flush becomes a no-op instead of a second, later write.
  const saveNow = useCallback(next => {
    const store = storage();
    if (!store || !next) return;
    if (next !== savedRef.current) {
      try {
        saveCurrent(store, next);
      } catch (err) {
        console.warn("Autosave failed:", err);
        setSaveError(true);
        return;
      }
      savedRef.current = next;
      setSavedDoc(next);
    }
    // Reached only once the document is known to be in storage, so a later save
    // of an unchanged document still clears an error left by an earlier one.
    setSaveError(false);
    // The recent list is a convenience and, holding ten whole documents, is far
    // more likely to hit a quota. It carries its own mark so that a failure is
    // retried on the next save instead of being written off with the document.
    if (next !== recentRef.current) {
      try {
        setRecent(touchRecent(store, next));
        recentRef.current = next;
      } catch (err) {
        console.warn("Could not update the recent list:", err);
      }
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => saveNow(doc), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [doc, saveNow]);
  const flushPending = useCallback(() => saveNow(api.ref.current), [api, saveNow]);
  // The debounce would otherwise lose the last edits when the page goes away.
  // visibilitychange fires on the way back in as well, so check which way it went.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushPending]);
  const saveStatus = !storage() || saveError ? "idle" : savedDoc === doc ? "saved" : "saving";
  // A boolean rather than `doc` itself, so the project menu and the keyboard
  // listener that depend on it are not rebuilt on every edit of the pattern.
  const documentHasAssets = hasAssets(doc);

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
    // Scatter's seed is a document field like any other, so shuffling it is one
    // undo step and the arrangement it produced can always be got back.
    // `merge: null` rather than the automatic key: a numeric `set` normally
    // coalesces under its own path, which is right for a slider drag and wrong
    // here — two Shuffles inside COALESCE_MS would collapse into one step and
    // the first arrangement would be unreachable. The window-level pointerup
    // closes the group after a mouse click, but not after a keyboard activation
    // of the button, which is exactly how two shuffles land in the same group.
    const reseedScatter = () => api.set("layout.scatter.seed", Math.floor(Math.random() * 100000), { merge: null });
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
        setPathEditMode(false);
        setFieldEditMode(false);
        setFieldTool(null);
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
      setFieldEditMode(false);
    };
    const addVariationLayer = () => {
      if (history.ref.current.layers.length >= MAX_VARIATION_LAYERS) return;
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
      setFieldEditMode(false);
    };
    // ─── Field controllers ─────────────────────────────────────────
    // Every edit goes through api.update so it lands on the one global undo
    // stack, exactly like the variation block. Continuous edits (sliders, canvas
    // drags) coalesce under a key naming the controller AND the fields being
    // written, so a drag is one step, two drags of different controllers are
    // two, and — as everywhere else in the app, where the auto key is the edited
    // path — changing a controller's target and then its strength is two rather
    // than one.
    const mapControllers = (d, fn) => {
      const controllers = d.fields.controllers.map(fn);
      // An edit that changes nothing returns the same document, so H.record
      // drops it: clicking the falloff chip that is already active must not
      // spend an undo step.
      return controllers.every((c, i) => c === d.fields.controllers[i])
        ? d
        : { ...d, fields: { ...d.fields, controllers } };
    };
    const setFieldsEnabled = enabled => {
      api.set("fields.enabled", enabled);
      if (!enabled) {
        setFieldEditMode(false);
        setFieldTool(null);
      }
    };
    // The three canvas modes are mutually exclusive: each one claims the pointer,
    // and two at once means a click does something the badge does not describe.
    const enterFieldEditMode = on => {
      setFieldEditMode(on);
      if (on) {
        setHoleRemovalMode(false);
        setVariationEditMode(false);
        setPathEditMode(false);
        if (!api.ref.current.fields.enabled) api.set("fields.enabled", true);
      } else {
        setFieldTool(null);
      }
    };
    const toggleFieldEditMode = () => enterFieldEditMode(!fieldEditMode);
    const selectChannel = channel => {
      setActiveChannel(channel);
      // Keep the inspector on something that belongs to the channel just picked.
      const current = api.ref.current.fields;
      const selected = current.controllers.find(c => c.id === selectedId);
      // Let the fallback above pick the new channel's first controller.
      if (selected && selected.channel !== channel) setSelectedId(null);
    };
    const selectController = setSelectedId;
    // `geometry` overrides the default placement when the controller is being
    // drawn on the canvas rather than dropped from the panel.
    const addController = (kind, geometry = null) => {
      const current = api.ref.current.fields;
      if (current.controllers.length >= MAX_CONTROLLERS) {
        // Nothing more can be placed, so stop promising that a click will place
        // something. The rail's buttons disable themselves; the armed tool and
        // its HUD badge would otherwise stay up, inviting clicks that do nothing.
        setFieldTool(null);
        return null;
      }
      // An image cannot drive spacing, so a picture asked for while that channel
      // is selected lands on one that can rather than becoming a controller that
      // is inert by construction. The rail and the panel disable the button for
      // the same reason; this covers the file dropped on the page, which does not
      // go through either.
      const allowed = imageChannels(layoutPlacementChannels(doc.layout.type));
      const channel = kind === "image" && !allowed.includes(activeChannel) ? allowed[0] : activeChannel;
      const controller = createController({ channel, kind, area: perfArea, existing: current.controllers });
      if (geometry) controller.geometry = geometry;
      if (channel !== activeChannel) setActiveChannel(channel);
      api.update(d => ({
        ...d,
        fields: { ...d.fields, enabled: true, controllers: [...d.fields.controllers, controller] },
      }));
      setSelectedId(controller.id);
      enterFieldEditMode(true);
      return controller.id;
    };
    const updateController = (id, patch, live = false) =>
      api.update(
        d => mapControllers(d, c => (c.id === id ? { ...c, ...patch } : c)),
        live ? { merge: `fields.${id}.${Object.keys(patch).sort().join(",")}` } : {}
      );
    const removeController = id =>
      api.update(d => {
        const controllers = d.fields.controllers.filter(c => c.id !== id);
        // A controller synced to the one being removed would otherwise keep a
        // reference that resolves to nothing on every hole.
        const cleaned = controllers.map(c => (c.syncWith === id ? { ...c, syncWith: null } : c));
        // Hand the selection to a controller on the channel being edited, so the
        // inspector does not vanish while that channel's list still has entries.
        const next = cleaned.find(c => c.channel === activeChannel) ?? cleaned[0] ?? null;
        if (id === selectedId) setSelectedId(next?.id ?? null);
        return pruneAssets({ ...d, fields: { ...d.fields, controllers: cleaned } });
      });
    const clearControllers = () => {
      setSelectedId(null);
      setFieldTool(null);
      api.update(d => pruneAssets({ ...d, fields: { ...d.fields, controllers: [] } }));
    };
    // Attaching a picture rewrites the asset store and the controller together,
    // so one undo takes both back and no orphan is ever left behind.
    const setControllerImage = (id, asset) =>
      api.update(d => {
        const assetId = newAssetId(d.assets);
        return pruneAssets({
          ...mapControllers(d, c => (c.id === id ? { ...c, image: { ...c.image, assetId } } : c)),
          assets: { ...d.assets, [assetId]: asset },
        });
      });
    const clearControllerImage = id =>
      api.update(d => pruneAssets(mapControllers(d, c => (c.id === id ? { ...c, image: { ...c.image, assetId: null } } : c)))); // prettier-ignore
    // An image file dropped on the page: into the selected image controller if
    // there is one, otherwise into a new one. Dropping a picture is the natural
    // way to reach for this feature, and answering it with "not a Perf Pattern
    // document" was the wrong reply.
    const dropImage = async file => {
      const asset = await readImageFile(file);
      const current = api.ref.current.fields;
      const selected = current.controllers.find(c => c.id === selectedControllerId);
      if (selected?.kind === "image") {
        setControllerImage(selected.id, asset);
        enterFieldEditMode(true);
        return;
      }
      const id = addController("image");
      if (!id) throw new Error(`this document already has ${MAX_CONTROLLERS} controllers`);
      setControllerImage(id, asset);
    };

    const setHoleRemoval = on => {
      setHoleRemovalMode(on);
      if (on) {
        setVariationEditMode(false);
        setPathEditMode(false);
        enterFieldEditMode(false);
      }
    };

    // ─── Path curves ───────────────────────────────────────────────
    // The curves live in the document, so every edit here is an undo step and a
    // vertex drag coalesces into one, exactly like a controller handle.
    const livePaths = () => api.ref.current.layout.path.paths;
    const togglePathEditMode = () => {
      const next = !pathEditModeOn;
      setPathEditMode(next);
      if (next) {
        setVariationEditMode(false);
        setHoleRemovalMode(false);
        enterFieldEditMode(false);
        // Editing needs something to edit: the layout draws a default curve
        // when the list is empty, and this makes that same curve real rather
        // than leaving the canvas showing a line with no handles on it.
        if (livePaths().length === 0) api.set("layout.path.paths", [newPath(perfArea)]);
      }
    };
    const addPath = () => {
      const paths = livePaths();
      if (paths.length >= MAX_PATHS) return;
      api.set("layout.path.paths", [...paths, newPath(perfArea, paths)]);
      setSelectedPath(paths.length);
      setPathEditMode(true);
    };
    // No `setSelectedPath` here: React may run a reducer more than once, so a
    // state update inside one is not something to rely on — and the selection is
    // clamped where it is read instead, which also covers the undo that brings a
    // removed curve back.
    const removePath = index =>
      api.set(
        "layout.path.paths",
        livePaths().filter((_, i) => i !== index)
      );
    const setPaths = (paths, live = false) =>
      api.set("layout.path.paths", paths, live ? { merge: "layout.path.paths" } : {});
    const editPathVertices = (index, edit) => {
      const paths = livePaths();
      if (!paths[index]) return;
      const next = edit(paths[index]);
      if (next) setPaths(paths.map((path, i) => (i === index ? next : path)));
    };
    const addVertex = index => editPathVertices(index, addPathVertex);
    const removeVertex = index => editPathVertices(index, removePathVertex);
    const togglePathClosed = index => {
      const paths = livePaths();
      if (!paths[index]) return;
      setPaths(paths.map((path, i) => (i === index ? { ...path, closed: !path.closed } : path)));
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
      reseedScatter,
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
      setFieldsEnabled,
      dropImage,
      toggleFieldEditMode,
      selectChannel,
      selectController,
      addController,
      updateController,
      removeController,
      clearControllers,
      setControllerImage,
      clearControllerImage,
      setHoleRemoval,
      togglePathEditMode,
      addPath,
      removePath,
      setPaths,
      addVertex,
      removeVertex,
      togglePathClosed,
      selectPath: setSelectedPath,
      resetView,
    };
  }, [doc, api, history, variationEditMode, fieldEditMode, pathEditModeOn, activeChannel, perfArea, selectedId, selectedControllerId]); // prettier-ignore

  // ─── Exports ──────────────────────────────────────────────────────
  const { holeColor, bgColor } = doc.appearance;
  // Both exports can fail on a very large pattern (memory, canvas limits), and a
  // button that silently does nothing is worse than one that says why.
  const exportSVG = useCallback(() => {
    try {
      // Blob from the chunks, never one joined string: a multi-million-hole
      // document overruns the maximum string length.
      const parts = generateSVGParts(activeHoles, { ...params, holeColor, bgColor });
      downloadBlob(new Blob(parts, { type: "image/svg+xml" }), `${fileStem(doc)}.svg`);
    } catch (err) {
      console.error("SVG export failed:", err);
      window.alert(
        `Could not export this pattern as SVG (${activeHoles.length.toLocaleString()} holes): ${err.message}`
      );
    }
  }, [activeHoles, params, holeColor, bgColor, doc]);
  const exportPNG = useCallback(() => {
    renderPNGBlob({ activeHoles, params, holeColor, bgColor, dark })
      .then(blob => {
        if (!blob) throw new Error("the image could not be rendered at this size");
        downloadBlob(blob, `${fileStem(doc)}.png`);
      })
      .catch(err => {
        console.error("PNG export failed:", err);
        window.alert(`Could not export this pattern as PNG: ${err.message}`);
      });
  }, [activeHoles, params, holeColor, bgColor, dark, doc]);

  // ─── Project: new / open / save / share / recent ──────────────────
  const loadDocument = useCallback(
    next => {
      flushPending(); // the outgoing document may hold un-debounced edits
      api.replace(next);
      setVariationEditMode(false);
      setHoleRemovalMode(false);
      setFieldEditMode(false);
      setPathEditMode(false);
      setFieldTool(null);
      setSelectedId(null);
      setSelectedPath(0);
      setVariationHud(null);
    },
    [api, flushPending]
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
      // A link carries the controllers but not their pictures — those go only in
      // the .perf.json file. The panel says so rather than letting the recipient
      // wonder why their halftone is flat.
      shareDropsImages: documentHasAssets,
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
    [saveStatus, recent, loadDocument, openFile, api, documentHasAssets]
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

  // Drop a document file anywhere on the page to open it — or an image, which
  // goes to an image controller instead of being turned away.
  useEffect(() => {
    const onDragOver = e => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onDrop = e => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      // Always swallow a file drop: letting it through navigates the tab away from the app.
      e.preventDefault();
      const files = [...(e.dataTransfer.files || [])];
      const document = files.find(f => /\.json$/i.test(f.name));
      if (document) {
        openFile(document);
        return;
      }
      const image = files.find(f => /^image\//i.test(f.type || "") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));
      if (image) {
        actions.dropImage(image).catch(err => window.alert(`Could not use ${image.name}: ${err.message}`));
        return;
      }
      if (files.length) window.alert(`Drop a ${FILE_EXTENSION} document to open it, or an image to drive a field.`);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openFile, actions]);

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
    fieldEditMode,
    pathEditMode,
    selectedPath,
    activeChannel,
    fieldTool,
    setFieldTool,
    selectedControllerId,
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
    field,
    selectedController,
    perfArea,
    imageElements,
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
