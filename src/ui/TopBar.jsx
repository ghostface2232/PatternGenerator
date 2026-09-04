import { Eye, EyeOff, Maximize, Moon, Sun } from "lucide-react";
import { useEditor } from "./EditorContext.jsx";
import { MONO } from "./theme.js";
import { smallLabelStyle } from "./controls/index.js";

function TopStat({ label, value, color, theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, whiteSpace: "nowrap" }}>
      <span style={smallLabelStyle(theme)}>{label}</span>
      <span
        style={{ fontSize: 11, fontWeight: 500, color: color || theme.textPrimary, fontFamily: MONO, lineHeight: 1.1 }}
      >
        {value}
      </span>
    </div>
  );
}

export function TopBar() {
  const { theme, ui, stats, geometry, actions } = useEditor();
  const { dark, setDark, showHud, setShowHud } = ui;
  const { taperActive } = geometry;
  const divider = <div style={{ width: 1, alignSelf: "stretch", background: theme.sectionBorder, margin: "10px 0" }} />;
  const btn = (extra = {}) => ({
    height: 30,
    padding: "0 10px",
    borderRadius: 7,
    border: `1px solid ${theme.border}`,
    background: theme.controlBg,
    cursor: "pointer",
    fontSize: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    color: theme.textPrimary,
    flexShrink: 0,
    fontFamily: MONO,
    ...extra,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        height: 54,
        flexShrink: 0,
        padding: "0 18px",
        background: theme.panelBg,
        borderRadius: 12,
        boxShadow: theme.floatShadow,
      }}
    >
      <div style={{ whiteSpace: "nowrap" }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: -0.3 }}>Perf Pattern</div>
        <div style={{ fontSize: 8, color: theme.textSecondary, marginTop: 1, letterSpacing: 0.5 }}>
          PERFORATION GENERATOR
        </div>
      </div>
      {divider}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
        <span data-testid="stat-oar" style={{ fontSize: 24, fontWeight: 700, color: theme.accent, lineHeight: 1 }}>
          {stats.displayOAR.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: theme.textSecondary }}>% OAR</span>
        {taperActive && stats.oarDelta < 0 && (
          <span style={{ fontSize: 9, color: dark ? "#f87171" : "#dc2626" }}>
            ({stats.oarDelta.toFixed(1)}%p taper)
          </span>
        )}
      </div>
      {taperActive && (
        <>
          {divider}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <TopStat
              label="Surface OAR"
              value={`${stats.nominalOAR.toFixed(1)}%`}
              color={dark ? "#999" : "#666"}
              theme={theme}
            />
            <TopStat
              label="Effective OAR"
              value={`${stats.effectiveOAR.toFixed(1)}%`}
              color={theme.accent}
              theme={theme}
            />
          </div>
        </>
      )}
      <div style={{ flex: 1 }} />
      <button
        onClick={() => setShowHud(v => !v)}
        title="Show/hide all canvas overlays (margins, removed-hole marks, stats, gizmos)"
        style={btn({
          border: `1px solid ${showHud ? theme.border : theme.accent}`,
          color: showHud ? theme.textPrimary : theme.accent,
        })}
      >
        {showHud ? <Eye size={12} /> : <EyeOff size={12} />} HUD
      </button>
      <button onClick={actions.resetView} title="Reset zoom & pan" style={btn()}>
        <Maximize size={12} /> Reset View
      </button>
      <button onClick={() => setDark(d => !d)} title="Toggle theme" style={btn({ width: 30, padding: 0 })}>
        {dark ? <Sun size={14} /> : <Moon size={14} />}
      </button>
    </div>
  );
}
