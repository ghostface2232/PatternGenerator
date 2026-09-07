import { useRef, useState } from "react";
import { Circle, Hexagon, RectangleHorizontal, SquarePen, Upload, X } from "lucide-react";
import { BOUNDARY_SHAPES, MAX_BOUNDARY_POINTS, MAX_CUTOUTS } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { LinkButton, SegRow, SliderRow, Toggle } from "../controls/index.js";
import { actionButtonStyle, chipStyle, ghostButtonStyle, iconButtonStyle, rowLabelStyle } from "../controls/index.js"; // prettier-ignore
import { Section, groupLabelStyle, hintStyle, noteStyle, subLabelStyle } from "./Section.jsx";

const CUTOUT_ICON = { Circle, Rectangle: RectangleHorizontal, Polygon: Hexagon };

// The sheet and the region of it that receives holes: the panel size, the
// outline (rectangle, ellipse, polygon — drawn on the canvas or read from an
// SVG file), the margins and corner radius where they apply, the cutouts, and
// whether the sheet is cut to the outline.
export function BoundaryPanel() {
  const { doc, api, theme, ui, geometry: g, actions, selectedCutout } = useEditor();
  const { dark } = theme;
  const { sheet, boundary } = doc;
  const { margins } = boundary;
  const fileInput = useRef(null);
  const [importError, setImportError] = useState("");
  const isPolygon = boundary.shape === "Polygon";
  const polygonDrawn = isPolygon && boundary.rings.length > 0;
  const vertices = boundary.rings.reduce((n, ring) => n + ring.length, 0);
  const editButton = (on, onClick, label, text) => (
    <button onClick={onClick} aria-label={label} aria-pressed={on} style={actionButtonStyle(theme, on, { flex: 1 })}>
      {text}
    </button>
  );
  const chip = (active, extra = {}) => chipStyle(theme, active, extra);
  const iconBtn = (extra = {}) => iconButtonStyle(theme, extra);

  const importFile = async file => {
    if (!file) return;
    setImportError("");
    try {
      await actions.importBoundarySVG(file);
    } catch (err) {
      setImportError(`Could not use ${file.name}: ${err.message}`);
    }
  };
  const full = boundary.cutouts.length >= MAX_CUTOUTS;
  const update = (patch, live = false) => actions.updateCutout(selectedCutout.id, patch, live);

  return (
    <Section id="boundary" title="Sheet & Boundary" theme={theme}>
      <SliderRow
        label="Panel Width"
        value={sheet.w}
        min={10}
        max={1000}
        step={1}
        onChange={v => api.set("sheet.w", v)}
        unit="mm"
        dark={dark}
      />
      <SliderRow
        label="Panel Height"
        value={sheet.h}
        min={10}
        max={1000}
        step={1}
        onChange={v => api.set("sheet.h", v)}
        unit="mm"
        dark={dark}
      />

      <SegRow
        label="Boundary"
        options={BOUNDARY_SHAPES}
        value={boundary.shape}
        onChange={actions.setBoundaryShape}
        theme={theme}
        ariaLabel={o => `${o} boundary`}
      />

      {isPolygon ? (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {editButton(
              ui.boundaryEditMode,
              actions.toggleBoundaryEditMode,
              "Edit the boundary on the canvas",
              <>
                <SquarePen size={11} /> {ui.boundaryEditMode ? "Editing Canvas · B" : "Edit on Canvas · B"}
              </>
            )}
            <button
              className="pg-hover"
              onClick={() => fileInput.current?.click()}
              aria-label="Import an SVG outline as the boundary"
              title="The closed outlines of an SVG file become the boundary"
              style={{ ...chip(false, { flex: 1, height: 30, padding: "0 6px" }), display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }} // prettier-ignore
            >
              <Upload size={11} /> Import SVG
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".svg,image/svg+xml"
            aria-label="Boundary outline file"
            style={{ display: "none" }}
            onChange={e => {
              importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {importError && <div style={{ ...hintStyle(theme), color: theme.warn }}>{importError}</div>}
          <div style={noteStyle(theme)}>
            {polygonDrawn
              ? `${boundary.rings.length} ${boundary.rings.length === 1 ? "outline" : "outlines"} · ${vertices} ${vertices === 1 ? "vertex" : "vertices"}`
              : "No outline yet"}
            {vertices >= MAX_BOUNDARY_POINTS && (
              <span style={{ marginLeft: 6, color: theme.textMuted }}>at the limit</span>
            )}
          </div>
          <div style={hintStyle(theme)}>
            Even-odd rule: an outline inside another is a counter. Margins do not apply; the sheet clips the rest.
          </div>
          <button
            className="pg-hover"
            onClick={actions.resetBoundaryOutline}
            aria-label="Reset the boundary to the rectangle"
            style={ghostButtonStyle(theme, { width: "100%", marginBottom: 12 })}
          >
            Back to the rectangle
          </button>
        </>
      ) : (
        <>
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={subLabelStyle(theme)}>Margin {boundary.marginLinked ? "(Uniform)" : "(Per-side)"}</span>
              <LinkButton
                linked={boundary.marginLinked}
                onClick={actions.toggleMarginLinked}
                title={boundary.marginLinked ? "Set per-side margins" : "Use uniform margin"}
                dark={dark}
              />
            </div>
            {boundary.marginLinked ? (
              <SliderRow
                label="Margin"
                value={margins.top}
                min={0}
                max={50}
                step={0.5}
                onChange={actions.setMarginUniform}
                unit="mm"
                dark={dark}
              />
            ) : (
              <>
                {[
                  ["Margin Top", "top"],
                  ["Margin Bottom", "bottom"],
                  ["Margin Left", "left"],
                  ["Margin Right", "right"],
                ].map(([label, side]) => (
                  <SliderRow
                    key={side}
                    label={label}
                    value={margins[side]}
                    min={0}
                    max={50}
                    step={0.5}
                    onChange={v => api.set(`boundary.margins.${side}`, v)}
                    unit="mm"
                    dark={dark}
                  />
                ))}
              </>
            )}
          </div>
          {boundary.shape === "Rectangle" ? (
            <SliderRow
              label="Corner Radius"
              value={boundary.cornerRadius}
              min={0}
              max={Math.max(0, Math.min(g.perfW / 2, g.perfH / 2))}
              step={0.5}
              onChange={v => api.set("boundary.cornerRadius", v)}
              unit="mm"
              dark={dark}
            />
          ) : (
            <div style={hintStyle(theme)}>The ellipse fills the margin-inset rectangle.</div>
          )}
        </>
      )}

      <div style={groupLabelStyle(theme)}>
        Cutouts ({boundary.cutouts.length}/{MAX_CUTOUTS})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 10 }}>
        {["Circle", "Rectangle", "Polygon"].map(shape => {
          const Icon = CUTOUT_ICON[shape];
          return (
            <button
              key={shape}
              onClick={() => actions.addCutout(shape)}
              disabled={full}
              aria-label={`Add ${shape.toLowerCase()} cutout`}
              title={
                full
                  ? `At most ${MAX_CUTOUTS} cutouts`
                  : `A ${shape.toLowerCase()} keep-out at the centre, then dragged on the canvas`
              }
              className="pg-hover"
              style={chip(false, {
                height: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                opacity: full ? 0.4 : 1,
                cursor: full ? "default" : "pointer",
              })}
            >
              <Icon size={12} />
              {shape.toLowerCase()}
            </button>
          );
        })}
      </div>
      {boundary.cutouts.length > 0 && (
        <>
          {!isPolygon &&
            editButton(
              ui.boundaryEditMode,
              actions.toggleBoundaryEditMode,
              "Edit the boundary on the canvas",
              <>
                <SquarePen size={11} /> {ui.boundaryEditMode ? "Editing Canvas · B" : "Edit on Canvas · B"}
              </>
            )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "10px 0 12px" }}>
            {boundary.cutouts.map((cutout, index) => {
              const Icon = CUTOUT_ICON[cutout.shape] || Circle;
              const active = cutout.id === selectedCutout?.id;
              return (
                <div key={cutout.id} style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => actions.selectCutout(cutout.id)}
                    aria-label={`Select cutout ${index + 1}`}
                    aria-pressed={active}
                    style={chip(active, { flex: 1, height: 28, display: "flex", alignItems: "center", gap: 6, padding: "0 8px" })} // prettier-ignore
                  >
                    <Icon size={11} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: "left" }}>{cutout.shape.toLowerCase()}</span>
                    <span>
                      {cutout.shape === "Polygon"
                        ? `${cutout.points.length} pts`
                        : cutout.shape === "Circle"
                          ? `⌀${cutout.w.toFixed(1)}`
                          : `${cutout.w.toFixed(1)}×${cutout.h.toFixed(1)}`}
                    </span>
                  </button>
                  <button
                    onClick={() => actions.removeCutout(cutout.id)}
                    aria-label={`Remove cutout ${index + 1}`}
                    title="Remove this cutout"
                    style={iconBtn({ color: theme.warn })}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          {selectedCutout && selectedCutout.shape !== "Polygon" && (
            <div style={{ borderTop: `1px solid ${theme.sectionBorder}`, paddingTop: 12 }}>
              <div style={groupLabelStyle(theme)}>Selected — {selectedCutout.shape.toLowerCase()}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <SliderRow
                  label="Cutout X"
                  value={selectedCutout.x}
                  min={0}
                  max={sheet.w}
                  step={0.5}
                  onChange={x => update({ x }, true)}
                  unit="mm"
                  dark={dark}
                />
                <SliderRow
                  label="Cutout Y"
                  value={selectedCutout.y}
                  min={0}
                  max={sheet.h}
                  step={0.5}
                  onChange={y => update({ y }, true)}
                  unit="mm"
                  dark={dark}
                />
              </div>
              {selectedCutout.shape === "Circle" ? (
                <SliderRow
                  label="Cutout Diameter"
                  value={selectedCutout.w}
                  min={0.5}
                  max={Math.max(1, Math.min(sheet.w, sheet.h))}
                  step={0.5}
                  onChange={w => update({ w, h: w }, true)}
                  unit="mm"
                  dark={dark}
                />
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <SliderRow
                      label="Cutout Width"
                      value={selectedCutout.w}
                      min={0.5}
                      max={Math.max(1, sheet.w)}
                      step={0.5}
                      onChange={w => update({ w }, true)}
                      unit="mm"
                      dark={dark}
                    />
                    <SliderRow
                      label="Cutout Height"
                      value={selectedCutout.h}
                      min={0.5}
                      max={Math.max(1, sheet.h)}
                      step={0.5}
                      onChange={h => update({ h }, true)}
                      unit="mm"
                      dark={dark}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <SliderRow
                      label="Cutout Rotation"
                      value={selectedCutout.rotation}
                      min={-180}
                      max={180}
                      step={1}
                      onChange={rotation => update({ rotation }, true)}
                      unit="°"
                      dark={dark}
                    />
                    <SliderRow
                      label="Cutout Corner R"
                      value={selectedCutout.cornerRadius}
                      min={0}
                      max={Math.max(0, Math.min(selectedCutout.w, selectedCutout.h) / 2)}
                      step={0.5}
                      onChange={cornerRadius => update({ cornerRadius }, true)}
                      unit="mm"
                      dark={dark}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <label style={{ ...rowLabelStyle(theme), marginTop: 4, marginBottom: 0 }}>
        <span>Trim sheet to boundary</span>
        <Toggle
          value={boundary.trim}
          onChange={trim => api.set("boundary.trim", trim)}
          dark={dark}
          label="Trim sheet to boundary"
        />
      </label>
      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        {boundary.trim
          ? "The boundary is the part's outline: the export writes it as a cut path and the metal outside it is gone."
          : "The sheet stays rectangular; the boundary only says where the holes go."}
      </div>
    </Section>
  );
}
