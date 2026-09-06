import { useEffect, useRef, useState } from "react";
import { EXPORT_LAYERS, exportScale } from "../export/profiles.js";
import { fileStem } from "../core/persistence.js";
import { useEditor } from "./EditorContext.jsx";
import { MONO } from "./theme.js";

export function ExportDialog({ onClose }) {
  const { doc, params, stats, theme, exportFile } = useEditor();
  const dialog = useRef(null);
  const [format, setFormat] = useState("SVG");
  const [units, setUnits] = useState("mm");
  const [mode, setMode] = useState("cut");
  const [kerf, setKerf] = useState("0");
  const [direction, setDirection] = useState("inward");
  const [layers, setLayers] = useState(EXPORT_LAYERS);
  const [filename, setFilename] = useState(() => fileStem(doc));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const png = format === "PNG",
    taper = params.thickness > 0 && params.taperAngle > 0;
  const scale = exportScale(units),
    ligament = stats.minLigament;
  const invalidKerf =
    !png && (kerf.trim() === "" || !Number.isFinite(Number(kerf)) || Number(kerf) < 0 || Number(kerf) > 5);
  const availableLayers = EXPORT_LAYERS.filter(l => l !== "HOLES_EXIT" || taper);
  const noLayers = !png && !availableLayers.some(l => layers.includes(l));
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  const field = { display: "flex", flexDirection: "column", gap: 7 };
  const control = {
    fontFamily: MONO,
    fontSize: 12,
    color: theme.textPrimary,
    background: theme.controlBg,
    border: `1px solid ${theme.inputBorder}`,
    borderRadius: 6,
    padding: "10px 12px",
    minHeight: 40,
  };
  const submit = async e => {
    e.preventDefault();
    if (busy || invalidKerf || noLayers || !filename.trim()) return;
    setBusy(true);
    setError("");
    // Give the loading state a paint before synchronous vector serialization.
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      await exportFile(format, { units, mode, kerf: Number(kerf), kerfDirection: direction, layers, filename });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="export-title"
      onCancel={e => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key !== "Tab") return;
        const controls = [...e.currentTarget.querySelectorAll("button, input, select, [tabindex]")].filter(
          el => !el.matches(":disabled") && el.tabIndex >= 0 && el.getClientRects().length
        );
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      style={{
        width: "min(520px, calc(100vw - 32px))",
        margin: "auto",
        fontSize: 12,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        padding: 24,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        background: theme.panelBg,
        color: theme.textPrimary,
        fontFamily: MONO,
        boxShadow: theme.menuShadow,
      }}
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 id="export-title" style={{ fontSize: 17, margin: 0 }}>
            Export pattern
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close export dialog" style={control}>
            Close
          </button>
        </div>
        <div
          style={{
            background: theme.cardBg,
            borderRadius: 8,
            padding: 14,
            fontSize: 11,
            lineHeight: 1.9,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <div>
            {stats.activeHoleCount.toLocaleString()} holes · {stats.displayOAR.toFixed(1)}% OAR ·{" "}
            {stats.closedHoleCount} closed
          </div>
          <div>
            Sheet {(params.sheetW * scale).toFixed(3)} × {(params.sheetH * scale).toFixed(3)} {units}
          </div>
          <div>
            Min ligament:{" "}
            {ligament == null || !Number.isFinite(ligament)
              ? "Not available"
              : `${(ligament * scale).toFixed(3)} ${units}`}
          </div>
          <div style={{ color: theme.textSecondary }}>Document values before kerf compensation.</div>
          {params.thickness > 0 && Number.isFinite(ligament) && ligament < params.thickness && (
            <div role="status" style={{ color: theme.warn }}>
              Minimum ligament is smaller than sheet thickness.
            </div>
          )}
        </div>
        <fieldset
          disabled={busy}
          style={{ display: "flex", flexDirection: "column", gap: 16, border: 0, padding: 0, margin: 0 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={field}>
              Format
              <select
                aria-label="Export format"
                value={format}
                onChange={e => setFormat(e.target.value)}
                style={control}
              >
                {["SVG", "DXF", "PNG"].map(v => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label style={field}>
              Units
              <select
                aria-label="Export units"
                value={units}
                onChange={e => setUnits(e.target.value)}
                disabled={png}
                style={control}
              >
                <option value="mm">mm</option>
                <option value="inch">inch</option>
              </select>
            </label>
          </div>
          {format === "SVG" && (
            <label style={field}>
              Style
              <select aria-label="SVG style" value={mode} onChange={e => setMode(e.target.value)} style={control}>
                <option value="cut">Cutting · strokes only</option>
                <option value="visual">Visualization · filled</option>
              </select>
            </label>
          )}
          {!png && (
            <>
              <fieldset style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12 }}>
                <legend>Layers</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {availableLayers.map(layer => (
                    <label
                      key={layer}
                      style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, fontSize: 11 }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Export ${layer}`}
                        checked={layers.includes(layer)}
                        onChange={e =>
                          setLayers(current =>
                            e.target.checked ? [...current, layer] : current.filter(l => l !== layer)
                          )
                        }
                      />
                      {layer}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={field}>
                  Kerf width (mm)
                  <input
                    aria-label="Kerf width (mm)"
                    type="number"
                    min="0"
                    max="5"
                    step="0.01"
                    value={kerf}
                    onChange={e => setKerf(e.target.value)}
                    style={control}
                  />
                </label>
                <label style={field}>
                  Hole offset
                  <select
                    aria-label="Kerf direction"
                    value={direction}
                    onChange={e => setDirection(e.target.value)}
                    style={control}
                  >
                    <option value="inward">Inward · kerf / 2</option>
                    <option value="outward">Outward · kerf / 2</option>
                  </select>
                </label>
              </div>
              <p style={{ fontSize: 11, color: theme.textSecondary, margin: 0, lineHeight: 1.6 }}>
                Kerf changes hole contours only, after boundary clipping. Collapsed contours are omitted.
                {doc.boundary.trim
                  ? " With trim, OUTLINE includes cutout contours; KEEPOUT is omitted when OUTLINE is selected."
                  : ""}
              </p>
            </>
          )}
          {png && (
            <p style={{ fontSize: 11, color: theme.textSecondary, margin: 0 }}>
              Raster visualization · 8 px/mm · {Math.round(params.sheetW * 8)} × {Math.round(params.sheetH * 8)} px.
              Vector settings do not apply.
            </p>
          )}
          <label style={field}>
            Filename
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                aria-label="Export filename"
                required
                value={filename}
                onChange={e => setFilename(e.target.value)}
                style={{ ...control, flex: 1, minWidth: 0 }}
              />
              <span style={{ fontSize: 12 }}>.{format.toLowerCase()}</span>
            </div>
          </label>
        </fieldset>
        {(invalidKerf || noLayers || error) && (
          <p role="alert" style={{ fontSize: 12, color: theme.warn, margin: 0 }}>
            {error || (invalidKerf ? "Enter a kerf from 0 to 5 mm." : "Select at least one available layer.")}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || invalidKerf || noLayers || !filename.trim()}
          style={{ ...control, background: theme.accentBg, color: theme.accent, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "Preparing export…" : `Download ${format}`}
        </button>
      </form>
    </dialog>
  );
}
