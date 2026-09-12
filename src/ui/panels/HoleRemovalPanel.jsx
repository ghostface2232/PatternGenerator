import { useEditor } from "../EditorContext.jsx";
import { Toggle, ghostButtonStyle, rowLabelStyle } from "../controls/index.js";
import { Section, hintStyle } from "./Section.jsx";

// The Remove page: the switch, the count, the way back. The rows and the
// Restore button are always there — a page that is one switch and nothing
// else reads as unfinished, and the counts say what the switch is for before
// the first click.
export function HoleRemovalPanel() {
  const { theme, ui, doc, stats, actions } = useEditor();
  const { dark } = theme;
  const none = doc.removedHoles.length === 0;
  const row = (label, value, color, bg) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 9px",
        borderRadius: 6,
        background: bg,
      }}
    >
      <span style={{ fontSize: 10, color: theme.textSecondary }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
  return (
    <Section id="removal" title="Hole Removal" theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ ...rowLabelStyle(theme), marginBottom: 0, cursor: "pointer" }}>
          <span>Click to Remove · R</span>
          <Toggle value={ui.holeRemovalMode} onChange={actions.setHoleRemoval} dark={dark} label="Click to Remove" />
        </label>
        <div style={{ ...hintStyle(theme), marginBottom: 4 }}>
          {ui.holeRemovalMode
            ? "Click a hole on the canvas to take it out; click it again to put it back."
            : "Switch on, then click holes on the canvas to take them out."}{" "}
          Removals stay until the pattern itself changes; undo brings them back.
        </div>
        {row(
          "Removed",
          `${stats.removedHoleCount.toLocaleString()} holes`,
          none ? theme.textSecondary : theme.warn,
          none ? "transparent" : theme.warnBg
        )}
        {stats.removedHoleCount < doc.removedHoles.length &&
          row(
            "From another pattern",
            `${doc.removedHoles.length - stats.removedHoleCount} holes`,
            theme.textSecondary,
            "transparent"
          )}
        {row("Active", `${stats.activeHoleCount.toLocaleString()} holes`, theme.accent, theme.accentBgSoft)}
        <button
          onClick={actions.clearRemovedHoles}
          disabled={none}
          aria-label="Restore All Holes"
          style={ghostButtonStyle(theme, {
            height: 28,
            fontWeight: 500,
            background: none ? "transparent" : theme.warnBg,
            color: none ? theme.textMuted : theme.warn,
            border: `1px solid ${none ? theme.border : dark ? "rgba(242,107,107,0.25)" : "rgba(220,75,75,0.2)"}`,
            cursor: none ? "default" : "pointer",
          })}
        >
          Restore All Holes
        </button>
      </div>
    </Section>
  );
}
