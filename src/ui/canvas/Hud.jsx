import { clamp } from "../../core/math.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";

function Row({ label, value, color, testId, theme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 9, fontFamily: MONO }}>
      <span style={{ color: theme.textSecondary }}>{label}</span>
      <span data-testid={testId} style={{ color: color || theme.textPrimary, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

// Top-left stats card on the canvas.
export function StatsHud() {
  const { doc, theme, ui, stats } = useEditor();
  const { variation } = doc;
  return (
    <div
      style={{
        background: theme.hudBg,
        backdropFilter: "blur(10px)",
        padding: "8px 12px",
        borderRadius: 8,
        fontFamily: MONO,
        border: `1px solid ${theme.hudBorder}`,
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: theme.textSecondary }}>
          Holes{" "}
          <span data-testid="stat-holes" style={{ color: theme.textPrimary, fontWeight: 500 }}>
            {stats.activeHoleCount.toLocaleString()}
          </span>
          {stats.hasRemovedHoles ? (
            <span style={{ color: theme.warn }}> / {stats.holeCount.toLocaleString()}</span>
          ) : (
            ""
          )}
        </span>
        <span style={{ fontSize: 10, color: theme.textSecondary }}>{ui.zoom.toFixed(1)}x</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Row
          theme={theme}
          label={variation.enabled ? "Avg Hole Area" : "Hole Area"}
          value={`${stats.singleHoleArea.toFixed(2)} mm²`}
        />
        <Row theme={theme} label="Open Area" value={`${stats.totalHoleArea.toFixed(1)} mm²`} />
        <Row theme={theme} label="Panel Area" value={`${stats.grossArea.toFixed(0)} mm²`} />
        <Row theme={theme} label="Perf. Area" value={`${stats.perforatedArea.toFixed(0)} mm²`} />
        {stats.minLigament !== null && (
          <Row
            theme={theme}
            label="Min Ligament"
            value={`${stats.minLigament.toFixed(2)} mm`}
            color={stats.minLigament <= 0 ? theme.warn : theme.accent}
            testId="stat-ligament"
          />
        )}
      </div>
    </div>
  );
}

// Bottom-right readout while dragging the stop / curve gizmo handles.
export function VariationHud() {
  const { theme, ui } = useEditor();
  const hud = ui.variationHud;
  const bar = value => (
    <div style={{ height: 2, borderRadius: 2, background: theme.dark ? "#292933" : "#ddd", marginBottom: 8 }}>
      <div style={{ width: `${value * 100}%`, height: "100%", background: theme.accent }} />
    </div>
  );
  const line = (label, value) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 9,
        color: theme.textSecondary,
        marginBottom: 5,
      }}
    >
      <span>{label}</span>
      <span style={{ color: theme.accent }}>{value.toFixed(2)}</span>
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        bottom: 18,
        width: 190,
        padding: "10px 12px",
        borderRadius: 7,
        background: theme.dark ? "rgba(10,10,14,0.82)" : "rgba(255,255,255,0.88)",
        border: `1px solid ${theme.dark ? "rgba(147,197,253,0.25)" : "rgba(37,99,235,0.2)"}`,
        backdropFilter: "blur(12px)",
        pointerEvents: "none",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
      }}
    >
      {line(hud.positionLabel, hud.positionValue)}
      {bar(hud.positionValue)}
      {line("Curve", hud.exponent)}
      {bar(clamp(hud.exponent / 5, 0, 1))}
    </div>
  );
}
