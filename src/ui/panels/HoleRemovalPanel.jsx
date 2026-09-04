import { useEditor } from "../EditorContext.jsx";
import { Toggle } from "../controls/index.js";
import { MONO } from "../theme.js";
import { Section } from "./Section.jsx";

export function HoleRemovalPanel() {
  const { theme, ui, removedSet, stats, actions } = useEditor();
  const { dark } = theme;
  const row = (label, value, color, bg) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: bg }}>
      <span style={{ fontSize: 10, color: theme.textSecondary }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}</span>
    </div>
  );
  return (
    <Section title="Hole Removal" theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <span style={{ fontSize: 11, color: theme.textSecondary }}>Click to Remove</span>
          <Toggle value={ui.holeRemovalMode} onChange={actions.setHoleRemoval} dark={dark} label="Click to Remove" />
        </label>
        {ui.holeRemovalMode && <div style={{ fontSize: 9, color: "#888", lineHeight: 1.4 }}>Click holes on the canvas to remove/restore them. OAR recalculates automatically.</div>}
        {removedSet.size > 0 && (
          <>
            {row("Removed", `${removedSet.size} holes`, theme.warn, theme.warnBg)}
            {row("Active", `${stats.activeHoleCount} holes`, theme.accent, theme.accentBgSoft)}
            <button onClick={actions.clearRemovedHoles}
              style={{ padding: "5px 0", fontSize: 10, fontWeight: 500, background: theme.warnBg, color: theme.warn, border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`, borderRadius: 4, cursor: "pointer", fontFamily: MONO }}>
              Restore All Holes
            </button>
          </>
        )}
      </div>
    </Section>
  );
}
