import { Download, Eye, EyeOff, Maximize, Moon, Redo2, Sun, Undo2 } from "lucide-react";
import { useEditor } from "./EditorContext.jsx";
import { MONO } from "./theme.js";
import { transition } from "./controls/index.js";

// The top bar: where you are (the app, the document, whether it is saved), the
// one number that matters (open area), and the global verbs — history, view,
// theme, export. Export sits alone on the right in the accent, because it is
// the one action here that leaves the app.
export function TopBar() {
  const { doc, api, theme, ui, stats, geometry, actions, project, openExport } = useEditor();
  const { dark, setDark, showHud, setShowHud } = ui;
  const { taperActive } = geometry;
  const divider = <div style={{ width: 1, alignSelf: "stretch", background: theme.sectionBorder, margin: "12px 0" }} />;
  const btn = (extra = {}) => ({
    height: 30,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.controlBg,
    cursor: "pointer",
    fontSize: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    color: theme.textPrimary,
    flexShrink: 0,
    fontFamily: MONO,
    transition: transition(),
    ...extra,
  });
  const iconBtn = (enabled = true, extra = {}) =>
    btn({
      width: 30,
      padding: 0,
      color: enabled ? theme.textPrimary : theme.textMuted,
      cursor: enabled ? "pointer" : "default",
      opacity: enabled ? 1 : 0.5,
      ...extra,
    });
  const saved = project.saveStatus === "saved";
  const saving = project.saveStatus === "saving";
  const statusColour = saved ? theme.ok : saving ? theme.accent : theme.warn;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        height: 50,
        flexShrink: 0,
        padding: "0 14px 0 16px",
        background: theme.panelBg,
        borderRadius: 14,
        boxShadow: theme.floatShadow,
      }}
    >
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}>
        <div
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentSoft})`,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
            padding: 5,
          }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ borderRadius: "50%", background: dark ? "#0a0a0c" : "#fff", opacity: 0.9 }} />
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.2 }}>Perf Pattern</div>
      </div>
      {divider}
      {/* Breadcrumb: the document and its save state */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          data-testid="doc-name"
          style={{ fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240, whiteSpace: "nowrap" }} // prettier-ignore
        >
          {doc.name}
        </span>
        <span
          data-testid="save-status"
          title={saved ? "Autosaved in this browser" : saving ? "Saving…" : "Could not save in this browser"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 8,
            letterSpacing: 0.6,
            color: theme.textSecondary,
            padding: "3px 7px 3px 6px",
            borderRadius: 999,
            border: `1px solid ${theme.sectionBorder}`,
            whiteSpace: "nowrap",
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 6, height: 6, borderRadius: 3, background: statusColour, transition: transition("background") }} // prettier-ignore
          />
          {saving ? "SAVING…" : saved ? "SAVED IN BROWSER" : "NOT SAVED"}
        </span>
      </div>
      <div style={{ flex: 1 }} />
      {/* The headline figure */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
        <span
          data-testid="stat-oar"
          style={{ fontSize: 22, fontWeight: 700, color: theme.accent, lineHeight: 1, letterSpacing: -0.5 }}
        >
          {stats.displayOAR.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: theme.textSecondary }}>% open area</span>
        {taperActive && (
          <span style={{ fontSize: 9, color: theme.textSecondary, marginLeft: 6 }}>
            surface {stats.nominalOAR.toFixed(1)} · effective{" "}
            <span style={{ color: stats.oarDelta < 0 ? theme.warn : theme.accent }}>
              {stats.effectiveOAR.toFixed(1)}
            </span>
          </span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {/* History */}
      <div style={{ display: "flex", gap: 0 }}>
        <button
          onClick={api.undo}
          disabled={!api.canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo (Ctrl+Z)"
          style={iconBtn(api.canUndo, { borderRadius: "8px 0 0 8px" })}
        >
          <Undo2 size={13} />
        </button>
        <button
          onClick={api.redo}
          disabled={!api.canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo (Ctrl+Shift+Z)"
          style={iconBtn(api.canRedo, { borderRadius: "0 8px 8px 0", marginLeft: -1 })}
        >
          <Redo2 size={13} />
        </button>
      </div>
      {/* View */}
      <div style={{ display: "flex", gap: 0 }}>
        <button
          onClick={() => setShowHud(v => !v)}
          title="Show or hide every canvas overlay (Shift+H)"
          aria-label="Toggle canvas overlays"
          aria-pressed={showHud}
          style={iconBtn(true, {
            borderRadius: "8px 0 0 8px",
            color: showHud ? theme.textPrimary : theme.accent,
            borderColor: showHud ? theme.border : theme.accentBorder,
          })}
        >
          {showHud ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          onClick={actions.resetView}
          title="Fit the sheet to the view (0)"
          aria-label="Reset view"
          style={iconBtn(true, { borderRadius: "0 8px 8px 0", marginLeft: -1 })}
        >
          <Maximize size={13} />
        </button>
      </div>
      <button onClick={() => setDark(d => !d)} title="Toggle theme" aria-label="Toggle theme" style={iconBtn(true)}>
        {dark ? <Sun size={13} /> : <Moon size={13} />}
      </button>
      <button
        onClick={openExport}
        aria-label="Export pattern"
        title="Export SVG, DXF or PNG (Ctrl+E)"
        style={btn({
          background: theme.accent,
          color: dark ? "#0a0a0c" : "#fff",
          border: `1px solid ${theme.accent}`,
          fontWeight: 600,
          padding: "0 12px",
        })}
      >
        <Download size={12} /> Export
      </button>
    </div>
  );
}
