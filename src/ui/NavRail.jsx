import { Command, Layers, MousePointer2 } from "lucide-react";
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
// and the numbers beside it arrive together. Two states, drawn apart: the
// open page is a quiet neutral highlight (where you are), and a live mode is
// the mode's own colour with a full-height bar (what the canvas is doing) —
// colour on a rail reads as "tool active" to anyone from Figma or a CAD tool,
// so it is reserved for exactly that.
//
// The pages keep their own "Edit on Canvas" buttons: a mode has to be
// reachable from where its numbers are as well as from here. Above the
// pages sits the one tool that is not a page — Select, the way out of every
// mode — so a mouse-first user can put the handles down without knowing
// Escape or V, and can see at a glance that no mode is live.
export function NavRail() {
  const { doc, theme, ui, actions } = useEditor();
  const { mode, activePanel } = ui;
  const isPath = doc.layout.type === "Path";

  const cell = (active, live, colour) => ({
    width: 50,
    height: 46,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    border: "none",
    borderRadius: 9,
    background: live ? `${colour}22` : active ? theme.btnBg : "transparent",
    color: live ? colour : active ? theme.textPrimary : theme.textSecondary,
    cursor: "pointer",
    padding: 0,
    position: "relative",
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.3,
    transition: transition(),
    // Only the open page carries an inline ring. An inline `none` on the
    // others overrode the global focus ring, and the rail could not be seen
    // to have the keyboard focus; the stylesheet's focus rule wins over the
    // open page's ring as well.
    ...(live ? { boxShadow: `inset 0 0 0 1px ${colour}55` } : active ? { boxShadow: `inset 0 0 0 1px ${theme.border}` } : null), // prettier-ignore
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
      <button
        className="pg-rail-btn pg-tooltip"
        data-tip="Select & pan  ·  V"
        onClick={() => actions.setMode("select")}
        aria-label="Select and pan"
        aria-pressed={mode === "select"}
        style={cell(false, mode === "select", modeColor(theme, "select"))}
      >
        <MousePointer2 size={16} strokeWidth={1.8} />
        <span aria-hidden="true">Select</span>
      </button>
      <div style={{ height: 1, width: 24, background: theme.sectionBorder, margin: "3px 0" }} />
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
            style={cell(active, live, colour)}
          >
            <entry.Icon size={16} strokeWidth={1.8} />
            <span aria-hidden="true">{entry.label}</span>
            {live && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -6,
                  top: 4,
                  width: 3,
                  height: 38,
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
        style={cell(false, false, theme.accent)}
      >
        <Layers size={16} strokeWidth={1.8} />
        <span aria-hidden="true">Shape</span>
      </button>
      <button
        className="pg-rail-btn pg-tooltip"
        data-tip="Commands  ·  Ctrl K"
        onClick={() => ui.setPaletteOpen(true)}
        aria-label="Open the command palette"
        style={cell(false, false, theme.accent)}
      >
        <Command size={15} strokeWidth={1.8} />
        <span aria-hidden="true">Ctrl K</span>
      </button>
    </div>
  );
}
