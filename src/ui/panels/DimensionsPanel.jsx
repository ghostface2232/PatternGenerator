import { MoveVertical, Shuffle } from "lucide-react";
import { DIAMOND_ORIENTATIONS, RADIAL_LAYOUTS, RADIAL_MODES } from "../../core/constants.js";
import { useEditor } from "../EditorContext.jsx";
import { Dropdown, LinkButton, PitchInfo, SegRow, SliderRow, Toggle } from "../controls/index.js";
import { MONO } from "../theme.js";
import { Section, hintStyle, noteStyle, subLabelStyle } from "./Section.jsx";

export function DimensionsPanel() {
  const { doc, api, theme, geometry: g, stats, actions } = useEditor();
  const { dark } = theme;
  const { hole, layout, sheet, boundary } = doc;
  const { radial, crosshatch } = layout;
  const { margins } = boundary;
  const isRadial = layout.type === "Radial";
  const setP = actions.setWithPresetReset;
  const faint = { marginLeft: 6, fontSize: 9, color: theme.textMuted };
  const crossingAngle = Math.round((Math.asin(Math.min(1, g.crossSin)) * 180) / Math.PI);
  // Cross-hatch and the three free-form modes refuse a pattern finer than they
  // can draw, rather than filling part of the sheet and leaving the rest blank.
  // Refusing is only the better answer if it says so: an empty canvas with no
  // explanation is worse than either.
  const tooFine = (g.isCrosshatch || g.isFreeform) && stats.holeCount === 0 && !g.crossDegenerate;

  return (
    <Section title="Dimensions" theme={theme}>
      {tooFine && (
        <div style={hintStyle(theme)}>
          {doc.layout.type} cannot draw a pattern this fine on a sheet this size, so it has placed nothing rather than
          filling part of it. Widen the edge gap, enlarge the hole, or shrink the panel.
        </div>
      )}
      {g.isTriTiling && (
        <div style={hintStyle(theme)}>
          ▲▽ Triangles fill in alternating up/down rows — a seamless fit at 0 gap. Every grid type shares this tiling;
          Radial places them on rings, and the free-form modes place them wherever the mode puts a hole.
        </div>
      )}
      {g.isDiamondLattice && (
        <div style={hintStyle(theme)}>
          ◆ Staggered 60° interlocks diamonds into a rhombus lattice — a seamless fit at 0 gap.
        </div>
      )}
      {hole.shape === "Diamond" && (
        <SegRow
          label="Diamond Orientation"
          options={DIAMOND_ORIENTATIONS}
          value={hole.diamondOrient}
          onChange={v => api.set("hole.diamondOrient", v)}
          render={o => (o === "Point up" ? "◆ Point up" : "◼ Flat up")}
          theme={theme}
        />
      )}

      {/* Hole size */}
      {g.hasCustomSize ? (
        <>
          <SliderRow
            label={
              hole.shape === "Triangle" ? "Base Width (W)" : hole.shape === "Diamond" ? "Width (diagonal)" : "Width (W)"
            }
            value={hole.w}
            min={0.5}
            max={30}
            step={0.1}
            onChange={v => setP("hole.w", v)}
            unit="mm"
            dark={dark}
          />
          {hole.shape === "Triangle" && (
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: theme.textSecondary }}>Equilateral (H = W·√3/2)</span>
              <Toggle
                value={hole.triEquilateral}
                onChange={v => api.set("hole.triEquilateral", v)}
                dark={dark}
                label="Equilateral"
              />
            </label>
          )}
          {hole.shape === "Triangle" && hole.triEquilateral ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                color: theme.textMuted,
                marginTop: -4,
                marginBottom: 10,
                paddingLeft: 2,
                fontFamily: MONO,
              }}
            >
              <MoveVertical size={9} style={{ flexShrink: 0 }} /> Height (H): {g.effH.toFixed(2)} mm
            </div>
          ) : (
            <SliderRow
              label={hole.shape === "Diamond" ? "Height (diagonal)" : "Height (H)"}
              value={hole.h}
              min={0.5}
              max={30}
              step={0.1}
              onChange={v => setP("hole.h", v)}
              unit="mm"
              dark={dark}
            />
          )}
          {hole.shape === "Rectangle" && (
            <SliderRow
              label="Hole Corner R"
              value={hole.cornerRadius}
              min={0}
              max={Math.min(hole.w, hole.h) / 2}
              step={0.1}
              onChange={v => api.set("hole.cornerRadius", v)}
              unit="mm"
              dark={dark}
            />
          )}
          {(hole.shape === "Diamond" || hole.shape === "Triangle") && (
            <SliderRow
              label="Hole Corner R"
              value={hole.cornerRadius}
              min={0}
              max={g.polyCornerMax}
              step={0.1}
              onChange={v => api.set("hole.cornerRadius", v)}
              unit="mm"
              dark={dark}
            />
          )}
        </>
      ) : (
        <SliderRow
          label="Hole Diameter"
          value={hole.diameter}
          min={0.5}
          max={20}
          step={0.1}
          onChange={v => setP("hole.diameter", v)}
          unit="mm"
          dark={dark}
        />
      )}
      {hole.shape === "Hexagon" && (
        <SliderRow
          label="Hole Corner R"
          value={hole.cornerRadius}
          min={0}
          max={(Math.sqrt(3) * hole.diameter) / 4}
          step={0.1}
          onChange={v => api.set("hole.cornerRadius", v)}
          unit="mm"
          dark={dark}
        />
      )}
      {layout.type === "Custom Angle" && hole.shape !== "Triangle" && (
        <SliderRow
          label="Stagger Angle"
          value={layout.customAngle}
          min={0}
          max={90}
          step={1}
          onChange={v => api.set("layout.customAngle", v)}
          unit="°"
          dark={dark}
        />
      )}

      {/* Cross-hatch: the two line families. A hole sits at every intersection,
          so it is the angle BETWEEN them that shapes the lattice — 90° apart is
          the straight grid, and near-parallel is nothing at all. */}
      {g.isCrosshatch && (
        <>
          <SliderRow
            label="Line Angle A"
            value={crosshatch.angleA}
            min={-90}
            max={90}
            step={1}
            onChange={v => api.set("layout.crosshatch.angleA", v)}
            unit="°"
            dark={dark}
          />
          <SliderRow
            label="Line Angle B"
            value={crosshatch.angleB}
            min={-90}
            max={90}
            step={1}
            onChange={v => api.set("layout.crosshatch.angleB", v)}
            unit="°"
            dark={dark}
          />
          {g.crossDegenerate ? (
            <div style={hintStyle(theme)}>
              The two line families are within {crossingAngle}° of parallel. They cut no usable lattice, so no holes are
              placed — move one angle away from the other.
            </div>
          ) : (
            <div style={noteStyle(theme)}>
              Crossing at {crossingAngle}°<span style={faint}>cell {g.crossCellArea.toFixed(1)} mm²</span>
            </div>
          )}
        </>
      )}

      {/* Scatter is the one layout that draws random numbers, so its seed is part
          of the document: the same seed places the same holes everywhere. */}
      {layout.type === "Scatter" && (
        <>
          <SliderRow
            label="Scatter Seed"
            value={layout.scatter.seed}
            min={0}
            max={99999}
            step={1}
            onChange={v => api.set("layout.scatter.seed", Math.round(v))}
            dark={dark}
          />
          <button
            onClick={actions.reseedScatter}
            aria-label="Shuffle the scatter seed"
            title="Try another arrangement at the same density"
            style={{
              width: "100%",
              height: 26,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              border: `1px solid ${theme.border}`,
              borderRadius: 4,
              background: theme.controlBg,
              color: theme.textPrimary,
              fontSize: 10,
              cursor: "pointer",
              fontFamily: MONO,
            }}
          >
            <Shuffle size={11} /> Shuffle
          </button>
        </>
      )}

      {/* Spacing */}
      {isRadial ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <Dropdown
              label="Radial Pattern"
              value={radial.layout}
              onChange={v => api.patch({ "layout.radial.layout": v, presetIndex: 0 })}
              options={RADIAL_LAYOUTS}
              theme={theme}
            />
          </div>
          {radial.layout === "Sunflower" ? (
            <>
              <SliderRow
                label="Edge Gap"
                value={g.sunflowerGap}
                min={0}
                max={50}
                step={0.1}
                onChange={actions.setSunflowerGap}
                unit="mm"
                dark={dark}
              />
              <PitchInfo label="min center spacing" value={g.sunflowerSpacing} dark={dark} />
              <div style={noteStyle(theme)}>Golden angle · Fermat spiral</div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={subLabelStyle(theme)}>Gap Link</span>
                <LinkButton
                  linked={radial.linked}
                  onClick={actions.toggleRadialLinked}
                  title={radial.linked ? "Unlink gap" : "Link gap"}
                  dark={dark}
                />
              </div>
              <SliderRow
                label="Radial Edge Gap"
                value={radial.edgeGap}
                min={0}
                max={50}
                step={0.1}
                onChange={actions.setRadialEdgeGap}
                unit="mm"
                dark={dark}
              />
              <PitchInfo label="nom. ring spacing" value={g.ringSpacing} dark={dark} />
              {!radial.linked && (
                <>
                  <SliderRow
                    label="Circum. Edge Gap"
                    value={radial.circumGap}
                    min={0}
                    max={50}
                    step={0.1}
                    onChange={actions.setCircumEdgeGap}
                    unit="mm"
                    dark={dark}
                  />
                  <PitchInfo label="min circum. spacing" value={g.circumSpacing} dark={dark} />
                </>
              )}
              {radial.linked && (
                <div style={noteStyle(theme)}>Circum. Edge Gap: {radial.edgeGap.toFixed(2)} mm (linked)</div>
              )}
              {radial.layout === "6k Rosette" && (
                <div style={noteStyle(theme)}>Ring k · 6k holes · sixfold symmetry</div>
              )}
            </>
          )}
          <SegRow
            label="Fill Mode"
            options={RADIAL_MODES}
            value={radial.mode}
            onChange={v => api.set("layout.radial.mode", v)}
            theme={theme}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: theme.textSecondary,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            <input
              type="checkbox"
              checked={radial.centerHole}
              onChange={e => api.set("layout.radial.centerHole", e.target.checked)}
              style={{ accentColor: theme.accent }}
            />
            Center hole
          </label>
        </>
      ) : g.isFreeform ? (
        <>
          {/* Scatter, Spiral and Fibonacci place holes at arbitrary angles to
              one another, so the gap is measured from the circumscribed
              diameter rather than from the width or the height. */}
          {layout.type === "Spiral" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={subLabelStyle(theme)}>Gap Link (along = turn)</span>
              <LinkButton
                linked={layout.gapLinked}
                onClick={actions.toggleGapLinked}
                title={layout.gapLinked ? "Unlink gap" : "Link gap"}
                dark={dark}
              />
            </div>
          )}
          <SliderRow
            label={layout.type === "Spiral" ? "Along Gap" : "Edge Gap"}
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo
            label={layout.type === "Spiral" ? "step along the arm" : "min centre spacing"}
            value={g.freeSpacingX}
            dark={dark}
          />
          {layout.type === "Spiral" && (
            <>
              <SliderRow
                label="Turn Gap"
                value={layout.edgeGapY}
                min={0}
                max={50}
                step={0.1}
                onChange={actions.setEdgeGapY}
                unit="mm"
                dark={dark}
              />
              <PitchInfo label="turn-to-turn spacing" value={g.freeSpacingY} dark={dark} />
            </>
          )}
          <div style={noteStyle(theme)}>
            {layout.type === "Scatter"
              ? "Poisson disk · no two holes closer than the spacing above"
              : layout.type === "Spiral"
                ? "Archimedean spiral · equal steps along the arm"
                : "Golden angle · Fermat spiral"}
          </div>
        </>
      ) : g.isCrosshatch ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={subLabelStyle(theme)}>Gap Link (A = B)</span>
            <LinkButton
              linked={layout.gapLinked}
              onClick={actions.toggleGapLinked}
              title={layout.gapLinked ? "Unlink gap" : "Link gap"}
              dark={dark}
            />
          </div>
          <SliderRow
            label={layout.gapLinked ? "Edge Gap (A = B)" : "A Edge Gap"}
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo label={layout.gapLinked ? "line pitch" : "A line pitch"} value={g.pitchX} dark={dark} />
          {!layout.gapLinked && (
            <>
              <SliderRow
                label="B Edge Gap"
                value={layout.edgeGapY}
                min={0}
                max={50}
                step={0.1}
                onChange={actions.setEdgeGapY}
                unit="mm"
                dark={dark}
              />
              <PitchInfo label="B line pitch" value={g.pitchY} dark={dark} />
            </>
          )}
        </>
      ) : g.uniformGapMode ? (
        <>
          <SliderRow
            label="Edge Gap (all sides)"
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo label={g.isTriTiling ? "column pitch" : "spacing"} value={g.uniformColPitch} dark={dark} />
          <div style={noteStyle(theme)}>
            Uniform ligament on all {g.isHexHoneycomb ? 6 : g.isDiamondLattice ? 4 : 3} edges
            <span style={faint}>row pitch {g.uniformRowPitch.toFixed(2)}</span>
          </div>
        </>
      ) : g.showGapY ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={subLabelStyle(theme)}>Gap Link (X = Y)</span>
            <LinkButton
              linked={layout.gapLinked}
              onClick={actions.toggleGapLinked}
              title={layout.gapLinked ? "Unlink gap" : "Link gap"}
              dark={dark}
            />
          </div>
          <SliderRow
            label={layout.gapLinked ? "Edge Gap (X = Y)" : "X Edge Gap"}
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo label={layout.gapLinked ? "pitch" : "X pitch"} value={g.pitchX} dark={dark} />
          {!layout.gapLinked && (
            <>
              <SliderRow
                label="Y Edge Gap"
                value={layout.edgeGapY}
                min={0}
                max={50}
                step={0.1}
                onChange={actions.setEdgeGapY}
                unit="mm"
                dark={dark}
              />
              <PitchInfo label="Y pitch" value={g.pitchY} dark={dark} />
            </>
          )}
        </>
      ) : (
        <>
          <SliderRow
            label="X Edge Gap"
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo label="X pitch" value={g.effPitchX} dark={dark} />
          <div style={noteStyle(theme)}>
            Y Edge Gap: {(g.effPitchY - g.effH).toFixed(2)} mm (auto)
            <span style={faint}>pitch {g.effPitchY.toFixed(2)}</span>
          </div>
        </>
      )}

      {/* Sheet & margins */}
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
            <SliderRow
              label="Margin Top"
              value={margins.top}
              min={0}
              max={50}
              step={0.5}
              onChange={v => api.set("boundary.margins.top", v)}
              unit="mm"
              dark={dark}
            />
            <SliderRow
              label="Margin Bottom"
              value={margins.bottom}
              min={0}
              max={50}
              step={0.5}
              onChange={v => api.set("boundary.margins.bottom", v)}
              unit="mm"
              dark={dark}
            />
            <SliderRow
              label="Margin Left"
              value={margins.left}
              min={0}
              max={50}
              step={0.5}
              onChange={v => api.set("boundary.margins.left", v)}
              unit="mm"
              dark={dark}
            />
            <SliderRow
              label="Margin Right"
              value={margins.right}
              min={0}
              max={50}
              step={0.5}
              onChange={v => api.set("boundary.margins.right", v)}
              unit="mm"
              dark={dark}
            />
          </>
        )}
      </div>
      <SliderRow
        label="Corner Radius"
        value={boundary.cornerRadius}
        min={0}
        max={Math.min(g.perfW / 2, g.perfH / 2)}
        step={0.5}
        onChange={v => api.set("boundary.cornerRadius", v)}
        unit="mm"
        dark={dark}
      />
    </Section>
  );
}
