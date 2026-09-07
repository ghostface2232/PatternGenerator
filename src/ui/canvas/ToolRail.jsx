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
// cutouts; in Remove mode the way back. Each button carries only a name (and
// its shortcut) as a delayed tooltip; the icon has to say the rest.
const FIELD_TOOLS = [
  { kind: "point", Icon: Circle, tip: "Point" },
  { kind: "line", Icon: Minus, tip: "Line" },
  { kind: "curve", Icon: Spline, tip: "Curve" },
];
const FIELD_PANEL_KINDS = [
  { kind: "polyline", Icon: Waypoints, tip: "Polyline" },
  { kind: "image", Icon: ImageIcon, tip: "Image" },
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
        ? `${CHANNEL_INFO.shape.label}  ·  needs ${MORPH_SHAPE}`
        : `${CHANNEL_INFO.spacing.label}  ·  not read by this layout`;
    const allowsImage = imageChannels(layoutPlacementChannels(doc.layout.type));
    const kindDisabled = kind => full || (kind === "image" && !allowsImage.includes(activeChannel));
    const limit = `Max ${MAX_CONTROLLERS} controllers`;
    content = (
      <>
        {column(
          EDITABLE_CHANNELS.map((channel, i) => (
            <button
              key={channel}
              className="pg-hover pg-tooltip"
              onClick={() => actions.selectChannel(channel)}
              data-tip={inert(channel) ? why(channel) : `${CHANNEL_INFO[channel].label}  ·  ${i + 1}`}
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
            ...FIELD_TOOLS.map(({ kind, Icon, tip }) => (
              <button
                key={kind}
                className="pg-hover pg-tooltip"
                onClick={() => setFieldTool(fieldTool === kind ? null : kind)}
                data-tip={full ? limit : tip}
                aria-label={`Draw ${kind} controller on the canvas`}
                aria-pressed={fieldTool === kind}
                disabled={full}
                style={cell(fieldTool === kind, full)}
              >
                <Icon size={14} />
              </button>
            )),
            ...FIELD_PANEL_KINDS.map(({ kind, Icon, tip }) => (
              <button
                key={kind}
                className="pg-hover pg-tooltip"
                onClick={() => actions.addController(kind)}
                data-tip={full ? limit : kindDisabled(kind) ? `${tip}  ·  not for ${activeChannel}` : tip}
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
          className="pg-hover pg-tooltip"
          onClick={() => setPathTool(pathTool === "pen" ? null : "pen")}
          data-tip="Pen  ·  P"
          aria-label="Pen tool"
          aria-pressed={pathTool === "pen"}
          style={cell(pathTool === "pen", false)}
        >
          <PenTool size={14} />
        </button>,
        <button
          key="new"
          className="pg-hover pg-tooltip"
          onClick={() => actions.addPath()}
          disabled={paths.length >= MAX_PATHS}
          data-tip={paths.length >= MAX_PATHS ? `Max ${MAX_PATHS} curves` : "New curve"}
          aria-label="New path curve"
          style={cell(false, paths.length >= MAX_PATHS)}
        >
          <Route size={14} />
        </button>,
        <button
          key="plus"
          className="pg-hover pg-tooltip"
          onClick={() => actions.addVertex(selectedPath)}
          disabled={!current || current.points.length >= MAX_PATH_POINTS}
          data-tip="Add vertex"
          aria-label="Insert a vertex on the selected path"
          style={cell(false, !current || current.points.length >= MAX_PATH_POINTS)}
        >
          <Plus size={14} />
        </button>,
        <button
          key="minus"
          className="pg-hover pg-tooltip"
          onClick={() => actions.removeVertex(selectedPath)}
          disabled={!current || current.points.length <= 2}
          data-tip="Remove vertex"
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
                className="pg-hover pg-tooltip"
                onClick={() => actions.addCutout(shape)}
                disabled={full}
                data-tip={full ? `Max ${MAX_CUTOUTS} cutouts` : `${shape} cutout`}
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
              className="pg-hover pg-tooltip"
              onClick={actions.resetBoundaryOutline}
              data-tip="Reset outline"
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
    const none = !stats.hasRemovedHoles && doc.removedHoles.length === 0;
    content = (
      <button
        className="pg-hover pg-tooltip"
        onClick={actions.clearRemovedHoles}
        disabled={none}
        data-tip="Restore all"
        aria-label="Restore every removed hole"
        style={cell(false, none)}
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
