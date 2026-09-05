import { useEditor } from "./EditorContext.jsx";
import { ProjectPanel } from "./panels/ProjectPanel.jsx";
import { PatternPanel } from "./panels/PatternPanel.jsx";
import { DimensionsPanel } from "./panels/DimensionsPanel.jsx";
import { VariationPanel } from "./panels/VariationPanel.jsx";
import { FieldsPanel } from "./panels/FieldsPanel.jsx";
import { TaperPanel } from "./panels/TaperPanel.jsx";
import { HoleRemovalPanel } from "./panels/HoleRemovalPanel.jsx";
import { ColorsPanel } from "./panels/ColorsPanel.jsx";
import { ExportPanel } from "./panels/ExportPanel.jsx";

// Floating sidebar (left): uniform 8px padding on the shell; the inner scroller
// bleeds 5px into the right padding so the scrollbar overlays it — content stays
// inset 8px on every side.
export function Sidebar() {
  const { theme } = useEditor();
  return (
    <div
      style={{
        width: 440,
        minWidth: 440,
        height: "100%",
        order: 1,
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
        <PatternPanel />
        <DimensionsPanel />
        <VariationPanel />
        <FieldsPanel />
        <TaperPanel />
        <HoleRemovalPanel />
        <ColorsPanel />
        <ExportPanel />
      </div>
    </div>
  );
}
