import { Download } from "lucide-react";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";
import { Section } from "./Section.jsx";

export function ExportPanel() {
  const { theme, exportSVG, exportPNG } = useEditor();
  return (
    <Section title="Export" theme={theme} last>
      <div style={{ display: "flex", gap: 6 }}>
        {[["SVG", exportSVG], ["PNG 2x", exportPNG]].map(([label, fn]) => (
          <button key={label} onClick={fn} style={{
            flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: theme.btnBg, color: theme.textPrimary, border: "none", borderRadius: 5,
            cursor: "pointer", fontFamily: MONO
          }}
            onMouseEnter={e => e.currentTarget.style.background = theme.btnHover}
            onMouseLeave={e => e.currentTarget.style.background = theme.btnBg}>
            <Download size={11} /> {label}
          </button>
        ))}
      </div>
    </Section>
  );
}
