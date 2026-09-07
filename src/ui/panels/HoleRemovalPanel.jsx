import { useEditor } from "../EditorContext.jsx";
import { Toggle, ghostButtonStyle, rowLabelStyle } from "../controls/index.js";
import { Section, hintStyle } from "./Section.jsx";

export function HoleRemovalPanel() {
  const { theme, ui, doc, stats, actions } = useEditor();
  const { dark } = theme;
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
        {ui.holeRemovalMode && (
          <div style={{ ...hintStyle(theme), marginBottom: 4 }}>
            Click a hole on the canvas to remove it, and again to restore it. The open area follows.
          </div>
        )}
        {doc.removedHoles.length > 0 && (
          <>
            {row("Removed", `${stats.removedHoleCount} holes`, theme.warn, theme.warnBg)}
            {stats.removedHoleCount < doc.removedHoles.length &&
              row(
                "From another pattern",
                `${doc.removedHoles.length - stats.removedHoleCount} holes`,
                theme.textSecondary,
                "transparent"
              )}
            {row("Active", `${stats.activeHoleCount} holes`, theme.accent, theme.accentBgSoft)}
            <button
              onClick={actions.clearRemovedHoles}
              style={ghostButtonStyle(theme, {
                height: 28,
                fontWeight: 500,
                background: theme.warnBg,
                color: theme.warn,
                border: `1px solid ${dark ? "rgba(242,107,107,0.25)" : "rgba(220,75,75,0.2)"}`,
              })}
            >
              Restore All Holes
            </button>
          </>
        )}
      </div>
    </Section>
  );
}
