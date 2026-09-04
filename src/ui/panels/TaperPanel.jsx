import { TAPER_DIRECTIONS } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { SegRow, SliderRow, Toggle } from "../controls/index.js";
import { Section } from "./Section.jsx";

export function TaperPanel() {
  const { doc, api, theme, geometry: g, stats } = useEditor();
  const { dark } = theme;
  const { taper, variation } = doc;
  const { taperActive } = g;
  return (
    <Section
      title="Sheet Thickness & Hole Taper"
      theme={theme}
      collapsed={!taper.enabled}
      right={
        <Toggle
          value={taper.enabled}
          onChange={v => api.set("taper.enabled", v)}
          dark={dark}
          label="Sheet Thickness & Hole Taper"
        />
      }
    >
      <SliderRow
        label="Thickness (t)"
        value={taper.thickness}
        min={0}
        max={10}
        step={0.1}
        onChange={v => api.set("taper.thickness", v)}
        unit="mm"
        dark={dark}
      />
      <SliderRow
        label="Taper Angle (θ)"
        value={taper.angle}
        min={0}
        max={15}
        step={0.1}
        onChange={v => api.set("taper.angle", v)}
        unit="°"
        dark={dark}
      />
      {taperActive && (
        <>
          <div style={{ marginTop: 2 }}>
            <SegRow
              label="Taper Direction"
              options={TAPER_DIRECTIONS}
              value={taper.direction}
              onChange={v => api.set("taper.direction", v)}
              theme={theme}
            />
          </div>
          <div
            style={{
              marginTop: -6,
              padding: "5px 8px",
              borderRadius: 4,
              background: stats.hasClosedHoles ? theme.warnBg : theme.accentBgSoft,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 9, color: theme.textSecondary }}>
              {variation.enabled ? "Exit Range" : "Exit Diameter"}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: stats.hasClosedHoles ? theme.warn : theme.accent }}>
              {stats.holeClosed
                ? "0 (all closed)"
                : variation.enabled
                  ? `${stats.minExit.toFixed(2)}–${stats.maxExit.toFixed(2)} mm`
                  : `${stats.dExit.toFixed(2)} mm`}
            </span>
          </div>
        </>
      )}
      {!taperActive && (
        <div style={{ fontSize: 9, color: theme.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          Set thickness and angle above 0 to enable taper compensation.
        </div>
      )}
    </Section>
  );
}
