import { Circle, Image as ImageIcon, Minus, Spline, Waypoints } from "lucide-react";
import { MORPH_SHAPE } from "../../core/constants.js";
import { CHANNEL_INFO, EDITABLE_CHANNELS, MAX_CONTROLLERS } from "../../fields/controllers.js";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";

// Left rail on the canvas: which channel is being edited, and which kind of
// controller the next canvas click drops. Only `point`, `line` and `curve` are
// armable — a polyline is built from its vertices in the inspector, and an image
// needs a file, so both are added from the Fields panel instead.
const TOOLS = [
  { kind: "point", Icon: Circle, hint: "Point — click the canvas" },
  { kind: "line", Icon: Minus, hint: "Line — drag across the canvas" },
  { kind: "curve", Icon: Spline, hint: "Curve — drag across the canvas" },
];
const PANEL_KINDS = [
  { kind: "polyline", Icon: Waypoints, hint: "Polyline — added at the centre, then shaped by its handles" },
  { kind: "image", Icon: ImageIcon, hint: "Image — added at the centre, then given a picture in the panel" },
];

export function ToolRail() {
  const { doc, theme, ui, actions } = useEditor();
  const { activeChannel, fieldTool, setFieldTool } = ui;
  const { controllers } = doc.fields;
  const full = controllers.length >= MAX_CONTROLLERS;
  // The shape channel has nothing to morph unless the hole is the one shape with
  // a free parameter. The panel explains it, but the panel scrolls and the rail
  // does not, so the rail says it too.
  const inert = channel => channel === "shape" && doc.hole.shape !== MORPH_SHAPE;

  const cell = (active, disabled) => ({
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${active ? theme.accent : theme.border}`,
    borderRadius: 5,
    background: active ? theme.accentBg : theme.hudBg,
    color: active ? theme.accent : disabled ? theme.textFaint : theme.textPrimary,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontFamily: MONO,
    fontSize: 9,
    padding: 0,
    pointerEvents: "auto",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 12,
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 6,
        borderRadius: 9,
        background: theme.hudBg,
        border: `1px solid ${theme.hudBorder}`,
        backdropFilter: "blur(10px)",
        // Only the buttons take the pointer: the rail floats over the sheet, and
        // the gaps between them should still reach the canvas underneath.
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {EDITABLE_CHANNELS.map(channel => (
          <button
            key={channel}
            onClick={() => actions.selectChannel(channel)}
            title={
              inert(channel)
                ? `${CHANNEL_INFO[channel].label} channel — needs the ${MORPH_SHAPE} hole shape`
                : `${CHANNEL_INFO[channel].label} channel`
            }
            aria-label={`${CHANNEL_INFO[channel].label} channel`}
            aria-pressed={activeChannel === channel}
            style={cell(activeChannel === channel, inert(channel))}
          >
            {CHANNEL_INFO[channel].label.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{ height: 1, background: theme.hudBorder }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {TOOLS.map(({ kind, Icon, hint }) => (
          <button
            key={kind}
            onClick={() => setFieldTool(fieldTool === kind ? null : kind)}
            title={full ? `At most ${MAX_CONTROLLERS} controllers` : hint}
            aria-label={`Draw ${kind} controller on the canvas`}
            aria-pressed={fieldTool === kind}
            disabled={full}
            style={cell(fieldTool === kind, full)}
          >
            <Icon size={13} />
          </button>
        ))}
        {PANEL_KINDS.map(({ kind, Icon, hint }) => (
          <button
            key={kind}
            onClick={() => actions.addController(kind)}
            title={full ? `At most ${MAX_CONTROLLERS} controllers` : hint}
            aria-label={`Place ${kind} controller at the centre`}
            disabled={full}
            style={cell(false, full)}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}
