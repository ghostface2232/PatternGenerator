import { Download, Eraser, FolderOpen, Layers2, LayoutGrid, Route, Scan, Waves } from "lucide-react";
import { useEditor } from "./EditorContext.jsx";
import { ProjectPanel } from "./panels/ProjectPanel.jsx";
import { PatternPanel } from "./panels/PatternPanel.jsx";
import { DimensionsPanel } from "./panels/DimensionsPanel.jsx";
import { BoundaryPanel } from "./panels/BoundaryPanel.jsx";
import { FieldsPanel } from "./panels/FieldsPanel.jsx";
import { PathPanel } from "./panels/PathPanel.jsx";
import { TaperPanel } from "./panels/TaperPanel.jsx";
import { HoleRemovalPanel } from "./panels/HoleRemovalPanel.jsx";
import { ColorsPanel } from "./panels/ColorsPanel.jsx";
import { ExportPanel } from "./panels/ExportPanel.jsx";
import { MONO, modeColor } from "./theme.js";
import { kbdStyle } from "./controls/index.js";

// The workspace's pages, in the order the work goes: what the pattern is,
// where it goes, how it varies (the size gradient and the controllers are one
// page: one list of field layers), what is taken out, how it is made and where
// it ends up. The rail on the left lists them; the inspector on the right
// shows ONE of them at a time — the way Figma's right sidebar shows the
// properties of what is selected, Rhino's sidebar swaps its toolbar with the
// active tab, and Photoshop's Properties panel follows the tool — so the
// numbers for the thing being worked on are always the numbers on screen,
// never a scroll away.
//
//   mode      the canvas mode the page owns, when it has one. Choosing the
//             page enters it; leaving the page leaves it.
//   key       the letter that opens the page (and its mode) from the keyboard
//   pathOnly  the page exists only while the layout is Path
export const PANELS = [
  { id: "project", label: "Project", aria: "Project panel", Icon: FolderOpen, render: ProjectPanel },
  { id: "pattern", label: "Pattern", aria: "Pattern panel", Icon: LayoutGrid, render: PatternPage },
  { id: "boundary", label: "Boundary", aria: "Boundary panel", Icon: Scan, mode: "boundary", key: "B", render: BoundaryPanel }, // prettier-ignore
  { id: "fields", label: "Fields", aria: "Fields panel", Icon: Waves, mode: "fields", key: "F", render: FieldsPanel },
  { id: "path", label: "Path", aria: "Path panel", Icon: Route, mode: "path", key: "P", pathOnly: true, render: PathPanel }, // prettier-ignore
  { id: "remove", label: "Remove", aria: "Remove holes panel", Icon: Eraser, mode: "remove", key: "R", render: HoleRemovalPanel }, // prettier-ignore
  { id: "taper", label: "Taper", aria: "Taper panel", Icon: Layers2, render: TaperPanel },
  { id: "export", label: "Export", aria: "Export panel", Icon: Download, render: ExportPage },
];
export const PANEL_BY_ID = Object.fromEntries(PANELS.map(panel => [panel.id, panel]));
export const DEFAULT_PANEL = "pattern";

function PatternPage() {
  return (
    <>
      <PatternPanel />
      <DimensionsPanel />
    </>
  );
}

// The colours travel with the file: they are what the SVG and PNG are drawn
// in, so they sit beside the export.
function ExportPage() {
  return (
    <>
      <ColorsPanel />
      <ExportPanel />
    </>
  );
}

// The inspector (right): the one page the rail has open. Uniform 8 px padding
// on the shell; the inner scroller bleeds 5 px into the right padding so the
// scrollbar overlays it and content stays inset 8 px.
export function Sidebar() {
  const { theme, ui } = useEditor();
  const panel = PANEL_BY_ID[ui.activePanel] ?? PANEL_BY_ID[DEFAULT_PANEL];
  const colour = panel.mode ? modeColor(theme, panel.mode) : theme.accent;
  const live = panel.mode && ui.mode === panel.mode;
  // The key is shown only while it does something here.
  const keyWorks = panel.mode !== "boundary" || ui.boundaryKeyWorks;
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* The page's name, so the panel says what it is before its first card
          does — and, for a page with a canvas mode, whether that mode is live. */}
      <div
        role="heading"
        aria-level={2}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px 10px",
          fontFamily: MONO,
          flexShrink: 0,
        }}
      >
        <panel.Icon size={13} color={colour} strokeWidth={1.9} />
        <span style={{ fontSize: 11, fontWeight: 600, color: theme.textPrimary, letterSpacing: 0.2 }}>
          {panel.aria.replace(/ panel$/, "")}
        </span>
        {live && (
          <span
            style={{
              fontSize: 8,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: colour,
              padding: "2px 6px",
              borderRadius: 999,
              border: `1px solid ${colour}66`,
              background: `${colour}18`,
            }}
          >
            on canvas
          </span>
        )}
        <div style={{ flex: 1 }} />
        {panel.key && keyWorks && <span style={kbdStyle(theme)}>{panel.key}</span>}
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          marginRight: -5,
          paddingRight: 5,
          scrollbarWidth: "thin",
          scrollbarColor: `${theme.scrollbar} transparent`,
        }}
      >
        <panel.render />
      </div>
    </div>
  );
}
