import { Maximize, Minus, Plus, TriangleAlert } from "lucide-react";
import { clamp } from "../../core/math.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";
import { transition } from "../controls/index.js";

function Stat({ label, value, color, testId, theme, title }) {
  return (
    <div title={title} style={{ display: "flex", alignItems: "baseline", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 9, color: theme.textMuted, letterSpacing: 0.4 }}>{label}</span>
      <span data-testid={testId} style={{ fontSize: 10.5, color: color || theme.textPrimary, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

// The status bar along the bottom of the canvas: the pattern's numbers on the
// left, the view on the right — where every CAD tool keeps them, so the eye
// has one place to look and the canvas above it stays clear.
export function StatusBar() {
  const { doc, theme, ui, stats, geometry, actions } = useEditor();
  const { variation } = doc;
  const dot = <span style={{ width: 1, height: 12, background: theme.sectionBorder }} />;
  const viewBtn = (extra = {}) => ({
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: theme.textSecondary,
    cursor: "pointer",
    padding: 0,
    transition: transition(),
    ...extra,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 10,
        height: 34,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 6px 0 12px",
        borderRadius: 10,
        background: theme.hudBg,
        border: `1px solid ${theme.hudBorder}`,
        backdropFilter: "blur(12px)",
        fontFamily: MONO,
        pointerEvents: "auto",
      }}
    >
      <Stat
        theme={theme}
        label="holes"
        testId="stat-holes"
        value={stats.activeHoleCount.toLocaleString()}
        title="Active holes"
      />
      {stats.hasRemovedHoles && (
        <span style={{ fontSize: 9, color: theme.warn, marginLeft: -8 }}>/ {stats.holeCount.toLocaleString()}</span>
      )}
      {dot}
      {stats.minLigament !== null && (
        <>
          <Stat
            theme={theme}
            label="min ligament"
            testId="stat-ligament"
            value={`${stats.minLigament.toFixed(2)} mm`}
            color={stats.minLigament <= 0 ? theme.warn : theme.accent}
            title="The narrowest bridge of metal between two holes"
          />
          {dot}
        </>
      )}
      <Stat
        theme={theme}
        label={variation.enabled ? "avg hole" : "hole"}
        value={`${stats.singleHoleArea.toFixed(2)} mm²`}
        title="Area of one hole"
      />
      {dot}
      <Stat theme={theme} label="open" value={`${stats.totalHoleArea.toFixed(0)} mm²`} title="Total open area" />
      {dot}
      <Stat
        theme={theme}
        label="perforated"
        value={`${stats.perforatedArea.toFixed(0)} / ${stats.grossArea.toFixed(0)} mm²`}
        title="Perforated area over the panel area"
      />
      {geometry.taperActive && stats.hasClosedHoles && (
        <>
          {dot}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, color: theme.warn }}>
            <TriangleAlert size={10} /> {stats.closedHoleCount} closed
          </span>
        </>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <button
          className="pg-hover"
          onClick={() => actions.zoomBy(0.8)}
          title="Zoom out (−)"
          aria-label="Zoom out"
          style={viewBtn()}
        >
          <Minus size={12} />
        </button>
        <button
          className="pg-hover"
          onClick={actions.resetView}
          title="Fit the sheet to the view (0)"
          aria-label="Zoom to fit"
          style={viewBtn({ width: "auto", padding: "0 6px", fontSize: 10, fontFamily: MONO, gap: 5 })}
        >
          <Maximize size={11} /> {Math.round(ui.zoom * 100)}%
        </button>
        <button
          className="pg-hover"
          onClick={() => actions.zoomBy(1.25)}
          title="Zoom in (+)"
          aria-label="Zoom in"
          style={viewBtn()}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

// Bottom-right readout while dragging the stop / curve gizmo handles.
export function VariationHud() {
  const { theme, ui } = useEditor();
  const hud = ui.variationHud;
  const bar = value => (
    <div style={{ height: 2, borderRadius: 2, background: theme.track, marginBottom: 8 }}>
      <div
        style={{ width: `${value * 100}%`, height: "100%", background: theme.accent, transition: transition("width") }}
      />
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
      className="pg-fade-in"
      style={{
        position: "absolute",
        right: 18,
        bottom: 56,
        width: 190,
        padding: "10px 12px",
        borderRadius: 9,
        background: theme.hudBg,
        border: `1px solid ${theme.hudBorder}`,
        backdropFilter: "blur(12px)",
        pointerEvents: "none",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        fontFamily: MONO,
      }}
    >
      {line(hud.positionLabel, hud.positionValue)}
      {bar(hud.positionValue)}
      {line("Curve", hud.exponent)}
      {bar(clamp(hud.exponent / 5, 0, 1))}
    </div>
  );
}
