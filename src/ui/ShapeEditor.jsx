import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Minus, Plus, X } from "lucide-react";
import { MAX_SHAPE_LAYERS } from "../core/constants.js";
import { LAYER_SHAPES, composeLayers, createShapeLayer, designExtent, layerRings } from "../geometry/custom-shape.js";
import { ringsSVGPath } from "../geometry/rings.js";
import { SHAPE_PRESETS } from "../geometry/shape-presets.js";
import { useEditor } from "./EditorContext.jsx";
import { SliderRow, Toggle } from "./controls/index.js";
import { MONO } from "./theme.js";

// The boolean shape editor: a modal where basic shapes are stacked, each
// adding to the hole or cutting from it, and the composed outline becomes the
// Custom hole shape. The stack is local state until Apply, which writes it and
// the composed rings to the document as one undo step; Cancel drops it.
export function ShapeEditor() {
  const { doc, theme, ui, actions } = useEditor();
  const { dark } = theme;
  const initial = doc.hole.custom.layers.length
    ? doc.hole.custom.layers
    : [{ ...createShapeLayer("Circle"), w: 12, h: 12 }];
  const [layers, setLayers] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? null);
  const selected = layers.find(l => l.id === selectedId) ?? layers[0] ?? null;
  const composed = useMemo(() => composeLayers(layers), [layers]);
  const extent = useMemo(() => designExtent(layers), [layers]);
  const empty = composed.length === 0;

  // The preview's frame: the design's box with a margin, or a default square
  // when nothing is placed.
  const frame = useMemo(() => {
    const { box } = extent;
    const w = box.right - box.left,
      h = box.bottom - box.top;
    if (!(w > 0) || !(h > 0)) return { x: -12, y: -12, w: 24, h: 24 };
    const pad = Math.max(w, h) * 0.12 + 1;
    return { x: box.left - pad, y: box.top - pad, w: w + 2 * pad, h: h + 2 * pad };
  }, [extent]);

  const update = (id, patch) => setLayers(current => current.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const remove = id => {
    setLayers(current => {
      const rest = current.filter(l => l.id !== id);
      if (id === selectedId) setSelectedId(rest[0]?.id ?? null);
      return rest;
    });
  };
  const add = shape => {
    if (layers.length >= MAX_SHAPE_LAYERS) return;
    const layer = createShapeLayer(shape, layers);
    // A second shape lands beside the first rather than on top of it, so it
    // is visibly a second shape.
    const { box } = extent;
    if (layers.length) layer.x = Math.round(box.right + layer.w / 2 + 1);
    setLayers(current => [...current, layer]);
    setSelectedId(layer.id);
  };
  const move = (id, by) =>
    setLayers(current => {
      const index = current.findIndex(l => l.id === id);
      const target = index + by;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const accent = theme.accent;
  const cut = theme.warn;
  const chip = (active, extra = {}) => ({
    border: `1px solid ${active ? accent : theme.border}`,
    borderRadius: 4,
    background: active ? theme.accentBg : "transparent",
    color: active ? accent : theme.textSecondary,
    fontSize: 9,
    cursor: "pointer",
    fontFamily: MONO,
    padding: "6px 4px",
    ...extra,
  });
  const iconBtn = (extra = {}) => ({
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    background: theme.controlBg,
    color: theme.textPrimary,
    cursor: "pointer",
    padding: 0,
    ...extra,
  });
  const strokeWidth = frame.w / 220;
  const preset = selected?.shape === "Star" ? SHAPE_PRESETS.Star : null;

  return (
    <div
      role="dialog"
      aria-label="Shape editor"
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
        style={{
          width: 820,
          maxWidth: "94vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: theme.panelBg,
          color: theme.textPrimary,
          borderRadius: 14,
          boxShadow: theme.menuShadow,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: `1px solid ${theme.sectionBorder}`,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              Shape editor
            </div>
            <div style={{ fontSize: 9, color: theme.textSecondary, marginTop: 2 }}>
              Stack basic shapes; each one adds to the hole or cuts from it. The composed outline becomes the Custom
              hole shape, sized by the hole's width and height.
            </div>
          </div>
          <button onClick={() => ui.setShapeEditorOpen(false)} aria-label="Close the shape editor" style={iconBtn()}>
            <X size={13} />
          </button>
        </div>

        <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
          {/* Preview */}
          <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <svg
              viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
              style={{ width: "100%", flex: 1, minHeight: 320, background: theme.canvasBg, borderRadius: 8 }}
              aria-label="Shape preview"
            >
              {/* The composed hole, as it will be cut. */}
              {composed.map((polygon, i) => (
                <path
                  key={i}
                  d={ringsSVGPath(polygon, 0, 0)}
                  fill={dark ? "#c8c8cd" : "#18181b"}
                  fillOpacity={0.9}
                  fillRule="evenodd"
                />
              ))}
              {/* Every layer's outline: adds in the accent, cuts in the warning colour. */}
              {layers.map(layer => {
                const rings = layerRings(layer);
                const active = layer.id === selected?.id;
                const colour = layer.role === "subtract" ? cut : accent;
                return (
                  <path
                    key={layer.id}
                    d={ringsSVGPath(rings, 0, 0)}
                    fill={colour}
                    fillOpacity={active ? 0.16 : 0.06}
                    stroke={colour}
                    strokeWidth={strokeWidth * (active ? 2 : 1)}
                    strokeDasharray={layer.role === "subtract" ? `${strokeWidth * 3} ${strokeWidth * 2}` : undefined}
                    style={{ cursor: "pointer" }}
                    onPointerDown={() => setSelectedId(layer.id)}
                  />
                );
              })}
            </svg>
            <div style={{ fontSize: 9, color: theme.textSecondary, display: "flex", justifyContent: "space-between" }}>
              <span>
                {empty
                  ? "Nothing is left of the hole — add a shape, or make one of them add rather than cut."
                  : `${composed.length} ${composed.length === 1 ? "piece" : "pieces"} · ${extent.area.toFixed(1)} mm² of design`}
              </span>
              <span>design millimetres</span>
            </div>
          </div>

          {/* Layers */}
          <div
            style={{
              width: 300,
              borderLeft: `1px solid ${theme.sectionBorder}`,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflowY: "auto",
              background: theme.cardBg,
            }}
          >
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, color: theme.textSecondary }}>
              Add ({layers.length}/{MAX_SHAPE_LAYERS})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {LAYER_SHAPES.map(shape => (
                <button
                  key={shape}
                  onClick={() => add(shape)}
                  disabled={layers.length >= MAX_SHAPE_LAYERS}
                  aria-label={`Add ${shape.toLowerCase()} layer`}
                  style={chip(false, { opacity: layers.length >= MAX_SHAPE_LAYERS ? 0.4 : 1 })}
                >
                  {shape.toLowerCase()}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {layers.map((layer, index) => {
                const active = layer.id === selected?.id;
                return (
                  <div key={layer.id} style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => setSelectedId(layer.id)}
                      aria-label={`Select layer ${index + 1}`}
                      aria-pressed={active}
                      style={chip(active, { flex: 1, height: 26, display: "flex", alignItems: "center", gap: 6, padding: "0 8px" })} // prettier-ignore
                    >
                      {layer.role === "subtract" ? <Minus size={10} color={cut} /> : <Plus size={10} color={accent} />}
                      <span style={{ flex: 1, textAlign: "left" }}>{layer.shape.toLowerCase()}</span>
                      <span>
                        {layer.w.toFixed(1)}×{layer.h.toFixed(1)}
                      </span>
                    </button>
                    <button
                      onClick={() => move(layer.id, -1)}
                      aria-label={`Move layer ${index + 1} up`}
                      style={iconBtn()}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={() => move(layer.id, 1)}
                      aria-label={`Move layer ${index + 1} down`}
                      style={iconBtn()}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      onClick={() => remove(layer.id)}
                      aria-label={`Remove layer ${index + 1}`}
                      style={iconBtn({ color: theme.warn })}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {selected && (
              <div style={{ borderTop: `1px solid ${theme.sectionBorder}`, paddingTop: 10 }}>
                <label
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}
                >
                  <span style={{ fontSize: 11, color: theme.textSecondary }}>
                    {selected.role === "subtract" ? "Cuts from the hole" : "Adds to the hole"}
                  </span>
                  <Toggle
                    value={selected.role === "subtract"}
                    onChange={v => update(selected.id, { role: v ? "subtract" : "union" })}
                    dark={dark}
                    label="Layer cuts from the hole"
                  />
                </label>
                {selected.shape !== "Polygon" ? (
                  <>
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
                      />{" "}
                      {/* prettier-ignore */}
                      <SliderRow label="Layer Y" value={selected.y} min={-50} max={50} step={0.5} onChange={y => update(selected.id, { y })} unit="mm" dark={dark} />{" "}
                      {/* prettier-ignore */}
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
                      />{" "}
                      {/* prettier-ignore */}
                      <SliderRow label="Layer Height" value={selected.h} min={0.5} max={60} step={0.5} onChange={h => update(selected.id, { h })} unit="mm" dark={dark} />{" "}
                      {/* prettier-ignore */}
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
                    />{" "}
                    {/* prettier-ignore */}
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
                        />{" "}
                        {/* prettier-ignore */}
                        <SliderRow label={`Layer ${preset.count.label}`} value={selected.count} min={preset.count.min} max={preset.count.max} step={1} onChange={count => update(selected.id, { count: Math.round(count) })} dark={dark} />{" "}
                        {/* prettier-ignore */}
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 9, color: theme.textSecondary, lineHeight: 1.6 }}>
                    A polygon layer keeps the vertices it was given ({selected.points.length}); the shapes above are the
                    ones to move and size here.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "10px 16px",
            borderTop: `1px solid ${theme.sectionBorder}`,
          }}
        >
          <button
            onClick={() => ui.setShapeEditorOpen(false)}
            aria-label="Cancel the shape editor"
            style={chip(false, { padding: "7px 14px" })}
          >
            {" "}
            {/* prettier-ignore */}
            Cancel
          </button>
          <button
            onClick={() => actions.applyShapeLayers(layers)}
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
