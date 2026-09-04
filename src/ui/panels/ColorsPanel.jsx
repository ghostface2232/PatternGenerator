import { useEditor } from "../EditorContext.jsx";
import { ColorField } from "../controls/index.js";
import { Section } from "./Section.jsx";

export function ColorsPanel() {
  const { doc, api, theme } = useEditor();
  return (
    <Section title="Colors" theme={theme}>
      <div style={{ display: "flex", gap: 16 }}>
        <ColorField
          label="Hole Color"
          value={doc.appearance.holeColor}
          onChange={v => api.set("appearance.holeColor", v)}
          dark={theme.dark}
        />
        <ColorField
          label="Background"
          value={doc.appearance.bgColor}
          onChange={v => api.set("appearance.bgColor", v)}
          dark={theme.dark}
        />
      </div>
    </Section>
  );
}
