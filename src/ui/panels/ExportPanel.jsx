import { Download, Settings2 } from "lucide-react";
import { useEditor } from "../EditorContext.jsx";
import { actionButtonStyle, ghostButtonStyle } from "../controls/index.js";
import { Section, groupLabelStyle } from "./Section.jsx";

// One-click exports with the defaults (visual SVG, DXF in mm, PNG at 8 px/mm),
// and the way to the dialog for everything else — units, layers, kerf. Above
// the buttons, what the file will hold: the last look before it leaves.
export function ExportPanel() {
  const { doc, theme, geometry: g, stats, exportSVG, exportPNG, exportDXF, openExport } = useEditor();
  const { sheet, hole, layout, boundary, taper } = doc;
  const size = g.hasCustomSize ? `${g.effW.toFixed(1)} × ${g.effH.toFixed(1)} mm` : `⌀ ${hole.diameter.toFixed(1)} mm`;
  const outline =
    boundary.shape === "Rectangle" && !boundary.cutouts.length && !g.boundaryClips
      ? "the whole sheet"
      : `${boundary.shape.toLowerCase()}${boundary.cutouts.length ? ` · ${boundary.cutouts.length} cutout${boundary.cutouts.length > 1 ? "s" : ""}` : ""}${boundary.trim ? " · trimmed" : ""}`;
  const lines = [
    ["Sheet", `${sheet.w} × ${sheet.h} mm`],
    ["Pattern", `${layout.type} · ${g.holeShape}`],
    ["Hole", size],
    ["Holes", stats.activeHoleCount.toLocaleString()],
    ["Open area", `${stats.displayOAR.toFixed(1)} %`],
    ["Perforated", outline],
    ...(g.taperActive ? [["Taper", `${taper.thickness} mm · ${taper.angle}°`]] : []),
  ];
  const row = ([label, value]) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0" }}>
      <span style={{ fontSize: 10, color: theme.textSecondary }}>{label}</span>
      <span
        style={{ fontSize: 10.5, color: theme.textPrimary, fontVariantNumeric: "tabular-nums", textAlign: "right" }}
      >
        {value}
      </span>{" "}
      {/* prettier-ignore */}
    </div>
  );
  return (
    <Section id="export" title="Export" theme={theme} last>
      <div style={groupLabelStyle(theme)}>What goes out</div>
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          background: theme.accentBgSoft,
          border: `1px solid ${theme.sectionBorder}`,
          marginBottom: 12,
        }}
      >
        {lines.map(row)}
      </div>
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
    </Section>
  );
}
