import { DIN_PRESETS, HOLE_SHAPES, MORPH_SHAPE, PATTERN_TYPES } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { Dropdown, SliderRow } from "../controls/index.js";
import { Section } from "./Section.jsx";

export function PatternPanel() {
  const { doc, api, theme, actions } = useEditor();
  const morph = doc.hole.shape === MORPH_SHAPE;
  const mix = doc.hole.shapeMix;
  return (
    <Section title="Pattern & Hole" theme={theme}>
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
