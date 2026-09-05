import { useRef, useState } from "react";
import { Circle, Image as ImageIcon, Minus, Spline, SquarePen, Trash2, Upload, Waypoints, X } from "lucide-react";
import { MORPH_SHAPE } from "../../core/constants.js";
import {
  CHANNEL_INFO,
  EDITABLE_CHANNELS,
  FALLOFFS,
  IMAGE_CHANNELS,
  MAX_CONTROLLERS,
  MAX_POLYLINE_POINTS,
} from "../../fields/controllers.js";
import { effectiveHoleShape } from "../../core/pipeline.js";
import { layoutReadsSpacing } from "../../layouts/index.js";
import { addPolylinePoint, removePolylinePoint } from "../../fields/controller-gizmo.js";
import { useEditor } from "../EditorContext.jsx";
import { Select, SliderRow, Toggle } from "../controls/index.js";
import { readImageFile } from "../useImageMaps.js";
import { MONO } from "../theme.js";
import { Section } from "./Section.jsx";

const KIND_ICON = { point: Circle, line: Minus, curve: Spline, polyline: Waypoints, image: ImageIcon };
const KINDS = ["point", "line", "curve", "polyline", "image"];
// An image cannot drive spacing — its brightness map is decoded asynchronously
// and left out of share links, so it may not decide where a hole goes. See
// IMAGE_CHANNELS in fields/controllers.js.
const kindsFor = channel => (IMAGE_CHANNELS.includes(channel) ? KINDS : KINDS.filter(kind => kind !== "image"));

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
  const kinds = kindsFor(activeChannel);

  // Selected state has to reach assistive tech, not just the eye: every chip
  // below is a button whose only "on" cue is its colour.
  const chipProps = active => ({ "aria-pressed": active });
  const chip = (active, extra = {}) => ({
    border: `1px solid ${active ? theme.accent : theme.border}`,
    borderRadius: 4,
    background: active ? theme.accentBg : "transparent",
    color: active ? theme.accent : theme.textSecondary,
    fontSize: 9,
    cursor: "pointer",
    fontFamily: MONO,
    padding: "6px 2px",
    ...extra,
  });
  const groupLabel = {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: theme.textSecondary,
    marginBottom: 6,
  };
  const iconBtn = (extra = {}) => ({
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    background: theme.controlBg,
    color: theme.textPrimary,
    cursor: "pointer",
    ...extra,
  });

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

  return (
    <Section
      title="Field Controllers"
      theme={theme}
      right={
        <Toggle value={fields.enabled} onChange={actions.setFieldsEnabled} dark={dark} label="Field Controllers" />
      }
    >
      <div style={{ fontSize: 9, color: theme.textSecondary, marginBottom: 10, lineHeight: 1.6 }}>
        Drop a controller on the sheet and it drives one channel — how big the holes near it are, how far apart they
        sit, which way they turn, or what shape they take.
      </div>

      <button
        onClick={actions.toggleFieldEditMode}
        aria-label="Edit field controllers on the canvas"
        aria-pressed={fieldEditMode}
        style={{
          width: "100%",
          height: 31,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          border: `1px solid ${fieldEditMode ? theme.accent : theme.border}`,
          borderRadius: 4,
          background: fieldEditMode ? theme.accentBg : theme.controlBg,
          color: fieldEditMode ? theme.accent : theme.textPrimary,
          fontSize: 10,
          cursor: "pointer",
          fontFamily: MONO,
          marginBottom: 12,
        }}
      >
        <SquarePen size={11} /> {fieldEditMode ? "Editing Canvas" : "Edit on Canvas"}
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
            {" "}
            {/* prettier-ignore */}
            {EDITABLE_CHANNELS.map(channel => (
              <button
                key={channel}
                onClick={() => actions.selectChannel(channel)}
                aria-label={`${CHANNEL_INFO[channel].label} field channel`}
                {...chipProps(activeChannel === channel)}
                style={chip(activeChannel === channel)}
              >
                {CHANNEL_INFO[channel].label}
              </button>
            ))}
          </div>

          {shapeInert && (
            <div
              style={{
                padding: "7px 9px",
                borderRadius: 5,
                background: theme.warnBg,
                color: theme.textSecondary,
                fontSize: 9,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              The shape channel morphs the <strong>{MORPH_SHAPE}</strong> hole between a diamond, an ellipse and a
              square. Pick that hole shape in Pattern to see it.
            </div>
          )}

          {spacingInert && (
            <div
              style={{
                padding: "7px 9px",
                borderRadius: 5,
                background: theme.warnBg,
                color: theme.textSecondary,
                fontSize: 9,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
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
                  onClick={() => actions.addController(kind)}
                  disabled={full}
                  aria-label={`Add ${kind} controller`}
                  title={full ? `At most ${MAX_CONTROLLERS} controllers` : `Add a ${kind} controller`}
                  style={chip(false, {
                    height: 40,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    opacity: full ? 0.4 : 1,
                    cursor: full ? "default" : "pointer",
                  })}
                >
                  <Icon size={12} />
                  {kind}
                </button>
              );
            })}
          </div>

          {channelControllers.length === 0 ? (
            <div style={{ fontSize: 9, color: theme.textSecondary, lineHeight: 1.6 }}>
              No {info.label.toLowerCase()} controller yet.
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
                        })}
                      >
                        <Icon size={11} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1, textAlign: "left" }}>{controller.kind}</span>
                        <span>
                          {controller.target.toFixed(info.decimals)}
                          {info.unit}
                        </span>
                      </button>
                      <Toggle
                        value={controller.enabled}
                        onChange={next => actions.updateController(controller.id, { enabled: next })}
                        dark={dark}
                        label={`${info.label} ${controller.kind} controller ${index + 1} enabled`}
                      />
                      <button
                        onClick={() => actions.removeController(controller.id)}
                        aria-label={`Remove ${info.label.toLowerCase()} ${controller.kind} controller ${index + 1}`}
                        title="Remove this controller"
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
              <div style={groupLabel}>Selected — {selected.kind}</div>
              <SliderRow
                label={`Target ${info.label}`}
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
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[
                    ["Add a vertex", addPolylinePoint, selected.geometry.points.length >= MAX_POLYLINE_POINTS, `+ vertex (${selected.geometry.points.length})`, `At most ${MAX_POLYLINE_POINTS} vertices`], // prettier-ignore
                    ["Remove a vertex", removePolylinePoint, selected.geometry.points.length <= 2, "− vertex", "A polyline needs two vertices"], // prettier-ignore
                  ].map(([name, edit, atLimit, text, why]) => (
                    <button
                      key={name}
                      onClick={() => {
                        const patch = edit(selected);
                        if (patch) update(patch);
                      }}
                      disabled={atLimit}
                      aria-label={name}
                      title={atLimit ? why : name}
                      style={chip(false, {
                        flex: 1,
                        height: 26,
                        opacity: atLimit ? 0.4 : 1,
                        cursor: atLimit ? "default" : "pointer",
                      })}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}

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
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <button
                      onClick={() => fileInput.current?.click()}
                      aria-label={selected.image?.assetId ? "Replace the controller image" : "Load a controller image"}
                      style={chip(false, { flex: 1, height: 28 })}
                    >
                      <Upload size={11} style={{ marginRight: 4, verticalAlign: -1 }} />
                      {selected.image?.assetId ? "Replace image" : "Load image"}
                    </button>
                    {selected.image?.assetId && (
                      <button
                        onClick={() => actions.clearControllerImage(selected.id)}
                        aria-label="Remove image"
                        style={iconBtn({ color: theme.warn })}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: imageError ? theme.warn : theme.textSecondary,
                      marginBottom: 10,
                      lineHeight: 1.6,
                    }}
                  >
                    {" "}
                    {/* prettier-ignore */}
                    {imageError ||
                      (selected.image?.assetId && assets[selected.image.assetId]
                        ? `${assets[selected.image.assetId].name} · ${assets[selected.image.assetId].width}×${assets[selected.image.assetId].height} — brightness drives the channel. Saved with the file, left out of share links.`
                        : "No picture yet, so this controller does nothing. Load one, or drop an image anywhere on the page.")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 9,
                      color: theme.textSecondary,
                      marginBottom: 10,
                    }}
                  >
                    {" "}
                    {/* prettier-ignore */}
                    Invert
                    <Toggle
                      value={selected.image?.invert ?? false}
                      onChange={invert => update({ image: { ...selected.image, invert } })}
                      dark={dark}
                      label="Invert image"
                    />
                  </div>
                  <SliderRow
                    label="Gamma"
                    value={selected.image?.gamma ?? 1}
                    min={0.1}
                    max={5}
                    step={0.05}
                    onChange={gamma => update({ image: { ...selected.image, gamma } }, true)}
                    dark={dark}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <SliderRow
                      label="Level Min"
                      value={Math.round((selected.image?.min ?? 0) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={value => update({ image: { ...selected.image, min: value / 100 } }, true)}
                      unit="%"
                      dark={dark}
                    />
                    <SliderRow
                      label="Level Max"
                      value={Math.round((selected.image?.max ?? 1) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={value => update({ image: { ...selected.image, max: value / 100 } }, true)}
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
                    <div style={{ fontSize: 9, color: theme.textSecondary, marginTop: 5, lineHeight: 1.6 }}>
                      Its shape is edited on the controller it follows; only its reach is its own.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {fields.controllers.length > 0 && (
            <button
              onClick={actions.clearControllers}
              aria-label="Remove every field controller"
              style={{
                width: "100%",
                height: 26,
                marginTop: 4,
                border: `1px solid ${theme.border}`,
                borderRadius: 4,
                background: "transparent",
                color: theme.textSecondary,
                fontSize: 9,
                cursor: "pointer",
                fontFamily: MONO,
              }}
            >
              Remove every controller
            </button>
          )}
        </>
      )}
    </Section>
  );
}
