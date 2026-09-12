import { Command, Layers } from "lucide-react";
import { useEditor } from "./EditorContext.jsx";
import { PANELS } from "./Sidebar.jsx";
import { MONO, modeColor } from "./theme.js";
import { transition } from "./controls/index.js";

// The left rail: the workspace's menu, one entry per page, in the order the
// work goes. It is the navigation, not merely a row of shortcuts — the same
// split as Rhino's tabbed sidebar and Plasticity's left toolbar, where the
// left column says WHAT you are working on and the right panel holds the
// numbers for it. Choosing an entry shows its page in the inspector and, when
// the page owns a canvas mode, enters that mode, so the handles on the sheet
// and the numbers beside it arrive together. The entry's coloured bar says
// the mode is live; the highlight alone says only that the page is open.
//
// The pages keep their own "Edit on Canvas" buttons: a mode has to be
// reachable from where its numbers are as well as from here.
export function NavRail() {
  const { doc, theme, ui, actions } = useEditor();
  const { mode, activePanel } = ui;
  const isPath = doc.layout.type === "Path";

  const cell = (active, colour) => ({
    width: 50,
    height: 46,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    border: "none",
    borderRadius: 9,
    background: active ? `${colour}22` : "transparent",
    color: active ? colour : theme.textSecondary,
    cursor: "pointer",
    padding: 0,
    position: "relative",
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.3,
    transition: transition(),
    boxShadow: active ? `inset 0 0 0 1px ${colour}55` : "none",
  });

  return (
    <div
      role="toolbar"
      aria-label="Workspace pages"
      aria-orientation="vertical"
      style={{
        width: 62,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "8px 6px",
        background: theme.railBg,
        borderRadius: 14,
        boxShadow: theme.floatShadow,
        // No overflow rule: `overflow-y: auto` forces `overflow-x` to auto as
        // well, which clipped the tooltips drawn beside the rail. Nine entries
        // fit any viewport the app supports.
      }}
    >
      {PANELS.filter(entry => !entry.pathOnly || isPath).map(entry => {
        const active = activePanel === entry.id;
        const live = !!entry.mode && mode === entry.mode;
        const colour = entry.mode ? modeColor(theme, entry.mode) : theme.accent;
        return (
          <button
            key={entry.id}
            className="pg-rail-btn pg-tooltip"
            data-tip={entry.key ? `${entry.aria.replace(/ panel$/, "")}  ·  ${entry.key}` : entry.aria.replace(/ panel$/, "")} // prettier-ignore
            onClick={() => actions.showPanel(entry.id, { toggleMode: true })}
            aria-label={entry.aria}
            aria-pressed={active}
            style={cell(active, colour)}
          >
            <entry.Icon size={16} strokeWidth={1.8} />
            <span aria-hidden="true">{entry.label}</span>
            {live && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -6,
                  top: 15,
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
      <div style={{ flex: 1 }} />
      <div style={{ height: 1, width: 24, background: theme.sectionBorder, margin: "4px 0" }} />
      <button
        className="pg-rail-btn pg-tooltip"
        data-tip="Shape editor"
        onClick={() => ui.setShapeEditorOpen(true)}
        aria-label="Open the shape editor from the rail"
        style={cell(false, theme.accent)}
      >
        <Layers size={16} strokeWidth={1.8} />
        <span aria-hidden="true">Shape</span>
      </button>
      <button
        className="pg-rail-btn pg-tooltip"
        data-tip="Commands  ·  Ctrl K"
        onClick={() => ui.setPaletteOpen(true)}
        aria-label="Open the command palette"
        style={cell(false, theme.accent)}
      >
        <Command size={15} strokeWidth={1.8} />
        <span aria-hidden="true">Ctrl K</span>
      </button>
    </div>
  );
}
