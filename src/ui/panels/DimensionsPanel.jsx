import { MoveVertical, Shuffle, Waypoints } from "lucide-react";
import { CUSTOM_SHAPE, DIAMOND_ORIENTATIONS, RADIAL_LAYOUTS, RADIAL_MODES } from "../../core/constants.js";
import { SHAPE_PRESETS } from "../../geometry/shape-presets.js";
import { useEditor } from "../EditorContext.jsx";
import { Dropdown, LinkButton, PitchInfo, SegRow, SliderRow, Toggle } from "../controls/index.js";
import { actionButtonStyle } from "../controls/index.js";
import { MONO } from "../theme.js";
import { Section, hintStyle, noteStyle, subLabelStyle } from "./Section.jsx";

export function DimensionsPanel() {
  const { doc, api, theme, geometry: g, stats, actions } = useEditor();
  const { dark } = theme;
  const { hole, layout } = doc;
  const { radial, crosshatch } = layout;
  const isRadial = layout.type === "Radial";
  const setP = actions.setWithPresetReset;
  const faint = { marginLeft: 6, fontSize: 9, color: theme.textMuted };
  const crossingAngle = Math.round((Math.asin(Math.min(1, g.crossSin)) * 180) / Math.PI);
  // Cross-hatch and the three free-form modes refuse a pattern finer than they
  // can draw, rather than filling part of the sheet and leaving the rest blank.
  // Refusing is only the better answer if it says so: an empty canvas with no
  // explanation is worse than either.
  const empty = (g.isCrosshatch || g.usesFreeSpacing || g.isFlow) && stats.holeCount === 0 && !g.crossDegenerate;
  // Every mode that refuses a pattern it cannot draw reaches 0 holes that way,
  // but Path has a second route to it: the curves can be dragged clean off the
  // panel, and telling someone their pattern is too fine when their curve is
  // 500 mm to the left is worse than saying nothing. A vertex bounding box that
  // misses the perforation rectangle proves the curve does; anything else falls
  // through to the answer that is right for every other mode.
  const pathBox = layout.path.paths.flatMap(path => path.points);
  const { frame } = g.region;
  const offPanel =
    g.isPath &&
    pathBox.length > 0 &&
    (Math.max(...pathBox.map(p => p.x)) < frame.xMin ||
      Math.min(...pathBox.map(p => p.x)) > frame.xMax ||
      Math.max(...pathBox.map(p => p.y)) < frame.yMin ||
      Math.min(...pathBox.map(p => p.y)) > frame.yMax);
  const tooFine = empty && !offPanel;
  // Voronoi draws each hole as its own cell, so the controls that shape the
  // chosen hole — its orientation and its corner radius — have nothing to act
  // on. The size sliders stay: they still set how big a cell is.
  const imposedShape = g.holeShape !== hole.shape;
  // The preset shapes each carry one parameter and, some of them, a count;
  // both are read across the preset's own range, so the sliders show the
  // document's 0…1 and the preset's own label.
  const preset = !imposedShape ? SHAPE_PRESETS[hole.shape] : null;
  const isCustom = hole.shape === CUSTOM_SHAPE && !imposedShape;
  const lockAspect = isCustom && hole.custom.lockAspect;
  // Cross-hatch derives each family's line spacing from the hole's shape along
  // the other family's direction, so a hole that is not round can put the two
  // families at different pitches even with the gaps linked; both are shown
  // whenever they differ.
  const crossPitchesMatch = Math.abs(g.crossPitchA - g.crossPitchB) < 1e-9;

  return (
    <Section id="dimensions" title="Dimensions" theme={theme}>
      {tooFine && (
        <div style={hintStyle(theme)}>
          {doc.layout.type} cannot draw a pattern this fine on a sheet this size, so it has placed nothing rather than
          filling part of it. Widen the edge gap, enlarge the hole, or shrink the panel.
        </div>
      )}
      {empty && offPanel && (
        <div style={hintStyle(theme)}>
          Every curve is off the panel, so there is nothing to string holes along. Drag the vertices back onto the
          sheet, or remove the curve to get the default one back.
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
      {hole.shape === "Diamond" && !imposedShape && (
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
          {isCustom && (
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: theme.textSecondary }}>
                Keep proportions (H = W × {hole.custom.aspect.toFixed(2)})
              </span>
              <Toggle
                value={hole.custom.lockAspect}
                onChange={v => api.set("hole.custom.lockAspect", v)}
                dark={dark}
                label="Keep proportions"
              />
            </label>
          )}
          {(hole.shape === "Triangle" && hole.triEquilateral) || lockAspect ? (
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
          {hole.shape === "Rectangle" && !imposedShape && (
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
          {preset && (
            <SliderRow
              label={preset.ratio.label}
              value={hole.ratio}
              min={0}
              max={1}
              step={0.01}
              onChange={v => api.set("hole.ratio", v)}
              dark={dark}
            />
          )}
          {preset?.count && (
            <SliderRow
              label={preset.count.label}
              value={Math.min(preset.count.max, Math.max(preset.count.min, hole.count))}
              min={preset.count.min}
              max={preset.count.max}
              step={1}
              onChange={v => api.set("hole.count", Math.round(v))}
              dark={dark}
            />
          )}
          {(hole.shape === "Diamond" || hole.shape === "Triangle") && !imposedShape && (
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
          label={g.isFlow ? "Slot Width" : imposedShape ? "Cell Size" : "Hole Diameter"}
          value={hole.diameter}
          min={0.5}
          max={20}
          step={0.1}
          onChange={v => setP("hole.diameter", v)}
          unit="mm"
          dark={dark}
        />
      )}
      {hole.shape === "Hexagon" && !imposedShape && (
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
      {/* A Voronoi cell has no corner radius of its own to inherit, so this is
          the one control the mode adds to the hole block. Each cell clamps it to
          what its own corners can take, so a value past that simply rounds them
          as far as they go. */}
      {layout.type === "Voronoi" && (
        <SliderRow
          label="Cell Corner R"
          value={hole.cornerRadius}
          min={0}
          max={10}
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

      {/* Path's curves have a page of their own on the rail; the step along
          them is the Along Gap below. */}
      {/* Flow Lines: the heading the streamlines take where no angle controller
          bends them. Everything else about the mode is the hole size (the slot
          width) and the edge gap (the metal between two slots), which the size
          and spacing controls below already are. */}
      {g.isFlow && (
        <SliderRow
          label="Flow Direction"
          value={layout.flow.angle}
          min={-180}
          max={180}
          step={1}
          onChange={v => api.set("layout.flow.angle", v)}
          unit="°"
          dark={dark}
        />
      )}

      {/* Scatter and Voronoi are the layouts that draw random numbers, so the
          seed is part of the document: the same seed places the same holes
          everywhere. They share one seed because they share one point set —
          Voronoi cells are the Scatter points' cells — so switching between the
          two modes keeps the arrangement rather than reshuffling it. */}
      {(layout.type === "Scatter" || layout.type === "Voronoi") && (
        <>
          <SliderRow
            label={g.isVoronoi ? "Cell Seed" : "Scatter Seed"}
            value={layout.scatter.seed}
            min={0}
            max={99999}
            step={1}
            onChange={v => api.set("layout.scatter.seed", Math.round(v))}
            dark={dark}
          />
          <button
            onClick={actions.reseedScatter}
            aria-label={g.isVoronoi ? "Shuffle the cell seed" : "Shuffle the scatter seed"}
            title="Try another arrangement at the same density"
            className="pg-hover"
            style={actionButtonStyle(theme, false, { width: "100%", marginBottom: 12 })}
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
      ) : g.usesFreeSpacing ? (
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
            label={layout.type === "Spiral" || layout.type === "Path" ? "Along Gap" : "Edge Gap"}
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo
            label={
              layout.type === "Spiral" || layout.type === "Path"
                ? "step along the path"
                : layout.type === "Voronoi"
                  ? "min cell spacing"
                  : "min centre spacing"
            }
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
                : layout.type === "Path"
                  ? "Equal steps along each path · drag its points on the canvas"
                  : layout.type === "Voronoi"
                    ? `Voronoi cells · ${layout.edgeGapX.toFixed(2)} mm of metal between any two`
                    : "Golden angle · Fermat spiral"}
          </div>
        </>
      ) : g.isFlow ? (
        <>
          <SliderRow
            label="Edge Gap"
            value={layout.edgeGapX}
            min={0}
            max={50}
            step={0.1}
            onChange={actions.setEdgeGapX}
            unit="mm"
            dark={dark}
          />
          <PitchInfo label="line separation" value={g.pitchX} dark={dark} />
          <div style={noteStyle(theme)}>
            Streamlines · {layout.edgeGapX.toFixed(2)} mm of metal between any two
            <span style={faint}>slot {g.effW.toFixed(2)} mm wide</span>
          </div>
          <div style={hintStyle(theme)}>
            Every line runs at the Flow Direction above. An Angle controller bends them around it — that field is what
            the lines follow.
          </div>
          <button
            onClick={actions.addFlowDirection}
            aria-label="Add an angle controller to steer the flow"
            title="Drops a point controller on the Angle channel, ready to drag"
            className="pg-hover"
            style={actionButtonStyle(theme, false, { width: "100%", marginBottom: 12 })}
          >
            <Waypoints size={11} /> Steer the Flow
          </button>
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
          <PitchInfo label={crossPitchesMatch ? "line pitch" : "A line pitch"} value={g.crossPitchA} dark={dark} />
          {!layout.gapLinked && (
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
          )}
          {!crossPitchesMatch && <PitchInfo label="B line pitch" value={g.crossPitchB} dark={dark} />}
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
    </Section>
  );
}
