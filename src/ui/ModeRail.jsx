import { Eraser, Layers, MousePointer2, Route, Scan, SlidersHorizontal, Waves, Command } from "lucide-react";
import { useEditor } from "./EditorContext.jsx";
import { SECTION_IDS } from "./Sidebar.jsx";
import { MONO, modeColor } from "./theme.js";
import { transition } from "./controls/index.js";

// The left rail: one button per canvas mode, the way Figma's toolbar and a CAD
// tool's left strip put the verbs in one column. Each entry names its shortcut
// and, when entered, unfolds the inspector section that owns it — so the two
// halves of every mode (canvas handles, panel numbers) arrive together.
//
// The panels keep their own "Edit on Canvas" buttons: a mode has to be
// reachable from where its numbers are as well as from here.
const MODES = [
  { mode: "select", Icon: MousePointer2, label: "Select & pan", key: "V", section: null },
  { mode: "boundary", Icon: Scan, label: "Boundary", key: "B", section: SECTION_IDS.boundary },
  { mode: "variation", Icon: Waves, label: "Size gradient", key: "G", section: SECTION_IDS.variation },
  { mode: "fields", Icon: SlidersHorizontal, label: "Field controllers", key: "F", section: SECTION_IDS.fields },
  { mode: "path", Icon: Route, label: "Path curves", key: "P", section: SECTION_IDS.dimensions, pathOnly: true },
  { mode: "remove", Icon: Eraser, label: "Remove holes", key: "R", section: SECTION_IDS.removal },
];

export function ModeRail() {
  const { doc, theme, ui, actions } = useEditor();
  const { mode } = ui;
  const isPath = doc.layout.type === "Path";

  const enter = entry => {
    actions.setMode(entry.mode === mode && entry.mode !== "select" ? "select" : entry.mode);
    if (entry.section && entry.mode !== mode) actions.revealSection(entry.section);
  };

  const cell = (active, colour) => ({
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 9,
    background: active ? `${colour}22` : "transparent",
    color: active ? colour : theme.textSecondary,
    cursor: "pointer",
    padding: 0,
    position: "relative",
    transition: transition(),
    boxShadow: active ? `inset 0 0 0 1px ${colour}66` : "none",
  });

  return (
    <div
      role="toolbar"
      aria-label="Canvas modes"
      aria-orientation="vertical"
      style={{
        width: 52,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 8px",
        background: theme.railBg,
        borderRadius: 14,
        boxShadow: theme.floatShadow,
        fontFamily: MONO,
      }}
    >
      {MODES.filter(entry => !entry.pathOnly || isPath).map(entry => {
        const active = mode === entry.mode;
        const colour = modeColor(theme, entry.mode);
        return (
          <button
            key={entry.mode}
            className="pg-rail-btn pg-tooltip"
            data-tip={`${entry.label}  ·  ${entry.key}`}
            onClick={() => enter(entry)}
            aria-label={`${entry.label} mode`}
            aria-pressed={active}
            style={cell(active, colour)}
          >
            <entry.Icon size={16} strokeWidth={1.8} />
            {active && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -8,
                  top: 10,
                  width: 3,
                  height: 16,
                  borderRadius: 2,
                  background: colour,
                }}
              />
            )}
          </button>
        );
      })}
      <div style={{ height: 1, width: 24, background: theme.sectionBorder, margin: "6px 0" }} />
      <button
        className="pg-rail-btn pg-tooltip"
        data-tip="Shape editor  ·  boolean hole shapes"
        onClick={() => ui.setShapeEditorOpen(true)}
        aria-label="Open the shape editor from the rail"
        style={cell(false, theme.accent)}
      >
        <Layers size={16} strokeWidth={1.8} />
      </button>
      <div style={{ flex: 1 }} />
      <button
        className="pg-rail-btn pg-tooltip"
        data-tip="Commands  ·  Ctrl K"
        onClick={() => ui.setPaletteOpen(true)}
        aria-label="Open the command palette"
        style={cell(false, theme.accent)}
      >
        <Command size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}
