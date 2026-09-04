import { DIN_PRESETS, HOLE_SHAPES, PATTERN_TYPES } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { Dropdown } from "../controls/index.js";
import { Section } from "./Section.jsx";

export function PatternPanel() {
  const { doc, api, theme, actions } = useEditor();
  return (
    <Section title="Pattern & Hole" theme={theme}>
      <Dropdown label="Preset (DIN 24041)" value={doc.presetIndex} onChange={v => actions.applyPreset(parseInt(v))}
        options={DIN_PRESETS.map((p, i) => ({ value: i, label: p.name }))} theme={theme} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Dropdown label="Type" value={doc.layout.type} onChange={v => api.patch({ "layout.type": v, presetIndex: 0 })} options={PATTERN_TYPES} theme={theme} />
        <Dropdown label="Hole Shape" value={doc.hole.shape} onChange={actions.setShape} options={HOLE_SHAPES} theme={theme} />
      </div>
    </Section>
  );
}
