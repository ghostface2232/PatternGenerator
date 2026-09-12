import { PenTool, SquarePen, X } from "lucide-react";
import { MAX_PATHS, MAX_PATH_POINTS } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { PitchInfo, SliderRow, Toggle } from "../controls/index.js";
import { actionButtonStyle, chipStyle, ghostButtonStyle, iconButtonStyle, rowLabelStyle } from "../controls/index.js"; // prettier-ignore
import { Section, hintStyle } from "./Section.jsx";

// The Path layout's own page: the curves the holes are strung along. Vertices
// are dragged on the canvas; which curve, how many points it has, whether it
// is smoothed, turned to or closed, and the step along it are here — the same
// division as the polyline field controller. Reached from the rail only while
// the layout IS Path, since it has nothing to say about any other mode.
export function PathPanel() {
  const { doc, api, theme, ui, geometry: g, actions } = useEditor();
  const { dark } = theme;
  const { layout } = doc;
  const paths = layout.path.paths;
  const current = paths[ui.selectedPath];
  return (
    <Section id="path" title="Path Curves" theme={theme}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          onClick={actions.togglePathEditMode}
          aria-label="Edit path curves on the canvas"
          aria-pressed={ui.pathEditMode}
          style={actionButtonStyle(theme, ui.pathEditMode, { flex: 1 })}
        >
          <SquarePen size={11} /> {ui.pathEditMode ? "Editing Canvas · P" : "Edit on Canvas · P"}
        </button>
        <button
          onClick={() => {
            if (!ui.pathEditMode) actions.setMode("path");
            ui.setPathTool(ui.pathTool === "pen" ? null : "pen");
          }}
          aria-label="Draw a path with the pen"
          aria-pressed={ui.pathTool === "pen"}
          title="Pen"
          style={actionButtonStyle(theme, ui.pathTool === "pen", { width: 38, padding: 0 })}
        >
          <PenTool size={12} />
        </button>
      </div>
      {paths.length === 0 ? (
        <div style={hintStyle(theme)}>No path yet — the holes follow the default curve.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
          {paths.map((path, index) => (
            <div key={index} style={{ display: "flex", gap: 4 }}>
              <button
                className="pg-hover"
                onClick={() => actions.selectPath(index)}
                aria-label={`Select path ${index + 1}`}
                aria-pressed={index === ui.selectedPath}
                style={chipStyle(theme, index === ui.selectedPath, { flex: 1, height: 28, textAlign: "left", padding: "0 8px" })} // prettier-ignore
              >
                Path {index + 1} · {path.points.length} pts{path.closed ? " · loop" : ""}
              </button>
              <button
                className="pg-hover"
                onClick={() => actions.removePath(index)}
                aria-label={`Remove path ${index + 1}`}
                title="Remove this path"
                style={iconButtonStyle(theme, { color: theme.warn })}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          ["Add a path", () => actions.addPath(), paths.length >= MAX_PATHS, "+ path", `At most ${MAX_PATHS} paths`], // prettier-ignore
          ["Add a path vertex", () => actions.addVertex(ui.selectedPath), (current?.points.length ?? MAX_PATH_POINTS) >= MAX_PATH_POINTS, "+ vertex", paths.length === 0 ? "Add a path first" : `At most ${MAX_PATH_POINTS} vertices`], // prettier-ignore
          ["Remove a path vertex", () => actions.removeVertex(ui.selectedPath), (current?.points.length ?? 0) <= 2, "− vertex", paths.length === 0 ? "Add a path first" : "A path needs two vertices"], // prettier-ignore
        ].map(([name, run, disabled, text, why]) => (
          <button
            key={name}
            className="pg-hover"
            onClick={run}
            disabled={disabled}
            aria-label={name}
            title={disabled ? why : name}
            style={ghostButtonStyle(theme, { flex: 1, opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" })} // prettier-ignore
          >
            {text}
          </button>
        ))}
      </div>
      {[
        ["Smooth the path through its points", layout.path.smooth, v => api.set("layout.path.smooth", v)],
        ["Turn holes along the path", layout.path.alignToTangent, v => api.set("layout.path.alignToTangent", v)],
        ["Close this path into a loop", current?.closed ?? false, () => actions.togglePathClosed(ui.selectedPath), paths.length === 0], // prettier-ignore
      ].map(([label, value, onChange, disabled]) => (
        <label key={label} style={{ ...rowLabelStyle(theme), opacity: disabled ? 0.4 : 1 }}>
          <span>{label}</span>
          <Toggle value={value} onChange={onChange} dark={dark} label={label} disabled={disabled} />
        </label>
      ))}
      {/* The step along the curve is the Pattern page's Along Gap; it is the one
          number a curve is tuned against, so it is within reach here too. */}
      <SliderRow
        label="Along Gap"
        value={layout.edgeGapX}
        min={0}
        max={50}
        step={0.1}
        onChange={actions.setEdgeGapX}
        unit="mm"
        dark={dark}
      />
      <PitchInfo label="step along the path" value={g.freeSpacingX} dark={dark} />
    </Section>
  );
}
