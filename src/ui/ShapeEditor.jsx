import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Circle, Copy, Diamond, Hexagon, Pentagon, Redo2, Square, Star, Triangle, Undo2, X } from "lucide-react"; // prettier-ignore
import { MAX_SHAPE_LAYERS } from "../core/constants.js";
import {
  LAYER_ROLE_INFO,
  LAYER_ROLES,
  LAYER_SHAPES,
  composeLayers,
  createShapeLayer,
  designExtent,
  duplicateLayer,
  hitTestLayerHandles,
  hitTestLayers,
  insertLayerVertexAt,
  layerHandles,
  layerRings,
  moveLayerHandle,
  removeLayerVertexAt,
  translateLayer,
} from "../geometry/custom-shape.js";
import { ringsSVGPath } from "../geometry/rings.js";
import { SHAPE_PRESETS } from "../geometry/shape-presets.js";
import { useEditor } from "./EditorContext.jsx";
import { SliderRow } from "./controls/index.js";
import { chipStyle, ghostButtonStyle, iconButtonStyle, kbdStyle, transition } from "./controls/index.js";
import { MONO } from "./theme.js";

// The boolean shape editor: a modal where basic shapes are stacked, each
// adding to the hole, cutting from it, intersecting it or excluding it — the
// Pathfinder verbs — and the composed outline becomes the Custom hole shape.
//
// Shapes are handled on the canvas the way a vector editor handles them: drag
// a shape to move it (Shift locks the axis), drag a corner to resize about the
// centre (Shift keeps the proportions), turn it by the knob above it (Shift in
// 15° steps), drag a polygon's vertices, double-click an edge to add one or a
// vertex to drop it. Delete removes the selected shape, Ctrl+D duplicates it,
// the arrows nudge it, and the stack has an undo of its own. The stack is
// local state until Apply, which writes it and the composed rings to the
// document as one undo step; Cancel drops it.
const SHAPE_ICON = { Circle, Rectangle: Square, Hexagon, Star, Triangle, Diamond, Polygon: Pentagon };
// The role glyphs: two overlapping squares with the kept region filled.
function RoleGlyph({ role, colour }) {
  const a = "M2 2h10v10H2z",
    b = "M6 6h10v10H6z";
  const fills = {
    union: [a, b],
    subtract: [a],
    intersect: ["M6 6h6v6H6z"],
    exclude: ["M2 2h10v4H6v6H2z", "M12 6h4v10H6v-4h6z"],
  }[role];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {fills.map((d, i) => (
        <path key={i} d={d} fill={colour} fillOpacity={0.9} />
      ))}
      {role === "subtract" && <path d={b} fill="none" stroke={colour} strokeWidth="1" strokeDasharray="2 1.5" />}
      <path d={a} fill="none" stroke={colour} strokeWidth="1" opacity="0.7" />
      <path d={b} fill="none" stroke={colour} strokeWidth="1" opacity="0.7" />
    </svg>
  );
}

const HISTORY_LIMIT = 100;
const HANDLE_PX = 8; // handle hit radius, screen px
const KNOB_PX = 22; // rotation knob's distance above the top edge, screen px

export function ShapeEditor() {
  const { doc, theme, ui, actions } = useEditor();
  const { dark } = theme;
  const initial = doc.hole.custom.layers.length
    ? doc.hole.custom.layers
    : [{ ...createShapeLayer("Circle"), w: 12, h: 12 }];
  const [layers, setLayersState] = useState(initial);
  const [applyError, setApplyError] = useState("");
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? null);
  const [hoverId, setHoverId] = useState(null);
  const past = useRef([]);
  const future = useRef([]);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const svgRef = useRef(null);
  const dialogRef = useRef(null);
  const drag = useRef(null); // { kind: "move" | "handle", id, handle, last, snapshot }
  // Mirror of the stack for the pointer handlers, kept current from a layout
  // effect (like the document's own ref in useDocument).
  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  const [dragging, setDragging] = useState(false);

  const selected = layers.find(l => l.id === selectedId) ?? null;
  const composed = useMemo(() => composeLayers(layers), [layers]);
  const extent = useMemo(() => designExtent(layers), [layers]);
  const empty = composed.length === 0;

  // ─── The stack's own history ───────────────────────────────────────
  // A discrete edit snapshots the outgoing stack; a drag snapshots once, when
  // it starts, and writes live until it ends.
  const syncHistory = () => setHistorySize({ past: past.current.length, future: future.current.length });
  const commit = useCallback(next => {
    const current = layersRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved === current) return;
    past.current.push(current);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    setLayersState(resolved);
    layersRef.current = resolved;
    syncHistory();
  }, []);
  const live = useCallback(next => {
    const resolved = typeof next === "function" ? next(layersRef.current) : next;
    setLayersState(resolved);
    layersRef.current = resolved;
  }, []);
  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(layersRef.current);
    const previous = past.current.pop();
    setLayersState(previous);
    layersRef.current = previous;
    syncHistory();
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(layersRef.current);
    const next = future.current.pop();
    setLayersState(next);
    layersRef.current = next;
    syncHistory();
  }, []);

  // ─── Edits ─────────────────────────────────────────────────────────
  const update = (id, patch) => commit(current => current.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const remove = useCallback(
    id => {
      commit(current => {
        const rest = current.filter(l => l.id !== id);
        if (id === selectedId) setSelectedId(rest[rest.length - 1]?.id ?? null);
        return rest;
      });
    },
    [commit, selectedId]
  );
  const add = shape => {
    if (layers.length >= MAX_SHAPE_LAYERS) return;
    const layer = createShapeLayer(shape, layers);
    // A second shape lands beside the first rather than on top of it, so it
    // is visibly a second shape — and never past the document's limit.
    const { box } = extent;
    if (layers.length) layer.x = Math.min(100, Math.round(box.right + layer.w / 2 + 1));
    commit([...layers, layer]);
    setSelectedId(layer.id);
  };
  const duplicate = useCallback(() => {
    const current = layersRef.current;
    const layer = current.find(l => l.id === selectedId);
    if (!layer || current.length >= MAX_SHAPE_LAYERS) return;
    const twin = duplicateLayer(layer, current);
    commit([...current, twin]);
    setSelectedId(twin.id);
  }, [commit, selectedId]);
  const move = (id, by) =>
    commit(current => {
      const index = current.findIndex(l => l.id === id);
      const target = index + by;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const nudge = useCallback(
    (dx, dy) => {
      if (!selectedId) return;
      commit(current => current.map(l => (l.id === selectedId ? translateLayer(l, dx, dy) : l)));
    },
    [commit, selectedId]
  );

  // ─── The canvas ────────────────────────────────────────────────────
  // The frame: the design's box with a margin, rounded to a 10 mm module so it
  // does not creep as a shape is dragged.
  const frame = useMemo(() => {
    const { box } = extent;
    const w = box.right - box.left,
      h = box.bottom - box.top;
    if (!(w > 0) || !(h > 0)) return { x: -15, y: -15, w: 30, h: 30 };
    const size = Math.max(10, Math.ceil((Math.max(w, h) * 1.5 + 6) / 10) * 10);
    const cx = Math.round((box.left + box.right) / 2 / 5) * 5;
    const cy = Math.round((box.top + box.bottom) / 2 / 5) * 5;
    return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
  }, [extent]);

  // Screen pixels → design millimetres, for hit tolerances and handle sizes.
  const mmPerPx = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return frame.w / 400;
    return Math.max(frame.w / rect.width, frame.h / rect.height);
  };
  const clientToDesign = (clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // preserveAspectRatio "xMidYMid meet": the frame is centred in the box.
    const scale = Math.min(rect.width / frame.w, rect.height / frame.h);
    const ox = rect.left + (rect.width - frame.w * scale) / 2;
    const oy = rect.top + (rect.height - frame.h * scale) / 2;
    return { x: frame.x + (clientX - ox) / scale, y: frame.y + (clientY - oy) / scale };
  };
  const [pxScale, setPxScale] = useState(frame.w / 400);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => setPxScale(mmPerPx());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mmPerPx reads the frame, which is in the deps
  }, [frame]);

  const onCanvasPointerDown = e => {
    if (e.button !== 0) return;
    const p = clientToDesign(e.clientX, e.clientY);
    if (!p) return;
    const scale = mmPerPx();
    const current = layersRef.current;
    const active = current.find(l => l.id === selectedId);
    if (active) {
      const handle = hitTestLayerHandles(active, p.x, p.y, HANDLE_PX * scale, KNOB_PX * scale);
      if (handle) {
        drag.current = { kind: "handle", id: active.id, handle, snapshot: current };
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
    const hit = hitTestLayers(current, p.x, p.y, 4 * scale);
    if (hit) {
      setSelectedId(hit.id);
      drag.current = { kind: "move", id: hit.id, start: p, snapshot: current, moved: false };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    setSelectedId(null);
  };
  const onCanvasPointerMove = e => {
    const p = clientToDesign(e.clientX, e.clientY);
    if (!p) return;
    const d = drag.current;
    if (!d) {
      const hit = hitTestLayers(layersRef.current, p.x, p.y, 4 * mmPerPx());
      const next = hit?.id ?? null;
      if (next !== hoverId) setHoverId(next);
      return;
    }
    if (d.kind === "handle") {
      live(current => current.map(l => (l.id === d.id ? moveLayerHandle(l, d.handle, p.x, p.y, e.shiftKey) : l)));
    } else {
      d.moved = true;
      // The move is the whole displacement since the press, re-applied from the
      // layer as it was then — so Shift's axis lock holds over the gesture and
      // releasing Shift puts the shape back under the cursor.
      const dx = p.x - d.start.x,
        dy = p.y - d.start.y;
      live(current =>
        current.map(l => {
          if (l.id !== d.id) return l;
          const origin = d.snapshot.find(o => o.id === d.id) || l;
          return translateLayer(origin, dx, dy, e.shiftKey);
        })
      );
    }
  };
  const onCanvasPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.kind === "move" && !d.moved) return; // a click: selection only
    // The drag wrote live; record the snapshot it started from as one step.
    if (layersRef.current !== d.snapshot) {
      past.current.push(d.snapshot);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      syncHistory();
    }
  };
  const onCanvasDoubleClick = e => {
    const p = clientToDesign(e.clientX, e.clientY);
    const active = layersRef.current.find(l => l.id === selectedId);
    if (!p || !active || active.shape !== "Polygon") return;
    const scale = mmPerPx();
    const handle = hitTestLayerHandles(active, p.x, p.y, HANDLE_PX * scale, KNOB_PX * scale);
    if (handle?.role === "vertex") {
      const next = removeLayerVertexAt(active, handle.index);
      if (next) update(active.id, { points: next.points });
      return;
    }
    const next = insertLayerVertexAt(active, p.x, p.y, 6 * scale);
    if (next) update(active.id, { points: next.points });
  };

  // ─── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      const t = e.target;
      const inField = t?.tagName === "INPUT" && !/^(range|checkbox|radio|button|file|color)$/.test(t.type);
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        e.preventDefault();
        ui.setShapeEditorOpen(false);
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !inField) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y" && !inField) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if (!inField && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        if (selectedId) remove(selectedId);
      } else if (!inField && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === "ArrowLeft") nudge(-step, 0);
        else if (e.key === "ArrowRight") nudge(step, 0);
        else if (e.key === "ArrowUp") nudge(0, -step);
        else if (e.key === "ArrowDown") nudge(0, step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui, undo, redo, duplicate, remove, nudge, selectedId]);

  // ─── Looks ─────────────────────────────────────────────────────────
  const roleColour = role =>
    ({ union: theme.accent, subtract: theme.warn, intersect: dark ? "#2dd4bf" : "#0f766e", exclude: dark ? "#fb923c" : "#c2410c" })[role] || theme.accent; // prettier-ignore
  const chip = (active, extra = {}) => chipStyle(theme, active, extra);
  const iconBtn = (extra = {}) => iconButtonStyle(theme, { width: 26, height: 26, ...extra });
  const preset = selected?.shape === "Star" ? SHAPE_PRESETS.Star : null;
  const px = pxScale; // one screen pixel in design mm
  const groupLabel = { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.9, color: theme.textMuted, fontFamily: MONO, marginBottom: 6 }; // prettier-ignore

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shape editor"
      ref={dialogRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
      }}
      onPointerDown={e => {
        if (e.target === e.currentTarget) ui.setShapeEditorOpen(false);
      }}
    >
      <div
        className="pg-pop-in"
        style={{
          width: 960,
          maxWidth: "95vw",
          height: "min(720px, 92vh)",
          display: "flex",
          flexDirection: "column",
          background: theme.panelBg,
          color: theme.textPrimary,
          borderRadius: 16,
          boxShadow: theme.menuShadow,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderBottom: `1px solid ${theme.sectionBorder}`,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            Shape editor
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={undo}
            disabled={!historySize.past}
            title="Undo (Ctrl+Z)"
            aria-label="Undo in the shape editor"
            style={iconBtn({ opacity: historySize.past ? 1 : 0.4 })}
          >
            <Undo2 size={12} />
          </button>
          <button
            onClick={redo}
            disabled={!historySize.future}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo in the shape editor"
            style={iconBtn({ opacity: historySize.future ? 1 : 0.4 })}
          >
            <Redo2 size={12} />
          </button>
          <button onClick={() => ui.setShapeEditorOpen(false)} aria-label="Close the shape editor" style={iconBtn()}>
            <X size={13} />
          </button>
        </div>

        <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
          {/* Shape toolbar */}
          <div
            style={{
              width: 52,
              borderRight: `1px solid ${theme.sectionBorder}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "10px 8px",
            }}
          >
            {LAYER_SHAPES.map(shape => {
              const Icon = SHAPE_ICON[shape];
              const full = layers.length >= MAX_SHAPE_LAYERS;
              return (
                <button
                  key={shape}
                  className="pg-rail-btn pg-tooltip"
                  data-tip={`Add ${shape.toLowerCase()}`}
                  onClick={() => add(shape)}
                  disabled={full}
                  aria-label={`Add ${shape.toLowerCase()} layer`}
                  style={{ ...iconBtn({ width: 34, height: 34, border: "none", background: "transparent", color: theme.textSecondary, borderRadius: 8 }), opacity: full ? 0.4 : 1 }} // prettier-ignore
                >
                  <Icon size={16} strokeWidth={1.8} />
                </button>
              );
            })}
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <svg
              ref={svgRef}
              viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                width: "100%",
                flex: 1,
                minHeight: 320,
                background: theme.canvasBg,
                borderRadius: 10,
                cursor: dragging ? "grabbing" : hoverId ? "move" : "default",
                touchAction: "none",
                border: `1px solid ${theme.sectionBorder}`,
              }}
              aria-label="Shape preview"
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              onPointerCancel={onCanvasPointerUp}
              onPointerLeave={() => setHoverId(null)}
              onDoubleClick={onCanvasDoubleClick}
            >
              <defs>
                <pattern id="pg-grid" width="5" height="5" patternUnits="userSpaceOnUse">
                  <circle cx="0" cy="0" r={0.6 * px} fill={dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} />
                </pattern>
              </defs>
              <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="url(#pg-grid)" />
              {/* Axes through the origin the hole is centred on. */}
              <line
                x1={frame.x}
                x2={frame.x + frame.w}
                y1={0}
                y2={0}
                stroke={theme.textFaint}
                strokeWidth={px}
                strokeDasharray={`${4 * px} ${4 * px}`}
              />
              <line
                y1={frame.y}
                y2={frame.y + frame.h}
                x1={0}
                x2={0}
                stroke={theme.textFaint}
                strokeWidth={px}
                strokeDasharray={`${4 * px} ${4 * px}`}
              />
              {/* The composed hole, as it will be cut. */}
              {composed.map((polygon, i) => (
                <path
                  key={i}
                  d={ringsSVGPath(polygon, 0, 0)}
                  fill={dark ? "#d4d4d8" : "#18181b"}
                  fillOpacity={0.92}
                  fillRule="evenodd"
                  style={{ transition: transition("fill-opacity") }}
                />
              ))}
              {/* Every layer's outline in its role's colour. */}
              {layers.map(layer => {
                const rings = layerRings(layer);
                const active = layer.id === selected?.id;
                const hovered = layer.id === hoverId;
                const colour = roleColour(layer.role);
                return (
                  <path
                    key={layer.id}
                    d={ringsSVGPath(rings, 0, 0)}
                    fill={colour}
                    fillOpacity={active ? 0.14 : hovered ? 0.1 : 0.05}
                    stroke={colour}
                    strokeWidth={px * (active ? 1.6 : hovered ? 1.3 : 1)}
                    strokeDasharray={layer.role === "subtract" ? `${px * 3} ${px * 2}` : undefined}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}
              {/* The selected layer's handles, Figma-style: a bounding box,
                  square corners, a knob above. */}
              {
                selected && selected.shape !== "Polygon" &&
                <SelectionBox layer={selected} px={px} colour={theme.accent} ink={dark ? "#15151a" : "#fff"} knob={KNOB_PX} /> // prettier-ignore
              }
              {selected &&
                selected.shape === "Polygon" &&
                layerHandles(selected).map(h => (
                  <rect
                    key={h.id}
                    x={h.x - 3.5 * px}
                    y={h.y - 3.5 * px}
                    width={7 * px}
                    height={7 * px}
                    fill={dark ? "#15151a" : "#fff"}
                    stroke={theme.accent}
                    strokeWidth={1.4 * px}
                    style={{ pointerEvents: "none" }}
                  />
                ))}
            </svg>
            <div
              style={{
                fontSize: 10,
                color: theme.textSecondary,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>
                {empty
                  ? "Nothing is left of the hole — add a shape, or change a role."
                  : `${composed.length} ${composed.length === 1 ? "piece" : "pieces"} · ${extent.area.toFixed(1)} mm² of design`}
              </span>
              <span style={{ color: theme.textMuted, whiteSpace: "nowrap" }}>
                drag to move · corners resize · knob turns · <span style={kbdStyle(theme)}>Shift</span> constrains ·{" "}
                <span style={kbdStyle(theme)}>Del</span> removes
              </span>
            </div>
          </div>

          {/* Layers and properties */}
          <div
            style={{
              width: 300,
              borderLeft: `1px solid ${theme.sectionBorder}`,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflowY: "auto",
              background: theme.cardBg,
            }}
          >
            <div style={{ ...groupLabel, display: "flex", justifyContent: "space-between" }}>
              <span>
                Layers ({layers.length}/{MAX_SHAPE_LAYERS})
              </span>
              <span style={{ color: theme.textFaint }}>top of the stack last</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {layers.map((layer, index) => {
                const active = layer.id === selected?.id;
                const Icon = SHAPE_ICON[layer.shape] || Circle;
                const colour = roleColour(layer.role);
                return (
                  <div key={layer.id} style={{ display: "flex", gap: 3 }}>
                    <button
                      className="pg-hover"
                      onClick={() => setSelectedId(layer.id)}
                      onMouseEnter={() => setHoverId(layer.id)}
                      onMouseLeave={() => setHoverId(null)}
                      aria-label={`Select layer ${index + 1}`}
                      aria-pressed={active}
                      style={chip(active, { flex: 1, height: 28, display: "flex", alignItems: "center", gap: 7, padding: "0 8px" })} // prettier-ignore
                    >
                      <span
                        aria-hidden="true"
                        style={{ width: 7, height: 7, borderRadius: 2, background: colour, flexShrink: 0 }}
                      />
                      <Icon size={11} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, textAlign: "left" }}>{layer.shape.toLowerCase()}</span>
                      <span style={{ color: theme.textMuted }}>{LAYER_ROLE_INFO[layer.role]?.label.toLowerCase()}</span>
                    </button>
                    <button
                      onClick={() => move(layer.id, -1)}
                      aria-label={`Move layer ${index + 1} up`}
                      style={iconBtn({ height: 28 })}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={() => move(layer.id, 1)}
                      aria-label={`Move layer ${index + 1} down`}
                      style={iconBtn({ height: 28 })}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={() => remove(layer.id)}
                      aria-label={`Remove layer ${index + 1}`}
                      style={iconBtn({ height: 28, color: theme.warn })}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {selected && (
              <div style={{ borderTop: `1px solid ${theme.sectionBorder}`, paddingTop: 10 }}>
                <div style={groupLabel}>Pathfinder</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 10 }}>
                  {LAYER_ROLES.map(role => {
                    const active = selected.role === role;
                    const colour = roleColour(role);
                    return (
                      <button
                        key={role}
                        onClick={() => update(selected.id, { role })}
                        aria-label={`${LAYER_ROLE_INFO[role].label} role`}
                        aria-pressed={active}
                        title={LAYER_ROLE_INFO[role].hint}
                        style={chip(active, {
                          height: 46,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 3,
                          borderColor: active ? `${colour}88` : theme.border,
                          background: active ? `${colour}1f` : "transparent",
                          color: active ? colour : theme.textSecondary,
                        })}
                      >
                        <RoleGlyph role={role} colour={active ? colour : theme.textMuted} />
                        <span style={{ fontSize: 9 }}>{LAYER_ROLE_INFO[role].label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  <button
                    className="pg-hover"
                    onClick={duplicate}
                    disabled={layers.length >= MAX_SHAPE_LAYERS}
                    aria-label="Duplicate the selected layer"
                    style={{ ...ghostButtonStyle(theme, { flex: 1 }), display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} // prettier-ignore
                  >
                    <Copy size={11} /> Duplicate
                  </button>
                  <button
                    className="pg-hover"
                    onClick={() => update(selected.id, { x: 0, y: 0 })}
                    disabled={selected.shape === "Polygon"}
                    aria-label="Centre the selected layer"
                    style={ghostButtonStyle(theme, { flex: 1, opacity: selected.shape === "Polygon" ? 0.4 : 1 })}
                  >
                    Centre on origin
                  </button>
                </div>
                {selected.shape !== "Polygon" ? (
                  <>
                    <div style={groupLabel}>Position and size</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <SliderRow
                        label="Layer X"
                        value={selected.x}
                        min={-50}
                        max={50}
                        step={0.5}
                        onChange={x => update(selected.id, { x })}
                        unit="mm"
                        dark={dark}
                      />
                      <SliderRow
                        label="Layer Y"
                        value={selected.y}
                        min={-50}
                        max={50}
                        step={0.5}
                        onChange={y => update(selected.id, { y })}
                        unit="mm"
                        dark={dark}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <SliderRow
                        label="Layer Width"
                        value={selected.w}
                        min={0.5}
                        max={60}
                        step={0.5}
                        onChange={w => update(selected.id, { w })}
                        unit="mm"
                        dark={dark}
                      />
                      <SliderRow
                        label="Layer Height"
                        value={selected.h}
                        min={0.5}
                        max={60}
                        step={0.5}
                        onChange={h => update(selected.id, { h })}
                        unit="mm"
                        dark={dark}
                      />
                    </div>
                    <SliderRow
                      label="Layer Rotation"
                      value={selected.rotation}
                      min={-180}
                      max={180}
                      step={1}
                      onChange={rotation => update(selected.id, { rotation })}
                      unit="°"
                      dark={dark}
                    />
                    {
                      selected.shape === "Rectangle" &&
                      <SliderRow label="Layer Corner Rounding" value={selected.ratio} min={0} max={1} step={0.01} onChange={ratio => update(selected.id, { ratio })} dark={dark} /> // prettier-ignore
                    }
                    {preset && (
                      <>
                        <SliderRow
                          label={`Layer ${preset.ratio.label}`}
                          value={selected.ratio}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={ratio => update(selected.id, { ratio })}
                          dark={dark}
                        />
                        <SliderRow
                          label={`Layer ${preset.count.label}`}
                          value={selected.count}
                          min={preset.count.min}
                          max={preset.count.max}
                          step={1}
                          onChange={count => update(selected.id, { count: Math.round(count) })}
                          dark={dark}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 1.6 }}>
                    Polygon · {selected.points.length} vertices, edited on the canvas.
                  </div>
                )}
              </div>
            )}
            {!selected && (
              <div style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 1.6 }}>No shape selected.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "10px 14px",
            borderTop: `1px solid ${theme.sectionBorder}`,
          }}
        >
          {applyError && (
            <span role="alert" style={{ color: theme.warn, fontSize: 11, marginRight: "auto" }}>
              {applyError}
            </span>
          )}
          <button
            onClick={() => ui.setShapeEditorOpen(false)}
            aria-label="Cancel the shape editor"
            style={chip(false, { padding: "7px 14px" })}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setApplyError("");
              try {
                actions.applyShapeLayers(layers);
              } catch (error) {
                setApplyError(error.message);
              }
            }}
            disabled={empty}
            aria-label="Apply the shape editor"
            style={chip(true, { padding: "7px 14px", opacity: empty ? 0.4 : 1, display: "flex", alignItems: "center", gap: 5 })} // prettier-ignore
          >
            <Check size={11} /> Use as hole shape
          </button>
        </div>
      </div>
    </div>
  );
}

// The selection frame of a parametric layer: its rotated box, four square
// corner grips and the rotation knob on a stalk above the top edge.
function SelectionBox({ layer, px, colour, ink, knob }) {
  const handles = layerHandles(layer, knob * px);
  const corners = handles.filter(h => h.role === "corner");
  const rotate = handles.find(h => h.role === "rotate");
  const top = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
  const grip = 3.5 * px;
  return (
    <g style={{ pointerEvents: "none" }}>
      <polygon
        points={corners.map(c => `${c.x},${c.y}`).join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth={px}
        opacity={0.9}
      />
      <line x1={top.x} y1={top.y} x2={rotate.x} y2={rotate.y} stroke={colour} strokeWidth={px} opacity={0.7} />
      <circle cx={rotate.x} cy={rotate.y} r={4 * px} fill={ink} stroke={colour} strokeWidth={1.4 * px} />
      {corners.map(
        c =>
        <rect key={c.id} x={c.x - grip} y={c.y - grip} width={2 * grip} height={2 * grip} fill={ink} stroke={colour} strokeWidth={1.4 * px} /> // prettier-ignore
      )}
    </g>
  );
}
