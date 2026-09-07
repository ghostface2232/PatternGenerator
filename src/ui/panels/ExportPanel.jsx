import { Download, Settings2 } from "lucide-react";
import { useEditor } from "../EditorContext.jsx";
import { actionButtonStyle, ghostButtonStyle } from "../controls/index.js";
import { Section, hintStyle } from "./Section.jsx";

// One-click exports with the defaults (visual SVG, DXF in mm, PNG at 8 px/mm),
// and the way to the dialog for everything else — units, layers, kerf.
export function ExportPanel() {
  const { theme, exportSVG, exportPNG, exportDXF, openExport } = useEditor();
  return (
    <Section id="export" title="Export" theme={theme} last>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[
          ["SVG", exportSVG],
          ["DXF", exportDXF],
          ["PNG 2x", exportPNG],
        ].map(([label, fn]) => (
          <button
            key={label}
            className="pg-hover"
            onClick={fn}
            style={actionButtonStyle(theme, false, { flex: 1, fontWeight: 500, fontSize: 11 })}
          >
            <Download size={11} /> {label}
          </button>
        ))}
      </div>
      <button
        className="pg-hover"
        onClick={openExport}
        aria-label="Open the export dialog"
        style={{ ...ghostButtonStyle(theme, { width: "100%", height: 28 }), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} // prettier-ignore
      >
        <Settings2 size={11} /> Units, layers, kerf… · Ctrl E
      </button>
      <div style={{ ...hintStyle(theme), marginTop: 8, marginBottom: 0 }}>
        The quick buttons use the defaults. Cutting files and kerf compensation live in the dialog.
      </div>
    </Section>
  );
}
