import { useRef, useState } from "react";
import { Circle, Contrast, Image as ImageIcon, Maximize2, Minus, Spline, SquarePen, Trash2, Upload, Waypoints, X } from "lucide-react"; // prettier-ignore
import { MORPH_SHAPE } from "../../core/constants.js";
import {
  CHANNEL_INFO,
  EDITABLE_CHANNELS,
  FALLOFFS,
  imageChannels,
  MAX_CONTROLLERS,
  MAX_POLYLINE_POINTS,
} from "../../fields/controllers.js";
import { effectiveHoleShape } from "../../core/pipeline.js";
import { layoutPlacementChannels, layoutReadsSpacing } from "../../layouts/index.js";
import { addPolylinePoint, removePolylinePoint } from "../../fields/controller-gizmo.js";
import { transferBrightness } from "../../fields/image-map.js";
import { useEditor } from "../EditorContext.jsx";
import { Select, SliderRow, Toggle } from "../controls/index.js";
import { actionButtonStyle, chipStyle, ghostButtonStyle, iconButtonStyle, noticeStyle, rowLabelStyle } from "../controls/index.js"; // prettier-ignore
import { readImageFile } from "../useImageMaps.js";
import { channelColor } from "../theme.js";
import { Section, groupLabelStyle, hintStyle } from "./Section.jsx";

const KIND_ICON = { point: Circle, line: Minus, curve: Spline, polyline: Waypoints, image: ImageIcon };
const KINDS = ["point", "line", "curve", "polyline", "image"];
// An image cannot drive a channel the mode places by — its brightness map is
// decoded asynchronously and left out of share links, so it may not decide where
// a hole goes. See imageChannels in fields/controllers.js.
const kindsFor = (channel, allowed) => (allowed.includes(channel) ? KINDS : KINDS.filter(kind => kind !== "image"));

// The transfer curve of an image controller — brightness in, channel value out
// — as a small graph, so gamma, the levels and the two ends can be read at a
// glance instead of inferred from four sliders.
function TransferCurve({ controller, theme, colour }) {
  const info = CHANNEL_INFO[controller.channel];
  const image = controller.image || {};
  const halftone = image.mode === "halftone";
  const low = Number.isFinite(image.low) ? image.low : info.base;
  const span = info.max - info.min || 1;
  const points = [];
  for (let i = 0; i <= 32; i++) {
    const b = i / 32;
    const cover = transferBrightness(b, image);
    // In the halftone mode the picture sets the value; in the mask mode it sets
    // how far the value is pulled from the base toward the target.
    const value = halftone ? low + (controller.target - low) * cover : info.base + (controller.target - info.base) * cover; // prettier-ignore
    points.push(`${(b * 100).toFixed(1)},${(100 - ((value - info.min) / span) * 100).toFixed(1)}`);
  }
  const baseY = 100 - ((info.base - info.min) / span) * 100;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        width: "100%",
        height: 56,
        display: "block",
        borderRadius: 6,
        background: theme.controlBg,
        border: `1px solid ${theme.sectionBorder}`,
      }}
    >
      <defs>
        <linearGradient id="pg-tone" x1="0" x2="1">
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <rect x="0" y="94" width="100" height="6" fill="url(#pg-tone)" opacity="0.6" />
      <line
        x1="0"
        x2="100"
        y1={baseY}
        y2={baseY}
        stroke={theme.textFaint}
        strokeWidth="0.8"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FieldsPanel() {
  const { doc, theme, ui, actions, selectedController: selected } = useEditor();
  const { dark } = theme;
  const { fields, assets } = doc;
  const { fieldEditMode, activeChannel, selectedControllerId } = ui;
  const fileInput = useRef(null);
  const [imageError, setImageError] = useState("");

  const channelControllers = fields.controllers.filter(c => c.channel === activeChannel);
  const info = CHANNEL_INFO[activeChannel];
  const full = fields.controllers.length >= MAX_CONTROLLERS;
  // Two channels can be live and still have nothing to act on here. Say so
  // rather than letting them look broken: the shape channel needs the one hole
  // shape with a free parameter, and the spacing channel needs a layout mode
  // that lays holes out row by row or point by point.
  // The EFFECTIVE shape, so a mode that imposes one answers for it: a Voronoi
  // cell is a polygon nothing morphs, whatever the dropdown still says.
  const shape = effectiveHoleShape(doc);
  const shapeInert = activeChannel === "shape" && shape !== MORPH_SHAPE;
  const spacingInert = activeChannel === "spacing" && !layoutReadsSpacing(shape, doc.layout.type);
  const kinds = kindsFor(activeChannel, imageChannels(layoutPlacementChannels(doc.layout.type)));
  const colour = channelColor(theme, activeChannel);

  // Selected state has to reach assistive tech, not just the eye: every chip
  // below is a button whose only "on" cue is its colour.
  const chipProps = active => ({ "aria-pressed": active });
  const chip = (active, extra = {}) => chipStyle(theme, active, extra);
  const groupLabel = groupLabelStyle(theme);
  const iconBtn = (extra = {}) => iconButtonStyle(theme, extra);

  const pickImage = async file => {
    if (!file || !selected) return;
    setImageError("");
    try {
      actions.setControllerImage(selected.id, await readImageFile(file));
    } catch (err) {
      setImageError(`Could not read ${file.name}: ${err.message}`);
    }
  };

  const update = (patch, live = false) => actions.updateController(selected.id, patch, live);
  // An image places itself with a rectangle rather than points, so it can be
  // neither end of a sync. Numbered per channel, because two size points would
  // otherwise both read "Size · point" with no way to tell them apart.
  const syncOptions =
    selected && selected.kind !== "image"
      ? fields.controllers
          .map((c, i) => ({ c, index: fields.controllers.filter(o => o.channel === c.channel).indexOf(c) + 1, i }))
          .filter(({ c }) => c.id !== selected.id && c.kind !== "image")
          .map(({ c, index }) => ({ value: c.id, label: `${CHANNEL_INFO[c.channel].label} ${index} · ${c.kind}` }))
      : [];
  const image = selected?.kind === "image" ? selected.image || {} : null;
  const halftone = image?.mode === "halftone";
  const asset = image?.assetId ? assets[image.assetId] : null;

  return (
    <Section
      id="fields"
      title="Field Controllers"
      theme={theme}
      right={
        <Toggle value={fields.enabled} onChange={actions.setFieldsEnabled} dark={dark} label="Field Controllers" />
      }
    >
      <div style={hintStyle(theme)}>
        A point, line, curve, polyline or picture on the sheet drives one channel around it: how big the holes are, how
        far apart they sit, which way they turn, or what shape they take.
      </div>

      <button
        onClick={actions.toggleFieldEditMode}
        aria-label="Edit field controllers on the canvas"
        aria-pressed={fieldEditMode}
        style={actionButtonStyle(theme, fieldEditMode, { width: "100%", marginBottom: 12 })}
      >
        <SquarePen size={11} /> {fieldEditMode ? "Editing on canvas · F" : "Edit on Canvas · F"}
      </button>

      {fields.enabled && (
        <>
          <div style={groupLabel}>Channel</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${EDITABLE_CHANNELS.length}, 1fr)`,
              gap: 4,
              marginBottom: 12,
            }}
          >
            {EDITABLE_CHANNELS.map(channel => {
              const active = activeChannel === channel;
              const tint = channelColor(theme, channel);
              const count = fields.controllers.filter(c => c.channel === channel).length;
              return (
                <button
                  key={channel}
                  onClick={() => actions.selectChannel(channel)}
                  aria-label={`${CHANNEL_INFO[channel].label} field channel`}
                  {...chipProps(active)}
                  style={chip(active, {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    borderColor: active ? `${tint}88` : theme.border,
                    background: active ? `${tint}1f` : "transparent",
                    color: active ? tint : theme.textSecondary,
                  })}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: 6, height: 6, borderRadius: 3, background: tint, opacity: active ? 1 : 0.5 }}
                  />
                  {CHANNEL_INFO[channel].label}
                  {count > 0 && <span style={{ opacity: 0.7 }}>{count}</span>}
                </button>
              );
            })}
          </div>

          {shapeInert && (
            <div style={noticeStyle(theme, true)}>
              The shape channel morphs the <strong>{MORPH_SHAPE}</strong> hole between a diamond, an ellipse and a
              square. Pick that hole shape in Pattern to see it.
            </div>
          )}

          {spacingInert && (
            <div style={noticeStyle(theme, true)}>
              {doc.layout.type === "Radial"
                ? "Radial does not read this channel: two of its three ring layouts place their rings by solving for the gaps they are given, so there is no one pitch to scale. Spiral and Fibonacci are the variable-density radial patterns."
                : `${shape} on ${doc.layout.type} is an exact interlocking tiling with the same ligament on every edge — a spacing field would be stretching the tiling, not varying its density. Change the hole shape or the pattern type to use this channel.`}
            </div>
          )}

          <div style={groupLabel}>
            Add ({fields.controllers.length}/{MAX_CONTROLLERS})
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: `repeat(${kinds.length}, 1fr)`, gap: 4, marginBottom: 12 }}
          >
            {kinds.map(kind => {
              const Icon = KIND_ICON[kind];
              return (
                <button
                  key={kind}
                  className="pg-hover"
                  onClick={() => actions.addController(kind)}
                  disabled={full}
                  aria-label={`Add ${kind} controller`}
                  title={full ? `At most ${MAX_CONTROLLERS} controllers` : `Add a ${kind} controller`}
                  style={chip(false, {
                    height: 42,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    opacity: full ? 0.4 : 1,
                    cursor: full ? "default" : "pointer",
                  })}
                >
                  <Icon size={13} />
                  {kind}
                </button>
              );
            })}
          </div>

          {channelControllers.length === 0 ? (
            <div style={hintStyle(theme)}>
              No {info.label.toLowerCase()} controller yet. Add one above, or pick a tool on the canvas rail and draw it
              where you want it.
            </div>
          ) : (
            <>
              <div style={groupLabel}>{info.label} controllers</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                {channelControllers.map((controller, index) => {
                  const Icon = KIND_ICON[controller.kind] || Circle;
                  const active = controller.id === selectedControllerId;
                  return (
                    <div key={controller.id} style={{ display: "flex", gap: 4 }}>
                      <button
                        className="pg-hover"
                        onClick={() => actions.selectController(controller.id)}
                        aria-label={`Select ${info.label.toLowerCase()} ${controller.kind} controller ${index + 1}`}
                        {...chipProps(active)}
                        style={chip(active, {
                          flex: 1,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "0 8px",
                          opacity: controller.enabled ? 1 : 0.5,
                          borderColor: active ? `${colour}88` : theme.border,
                          background: active ? `${colour}1f` : "transparent",
                          color: active ? colour : theme.textSecondary,
                        })}
                      >
                        <Icon size={11} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, textAlign: "left" }}>
                          {controller.kind}
                          {controller.syncWith ? " · follows" : ""}
                        </span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {controller.kind === "image" && controller.image?.mode === "halftone"
                            ? `${(controller.image.low ?? info.base).toFixed(info.decimals)}–${controller.target.toFixed(info.decimals)}${info.unit}`
                            : `${controller.target.toFixed(info.decimals)}${info.unit}`}
                        </span>
                      </button>
                      <Toggle
                        value={controller.enabled}
                        onChange={next => actions.updateController(controller.id, { enabled: next })}
                        dark={dark}
                        label={`${info.label} ${controller.kind} controller ${index + 1} enabled`}
                      />
                      <button
                        className="pg-hover"
                        onClick={() => actions.removeController(controller.id)}
                        aria-label={`Remove ${info.label.toLowerCase()} ${controller.kind} controller ${index + 1}`}
                        title="Remove this controller (Delete on the canvas)"
                        style={iconBtn({ color: theme.warn })}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {selected && selected.channel === activeChannel && (
            <div style={{ borderTop: `1px solid ${theme.sectionBorder}`, paddingTop: 12 }}>
              <div style={{ ...groupLabel, display: "flex", justifyContent: "space-between" }}>
                <span>Selected — {selected.kind}</span>
                {selected.kind === "image" && (
                  <span style={{ color: theme.textFaint }}>{halftone ? "halftone" : "mask"}</span>
                )}
              </div>

              {selected.kind === "image" && (
                <>
                  <div style={groupLabel}>Picture</div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    aria-label="Controller image"
                    style={{ display: "none" }}
                    onChange={e => {
                      pickImage(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {asset && (
                      <img
                        src={asset.dataURL}
                        alt=""
                        width={40}
                        height={40}
                        style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: `1px solid ${theme.sectionBorder}`, flexShrink: 0 }} // prettier-ignore
                      />
                    )}
                    <button
                      className="pg-hover"
                      onClick={() => fileInput.current?.click()}
                      aria-label={image.assetId ? "Replace the controller image" : "Load a controller image"}
                      style={chip(false, { flex: 1, height: asset ? 40 : 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 })} // prettier-ignore
                    >
                      <Upload size={11} />
                      {image.assetId ? "Replace image" : "Load image"}
                    </button>
                    {image.assetId && (
                      <button
                        className="pg-hover"
                        onClick={() => actions.clearControllerImage(selected.id)}
                        aria-label="Remove image"
                        title="Remove the picture"
                        style={iconBtn({ color: theme.warn, height: 40 })}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      ...hintStyle(theme),
                      marginBottom: 10,
                      color: imageError ? theme.warn : theme.textSecondary,
                    }}
                  >
                    {imageError ||
                      (asset
                        ? `${asset.name} · ${asset.width}×${asset.height} — brightness drives the channel. Saved with the file, left out of share links.`
                        : "No picture yet, so this controller does nothing. Load one, or drop an image anywhere on the page.")}
                  </div>

                  <div style={groupLabel}>Reads the picture as</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                    {[
                      ["halftone", "Halftone", "Black reads the dark value, white the light one — a photograph becomes a halftone of hole sizes"], // prettier-ignore
                      ["mask", "Mask", "Brightness is how hard it pulls toward the target; black is no pull, so it composes with other controllers"], // prettier-ignore
                    ].map(([mode, label, why]) => (
                      <button
                        key={mode}
                        onClick={() => update({ image: { ...image, mode } })}
                        aria-label={`Read the image as a ${label.toLowerCase()}`}
                        title={why}
                        {...chipProps(image.mode === mode)}
                        style={chip(image.mode === mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                    <button
                      className="pg-hover"
                      onClick={() => actions.applyHalftonePreset(selected.id)}
                      aria-label="Apply the halftone preset"
                      title="Full tonal range: dark pixels well below neutral, light ones well above"
                      style={{ ...ghostButtonStyle(theme), display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} // prettier-ignore
                    >
                      <Contrast size={11} /> Halftone preset
                    </button>
                    <button
                      className="pg-hover"
                      onClick={() => actions.fitImageToArea(selected.id)}
                      aria-label="Fit the image to the perforation area"
                      title="Stretch the picture's rectangle over the whole perforation area"
                      style={{ ...ghostButtonStyle(theme), display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} // prettier-ignore
                    >
                      <Maximize2 size={11} /> Fit to sheet
                    </button>
                  </div>
                  <TransferCurve controller={selected} theme={theme} colour={colour} />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 9,
                      color: theme.textMuted,
                      margin: "4px 2px 10px",
                    }}
                  >
                    <span>dark pixels</span>
                    <span>brightness → {info.label.toLowerCase()}</span>
                    <span>light pixels</span>
                  </div>
                </>
              )}

              {halftone && (
                <SliderRow
                  label={`Dark → ${info.label}`}
                  value={Number.isFinite(image.low) ? image.low : info.base}
                  min={info.min}
                  max={info.max}
                  step={info.step}
                  onChange={low => update({ image: { ...image, low } }, true)}
                  unit={info.unit}
                  dark={dark}
                />
              )}
              <SliderRow
                label={halftone ? `Light → ${info.label}` : `Target ${info.label}`}
                value={selected.target}
                min={info.min}
                max={info.max}
                step={info.step}
                onChange={target => update({ target }, true)}
                unit={info.unit}
                dark={dark}
              />
              {selected.kind !== "image" && (
                <>
                  <SliderRow
                    label="Reach"
                    value={selected.radius}
                    min={0.5}
                    max={Math.max(10, Math.round(Math.max(doc.sheet.w, doc.sheet.h)))}
                    step={0.5}
                    onChange={radius => update({ radius }, true)}
                    unit="mm"
                    dark={dark}
                  />
                  <div style={groupLabel}>Falloff</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 12 }}>
                    {FALLOFFS.map(falloff => (
                      <button
                        key={falloff}
                        onClick={() => update({ falloff })}
                        aria-label={`${falloff} falloff`}
                        {...chipProps(selected.falloff === falloff)}
                        style={chip(selected.falloff === falloff)}
                      >
                        {falloff}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <SliderRow
                label="Strength"
                value={Math.round(selected.strength * 100)}
                min={0}
                max={100}
                step={1}
                onChange={value => update({ strength: value / 100 }, true)}
                unit="%"
                dark={dark}
              />

              {selected.kind !== "point" && selected.kind !== "image" && (
                <>
                  <div style={groupLabel}>Reaches</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 12 }}>
                    {[
                      [-1, "left"],
                      [0, "both"],
                      [1, "right"],
                    ].map(([value, label]) => (
                      <button
                        key={label}
                        onClick={() => update({ oneSided: value })}
                        aria-label={`Reaches ${label}`}
                        {...chipProps(selected.oneSided === value)}
                        style={chip(selected.oneSided === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {selected.kind === "polyline" && (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    {[
                      ["Add a vertex", addPolylinePoint, selected.geometry.points.length >= MAX_POLYLINE_POINTS, `+ vertex (${selected.geometry.points.length})`, `At most ${MAX_POLYLINE_POINTS} vertices`], // prettier-ignore
                      ["Remove a vertex", removePolylinePoint, selected.geometry.points.length <= 2, "− vertex", "A polyline needs two vertices"], // prettier-ignore
                    ].map(([name, edit, atLimit, text, why]) => (
                      <button
                        key={name}
                        className="pg-hover"
                        onClick={() => {
                          const patch = edit(selected);
                          if (patch) update(patch);
                        }}
                        disabled={atLimit}
                        aria-label={name}
                        title={atLimit ? why : name}
                        style={ghostButtonStyle(theme, { flex: 1, opacity: atLimit ? 0.4 : 1, cursor: atLimit ? "default" : "pointer" })} // prettier-ignore
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                  <div style={hintStyle(theme)}>
                    On the canvas, double-click the line to add a vertex where you click, and a vertex to drop it.
                  </div>
                </>
              )}

              {selected.kind === "image" && (
                <>
                  <div style={groupLabel}>Tone</div>
                  <div style={rowLabelStyle(theme)}>
                    Invert
                    <Toggle
                      value={image.invert ?? false}
                      onChange={invert => update({ image: { ...image, invert } })}
                      dark={dark}
                      label="Invert image"
                    />
                  </div>
                  <SliderRow
                    label="Gamma"
                    value={image.gamma ?? 1}
                    min={0.1}
                    max={5}
                    step={0.05}
                    onChange={gamma => update({ image: { ...image, gamma } }, true)}
                    dark={dark}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <SliderRow
                      label="Level Min"
                      value={Math.round((image.min ?? 0) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={value => update({ image: { ...image, min: value / 100 } }, true)}
                      unit="%"
                      dark={dark}
                    />
                    <SliderRow
                      label="Level Max"
                      value={Math.round((image.max ?? 1) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={value => update({ image: { ...image, max: value / 100 } }, true)}
                      unit="%"
                      dark={dark}
                    />
                  </div>
                </>
              )}

              {syncOptions.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 5 }}>
                    Follow the geometry of
                  </div>
                  <Select
                    value={selected.syncWith || ""}
                    placeholder="Its own geometry"
                    onChange={id => update({ syncWith: id || null })}
                    dark={dark}
                    ariaLabel="Follow the geometry of"
                    options={[{ value: "", label: "Its own geometry" }, ...syncOptions]}
                  />
                  {selected.syncWith && (
                    <div style={{ ...hintStyle(theme), marginTop: 5, marginBottom: 0 }}>
                      Its shape is edited on the controller it follows; only its reach is its own.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {fields.controllers.length > 0 && (
            <button
              className="pg-hover"
              onClick={actions.clearControllers}
              aria-label="Remove every field controller"
              style={ghostButtonStyle(theme, { width: "100%", marginTop: 4 })}
            >
              Remove every controller
            </button>
          )}
        </>
      )}
    </Section>
  );
}
