import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { HOLE_SHAPES, PATTERN_TYPES } from "../core/constants.js";
import { CHANNEL_INFO, EDITABLE_CHANNELS } from "../fields/controllers.js";
import { useEditor } from "./EditorContext.jsx";
import { MONO } from "./theme.js";
import { kbdStyle } from "./controls/index.js";

// Ctrl+K: every command in the app behind one search box — modes, layout
// types, hole shapes, controllers, view and file verbs — the way the CAD and
// code tools the app sits beside do it. Nothing here is reachable ONLY from
// here; it is the fast path, not the only one.
export function CommandPalette({ onClose }) {
  const { doc, api, theme, ui, actions, project, openExport } = useEditor();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef(null);
  const list = useRef(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const commands = useMemo(() => {
    const run = fn => () => {
      fn();
      onClose();
    };
    const items = [
      { group: "Mode", label: "Select & pan", key: "V", run: run(() => actions.setMode("select")) },
      { group: "Mode", label: "Edit the boundary", key: "B", run: run(() => actions.setMode("boundary")) },
      { group: "Mode", label: "Edit the size gradient", key: "G", run: run(() => actions.setMode("variation")) },
      { group: "Mode", label: "Edit field controllers", key: "F", run: run(() => actions.setMode("fields")) },
      { group: "Mode", label: "Edit Path curves", key: "P", run: run(() => actions.setMode("path")) },
      { group: "Mode", label: "Remove holes by clicking", key: "R", run: run(() => actions.setMode("remove")) },
      { group: "Shape", label: "Open the shape editor", run: run(() => ui.setShapeEditorOpen(true)) },
      { group: "File", label: "Export…", key: "Ctrl E", run: run(openExport) },
      { group: "File", label: "Save .perf.json", key: "Ctrl S", run: run(project.saveFile) },
      { group: "File", label: "Copy a share link", run: run(() => project.shareLink()) },
      { group: "File", label: "New document", run: run(project.newDocument) },
      { group: "Edit", label: "Undo", key: "Ctrl Z", run: run(api.undo), disabled: !api.canUndo },
      { group: "Edit", label: "Redo", key: "Ctrl Shift Z", run: run(api.redo), disabled: !api.canRedo },
      { group: "View", label: "Fit the sheet to the view", key: "0", run: run(actions.resetView) },
      { group: "View", label: ui.showHud ? "Hide canvas overlays" : "Show canvas overlays", key: "Shift H", run: run(() => ui.setShowHud(v => !v)) }, // prettier-ignore
      { group: "View", label: ui.dark ? "Light theme" : "Dark theme", run: run(() => ui.setDark(d => !d)) },
      ...PATTERN_TYPES.map(type => ({
        group: "Layout",
        label: `Layout: ${type}`,
        active: doc.layout.type === type,
        run: run(() => api.patch({ "layout.type": type, presetIndex: 0 })),
      })),
      ...HOLE_SHAPES.map(shape => ({
        group: "Hole",
        label: `Hole shape: ${shape}`,
        active: doc.hole.shape === shape,
        run: run(() => actions.setShape(shape)),
      })),
      ...EDITABLE_CHANNELS.flatMap(channel =>
        ["point", "line", "curve", "polyline"].map(kind => ({
          group: "Controller",
          label: `Add ${CHANNEL_INFO[channel].label.toLowerCase()} ${kind} controller`,
          run: run(() => {
            actions.selectChannel(channel);
            actions.addController(kind, null, channel);
          }),
        }))
      ),
    ];
    return items;
  }, [actions, api, doc.hole.shape, doc.layout.type, onClose, openExport, project, ui]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 40);
    const words = q.split(/\s+/);
    return commands
      .map(c => {
        const text = `${c.group} ${c.label}`.toLowerCase();
        const hit = words.every(w => text.includes(w));
        if (!hit) return null;
        // Prefix matches on the label rank first.
        const score = (c.label.toLowerCase().startsWith(q) ? 2 : 0) + (c.label.toLowerCase().includes(q) ? 1 : 0);
        return { c, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map(({ c }) => c)
      .slice(0, 40);
  }, [commands, query]);

  const current = Math.min(cursor, Math.max(0, matches.length - 1));

  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const onKeyDown = e => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(c => Math.min(matches.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(c => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = matches[current];
      if (item && !item.disabled) item.run();
    }
  };

  return (
    <div
      role="presentation"
      onPointerDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: ui.dark ? "rgba(0,0,0,0.5)" : "rgba(20,20,30,0.25)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        fontFamily: MONO,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="pg-pop-in"
        onKeyDown={onKeyDown}
        style={{
          width: 520,
          maxWidth: "92vw",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          background: theme.menuBg,
          color: theme.textPrimary,
          borderRadius: 14,
          boxShadow: theme.menuShadow,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderBottom: `1px solid ${theme.sectionBorder}`,
          }}
        >
          <Search size={14} color={theme.textSecondary} />
          <input
            ref={input}
            aria-label="Search commands"
            value={query}
            placeholder="Type a command, a layout or a hole shape…"
            onChange={e => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: theme.textPrimary,
              fontSize: 13,
              fontFamily: MONO,
            }}
          />
          <span style={kbdStyle(theme)}>esc</span>
        </div>
        <div ref={list} role="listbox" aria-label="Commands" style={{ overflowY: "auto", padding: 6 }}>
          {matches.length === 0 && (
            <div style={{ padding: "14px 12px", fontSize: 11, color: theme.textSecondary }}>Nothing matches.</div>
          )}
          {matches.map((item, index) => {
            const selected = index === current;
            return (
              <button
                key={`${item.group}:${item.label}`}
                role="option"
                aria-selected={selected}
                disabled={item.disabled}
                onMouseEnter={() => setCursor(index)}
                onClick={item.run}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: selected ? theme.accentBg : "transparent",
                  color: item.disabled ? theme.textMuted : selected ? theme.textPrimary : theme.textSecondary,
                  fontSize: 11,
                  fontFamily: MONO,
                  cursor: item.disabled ? "default" : "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: theme.textMuted,
                    width: 78,
                    flexShrink: 0,
                  }}
                >
                  {item.group}
                </span>
                <span style={{ flex: 1, color: item.active ? theme.accent : undefined }}>{item.label}</span>
                {item.key && <span style={kbdStyle(theme)}>{item.key}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
