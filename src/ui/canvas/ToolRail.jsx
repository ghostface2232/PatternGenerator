import { Circle, Hexagon, Image as ImageIcon, Minus, PenTool, Plus, RectangleHorizontal, Route, RotateCcw, Spline, Waypoints } from "lucide-react"; // prettier-ignore
import { MAX_CUTOUTS, MAX_PATHS, MAX_PATH_POINTS, MORPH_SHAPE } from "../../core/constants.js";
import { CHANNEL_INFO, EDITABLE_CHANNELS, MAX_CONTROLLERS, imageChannels } from "../../fields/controllers.js";
import { effectiveHoleShape } from "../../core/pipeline.js";
import { layoutPlacementChannels, layoutReadsSpacing } from "../../layouts/index.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO, channelColor, modeColor } from "../theme.js";
import { transition } from "../controls/index.js";

// The floating tool rail on the canvas: what the current MODE offers, beside
// the sheet, so the hand never has to travel to the inspector for a tool. In
// Fields mode it is the channel and the kind of controller the next click
// drops; in Path mode the pen and the vertex edits; in Boundary mode the
// cutouts; in Remove mode the way back. The inspector keeps the same actions
// under longer names, since the rail cannot say why a tool is greyed out.
const FIELD_TOOLS = [
  { kind: "point", Icon: Circle, hint: "Point — click the canvas" },
  { kind: "line", Icon: Minus, hint: "Line — drag across the canvas" },
  { kind: "curve", Icon: Spline, hint: "Curve — drag across the canvas" },
];
const FIELD_PANEL_KINDS = [
  { kind: "polyline", Icon: Waypoints, hint: "Polyline — placed at the centre; double-click it to add vertices" },
  { kind: "image", Icon: ImageIcon, hint: "Image — placed at the centre, then given a picture in the panel" },
];
const CUTOUT_ICON = { Circle, Rectangle: RectangleHorizontal, Polygon: Hexagon };

export function ToolRail() {
  const { doc, theme, ui, actions, stats } = useEditor();
  const { mode, activeChannel, fieldTool, setFieldTool, pathTool, setPathTool, selectedPath } = ui;
  const colour = modeColor(theme, mode);

  const cell = (active, disabled, tint = colour) => ({
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${active ? `${tint}88` : "transparent"}`,
    borderRadius: 7,
    background: active ? `${tint}22` : "transparent",
    color: active ? tint : disabled ? theme.textFaint : theme.textSecondary,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: 600,
    padding: 0,
    pointerEvents: "auto",
    transition: transition(),
  });
  const rule = <div style={{ height: 1, background: theme.hudBorder, margin: "2px 2px" }} />;
  const column = (children, key) => (
    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {children}
    </div>
  );

  let content = null;
  if (mode === "fields") {
    const { controllers } = doc.fields;
    const full = controllers.length >= MAX_CONTROLLERS;
    const shape = effectiveHoleShape(doc);
    const inert = channel =>
      (channel === "shape" && shape !== MORPH_SHAPE) ||
      (channel === "spacing" && !layoutReadsSpacing(shape, doc.layout.type));
    const why = channel =>
      channel === "shape"
        ? `${CHANNEL_INFO.shape.label} channel — needs the ${MORPH_SHAPE} hole shape`
        : doc.layout.type === "Radial"
          ? `${CHANNEL_INFO.spacing.label} channel — Radial does not read it`
          : `${CHANNEL_INFO.spacing.label} channel — ${shape} on ${doc.layout.type} is an exact tiling, which does not read it`;
    const allowsImage = imageChannels(layoutPlacementChannels(doc.layout.type));
    const kindDisabled = kind => full || (kind === "image" && !allowsImage.includes(activeChannel));
    content = (
      <>
        {column(
          EDITABLE_CHANNELS.map((channel, i) => (
            <button
              key={channel}
              className="pg-hover"
              onClick={() => actions.selectChannel(channel)}
              title={`${inert(channel) ? why(channel) : `${CHANNEL_INFO[channel].label} channel`}  ·  ${i + 1}`}
              aria-label={`${CHANNEL_INFO[channel].label} channel`}
              aria-pressed={activeChannel === channel}
              style={cell(activeChannel === channel, inert(channel), channelColor(theme, channel))}
            >
              {CHANNEL_INFO[channel].label.slice(0, 2).toUpperCase()}
            </button>
          )),
          "channels"
        )}
        {rule}
        {column(
          [
            ...FIELD_TOOLS.map(({ kind, Icon, hint }) => (
              <button
                key={kind}
                className="pg-hover"
                onClick={() => setFieldTool(fieldTool === kind ? null : kind)}
                title={full ? `At most ${MAX_CONTROLLERS} controllers` : hint}
                aria-label={`Draw ${kind} controller on the canvas`}
                aria-pressed={fieldTool === kind}
                disabled={full}
                style={cell(fieldTool === kind, full)}
              >
                <Icon size={14} />
              </button>
            )),
            ...FIELD_PANEL_KINDS.map(({ kind, Icon, hint }) => (
              <button
                key={kind}
                className="pg-hover"
                onClick={() => actions.addController(kind)}
                title={
                  full
                    ? `At most ${MAX_CONTROLLERS} controllers`
                    : kindDisabled(kind)
                      ? "A picture cannot drive spacing — it is decoded after the page loads and left out of share links"
                      : hint
                }
                aria-label={`Place ${kind} controller at the centre`}
                disabled={kindDisabled(kind)}
                style={cell(false, kindDisabled(kind))}
              >
                <Icon size={14} />
              </button>
            )),
          ],
          "tools"
        )}
      </>
    );
  } else if (mode === "path") {
    const paths = doc.layout.path.paths;
    const current = paths[selectedPath];
    content = column(
      [
        <button
          key="pen"
          className="pg-hover"
          onClick={() => setPathTool(pathTool === "pen" ? null : "pen")}
          title="Pen — click to add vertices to the selected curve; Shift locks to 45°  ·  P"
          aria-label="Pen tool"
          aria-pressed={pathTool === "pen"}
          style={cell(pathTool === "pen", false)}
        >
          <PenTool size={14} />
        </button>,
        <button
          key="new"
          className="pg-hover"
          onClick={() => actions.addPath()}
          disabled={paths.length >= MAX_PATHS}
          title={paths.length >= MAX_PATHS ? `At most ${MAX_PATHS} curves` : "New curve"}
          aria-label="New path curve"
          style={cell(false, paths.length >= MAX_PATHS)}
        >
          <Route size={14} />
        </button>,
        <button
          key="plus"
          className="pg-hover"
          onClick={() => actions.addVertex(selectedPath)}
          disabled={!current || current.points.length >= MAX_PATH_POINTS}
          title="Insert a vertex on the longest span (or double-click the curve where you want one)"
          aria-label="Insert a vertex on the selected path"
          style={cell(false, !current || current.points.length >= MAX_PATH_POINTS)}
        >
          <Plus size={14} />
        </button>,
        <button
          key="minus"
          className="pg-hover"
          onClick={() => actions.removeVertex(selectedPath)}
          disabled={!current || current.points.length <= 2}
          title="Drop the last vertex (or double-click a vertex to drop that one)"
          aria-label="Drop the last vertex of the selected path"
          style={cell(false, !current || current.points.length <= 2)}
        >
          <Minus size={14} />
        </button>,
      ],
      "path"
    );
  } else if (mode === "boundary") {
    const full = doc.boundary.cutouts.length >= MAX_CUTOUTS;
    content = (
      <>
        {column(
          ["Circle", "Rectangle", "Polygon"].map(shape => {
            const Icon = CUTOUT_ICON[shape];
            return (
              <button
                key={shape}
                className="pg-hover"
                onClick={() => actions.addCutout(shape)}
                disabled={full}
                title={full ? `At most ${MAX_CUTOUTS} cutouts` : `${shape} cutout at the centre, then dragged`}
                aria-label={`Place ${shape.toLowerCase()} cutout`}
                style={cell(false, full)}
              >
                <Icon size={14} />
              </button>
            );
          }),
          "cutouts"
        )}
        {doc.boundary.shape === "Polygon" && (
          <>
            {rule}
            <button
              className="pg-hover"
              onClick={actions.resetBoundaryOutline}
              title="Back to the rectangle"
              aria-label="Reset the outline to the rectangle"
              style={cell(false, false)}
            >
              <RotateCcw size={14} />
            </button>
          </>
        )}
      </>
    );
  } else if (mode === "remove") {
    content = (
      <button
        className="pg-hover"
        onClick={actions.clearRemovedHoles}
        disabled={!stats.hasRemovedHoles && doc.removedHoles.length === 0}
        title="Restore every removed hole"
        aria-label="Restore every removed hole"
        style={cell(false, !stats.hasRemovedHoles && doc.removedHoles.length === 0)}
      >
        <RotateCcw size={14} />
      </button>
    );
  }
  if (!content) return null;

  return (
    <div
      className="pg-pop-in"
      role="toolbar"
      aria-label={`${mode} tools`}
      style={{
        position: "absolute",
        top: "50%",
        left: 12,
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 5,
        borderRadius: 10,
        background: theme.hudBg,
        border: `1px solid ${theme.hudBorder}`,
        backdropFilter: "blur(12px)",
        boxShadow: theme.floatShadow,
        // Only the buttons take the pointer: the rail floats over the sheet, and
        // the gaps between them should still reach the canvas underneath.
        pointerEvents: "none",
      }}
    >
      {content}
    </div>
  );
}
