import { useEditor } from "./EditorContext.jsx";
import { ProjectPanel } from "./panels/ProjectPanel.jsx";
import { PatternPanel } from "./panels/PatternPanel.jsx";
import { DimensionsPanel } from "./panels/DimensionsPanel.jsx";
import { BoundaryPanel } from "./panels/BoundaryPanel.jsx";
import { VariationPanel } from "./panels/VariationPanel.jsx";
import { FieldsPanel } from "./panels/FieldsPanel.jsx";
import { TaperPanel } from "./panels/TaperPanel.jsx";
import { HoleRemovalPanel } from "./panels/HoleRemovalPanel.jsx";
import { ColorsPanel } from "./panels/ColorsPanel.jsx";
import { ExportPanel } from "./panels/ExportPanel.jsx";
import { MONO } from "./theme.js";

// The inspector's sections, by id. The rail unfolds the one that owns the mode
// it enters, and `ui.closedSections` remembers which are folded.
export const SECTION_IDS = {
  project: "project",
  pattern: "pattern",
  dimensions: "dimensions",
  boundary: "boundary",
  variation: "variation",
  fields: "fields",
  taper: "taper",
  removal: "removal",
  colors: "colors",
  export: "export",
};

// The inspector (right): the document's numbers, grouped the way the work
// goes — what the pattern is, where it goes, how it varies, how it is made.
// Uniform 8 px padding on the shell; the inner scroller bleeds 5 px into the
// right padding so the scrollbar overlays it and content stays inset 8 px.
export function Sidebar() {
  const { theme } = useEditor();
  const group = label => (
    <div
      style={{
        fontSize: 9,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: theme.textFaint,
        fontFamily: MONO,
        padding: "10px 6px 6px",
      }}
    >
      {label}
    </div>
  );
  return (
    <div
      style={{
        width: 400,
        minWidth: 400,
        height: "100%",
        background: theme.panelBg,
        borderRadius: 16,
        boxShadow: theme.floatShadow,
        padding: 8,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          marginRight: -5,
          paddingRight: 5,
          scrollbarWidth: "thin",
          scrollbarColor: `${theme.scrollbar} transparent`,
        }}
      >
        <ProjectPanel />
        {group("Pattern")}
        <PatternPanel />
        <DimensionsPanel />
        <BoundaryPanel />
        {group("Fields")}
        <VariationPanel />
        <FieldsPanel />
        {group("Manufacturing")}
        <TaperPanel />
        <HoleRemovalPanel />
        <ColorsPanel />
        <ExportPanel />
      </div>
    </div>
  );
}
