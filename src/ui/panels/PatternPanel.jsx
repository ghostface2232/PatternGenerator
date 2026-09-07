import { useRef, useState } from "react";
import { Layers, Upload } from "lucide-react";
import { CUSTOM_SHAPE, DIN_PRESETS, HOLE_SHAPES, MORPH_SHAPE, PATTERN_TYPES } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { Dropdown, SliderRow, ghostButtonStyle } from "../controls/index.js";
import { Section, hintStyle } from "./Section.jsx";

export function PatternPanel() {
  const { doc, api, theme, ui, actions, geometry } = useEditor();
  const fileInput = useRef(null);
  const [importError, setImportError] = useState("");
  const isCustom = doc.hole.shape === CUSTOM_SHAPE;
  const custom = doc.hole.custom;
  const importFile = async file => {
    if (!file) return;
    setImportError("");
    try {
      await actions.importHoleSVG(file);
    } catch (err) {
      setImportError(`Could not use ${file.name}: ${err.message}`);
    }
  };
  const smallButton = ghostButtonStyle(theme, {
    flex: 1,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  });
  // Voronoi cuts each hole to its own cell and Flow Lines cuts a slot along each
  // streamline, so in those two the shape dropdown below is not driving anything
  // — and saying so is better than leaving someone to work out why changing it
  // does nothing.
  const imposedShape = geometry.holeShape !== doc.hole.shape;
  const morph = geometry.holeShape === MORPH_SHAPE;
  const mix = doc.hole.shapeMix;
  return (
    <Section id="pattern" title="Pattern & Hole" theme={theme}>
      <Dropdown
        label="Preset (DIN 24041)"
        value={doc.presetIndex}
        onChange={v => actions.applyPreset(parseInt(v))}
        options={DIN_PRESETS.map((p, i) => ({ value: i, label: p.name }))}
        theme={theme}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Dropdown
          label="Type"
          value={doc.layout.type}
          onChange={v => api.patch({ "layout.type": v, presetIndex: 0 })}
          options={PATTERN_TYPES}
          theme={theme}
        />
        <Dropdown
          label="Hole Shape"
          value={doc.hole.shape}
          onChange={actions.setShape}
          options={HOLE_SHAPES}
          theme={theme}
        />
      </div>
      {/* The Custom shape is an outline of the user's own: read from an SVG
          file here. It stays in the document whichever shape is picked, so
          coming back to Custom finds it again. */}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button
          onClick={() => fileInput.current?.click()}
          aria-label="Import an SVG outline as the hole shape"
          title="The closed outlines of an SVG file become the Custom hole shape"
          style={smallButton}
        >
          <Upload size={11} /> Import SVG shape
        </button>
        <button
          onClick={() => ui.setShapeEditorOpen(true)}
          aria-label="Open the shape editor"
          title="Stack basic shapes that add to or cut from the hole"
          style={smallButton}
        >
          <Layers size={11} /> Shape editor
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".svg,image/svg+xml"
        aria-label="Hole outline file"
        style={{ display: "none" }}
        onChange={e => {
          importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {importError && <div style={{ ...hintStyle(theme), color: theme.warn, marginTop: 8 }}>{importError}</div>}
      {isCustom && !imposedShape && (
        <div style={{ ...hintStyle(theme), marginTop: 8 }}>
          {custom.kind === "none"
            ? "No custom outline yet, so the hole is a square. Import an SVG file to give it one."
            : `${custom.name || "outline"} · ${custom.rings.length} ${custom.rings.length === 1 ? "outline" : "outlines"} · ${custom.rings.reduce((n, r) => n + r.length, 0)} vertices, from ${custom.kind === "svg" ? "an SVG file" : "the shape editor"}.`}
        </div>
      )}
      {imposedShape && (
        <div style={{ marginTop: 10 }}>
          <div style={hintStyle(theme)}>
            {doc.layout.type === "Voronoi"
              ? "Voronoi gives every hole its own cell outline, so the hole shape is not used. The hole size sets how big a cell is, and the edge gap sets the metal left between two of them."
              : "Flow Lines cuts a slot along each streamline, so the hole shape is not used. The hole size sets how wide a slot is, and the edge gap sets the metal left between two of them."}
          </div>
        </div>
      )}
      {/* The superellipse is the one shape with a free parameter, and the same
          one the `shape` field channel morphs — this slider sets where a hole
          with no controller over it sits. */}
      {morph && (
        <div style={{ marginTop: 12 }}>
          <SliderRow
            label="Shape Mix"
            value={mix}
            min={0}
            max={1}
            step={0.01}
            onChange={value => api.set("hole.shapeMix", value, { merge: "hole.shapeMix" })}
            unit={mix < 0.25 ? "diamond" : mix < 0.4 ? "→ ellipse" : mix < 0.6 ? "ellipse" : mix < 0.85 ? "→ square" : "square"} // prettier-ignore
            dark={theme.dark}
          />
        </div>
      )}
    </Section>
  );
}
