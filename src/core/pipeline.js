// The pure data pipeline, document → holes → statistics. The React app calls
// these steps through memos; tests call computePattern() directly.
//
//   deriveGeometry(doc)              effective hole extents, pitches, tiling flags
//   buildParams(doc, geometry)       the flat params object for generateHoles / exports
//   compileDocumentField(doc, ctx)   the document's field controllers, ready to sample
//   decorateHoles(base, doc, g, f)   applies size variation, the field channels,
//                                    taper exit sizes and cull flags
//   filterActive(holes, removed)     drops removed / culled holes
//   computeStats(...)                OAR (theoretical or counted), ligament, overlaps
import { CUSTOM_SIZE_SHAPES, DOC_LIMITS, MORPH_SHAPE, PERF_MODE_HOLE_LIMIT } from "./constants.js";
import { clamp, DEG } from "./math.js";
import { basePolyVerts, insetConvexPoly, maxCornerRadius, polyBBox, triInradius } from "../geometry/polygon.js";
import { calcHoleArea, getShape } from "../geometry/shapes.js";
import { strokeBBox, strokeMaxWidth } from "../geometry/stroke.js";
import { superNFromMix } from "../geometry/superellipse.js";
import { estimateVisibleHoleArea, perfBoundsArea, perfBoundsFromParams } from "../geometry/boundary.js";
import { calcMinLigament, findOverlaps } from "../geometry/ligament.js";
import { calcCellOAR } from "../geometry/oar.js";
import { LAYOUTS, generateHoles, layoutFamily, layoutPlacementChannels, layoutReadsSpacing, layoutSpacingModel, tilingFlags } from "../layouts/index.js"; // prettier-ignore
import { gridLattice } from "../layouts/grid.js";
import { MIN_CROSS_SIN } from "../layouts/crosshatch.js";
import { getRadialShapeExtents, getRadialShapeOuterRadius } from "../layouts/radial-engine.js";
import { evaluateVariationField, variationScaleAt } from "../fields/variation-engine.js";
import { CHANNEL_INFO, compileControllers, compiledDrivesChannel, evaluateCompiled } from "../fields/controllers.js";

// The shape a hole is actually DRAWN as, which is the document's choice in every
// mode but one: Voronoi gives each hole its own cell polygon, so the shape
// dropdown has nothing to say about it and the `Polygon` entry in the SHAPES
// registry takes over. One function, because the answer has to be the same for
// the generator, the statistics, the canvas, the exporters and the two panels
// that grey out a channel the shape cannot show — a disagreement between any two
// of those is a hole measured as one thing and drawn as another.
const IMPOSED_SHAPES = { Voronoi: "Polygon", "Flow Lines": "Stroke" };
export const effectiveHoleShape = doc => IMPOSED_SHAPES[doc.layout.type] ?? doc.hole.shape;

export function deriveGeometry(doc) {
  const { hole, layout, sheet, boundary, taper } = doc;
  const { margins } = boundary;
  const patternType = layout.type;
  const hasCustomSize = CUSTOM_SIZE_SHAPES.includes(hole.shape);
  const effW = hasCustomSize ? hole.w : hole.diameter;
  const effH =
    hole.shape === "Triangle" && hole.triEquilateral
      ? (hole.w * Math.sqrt(3)) / 2
      : hasCustomSize
        ? hole.h
        : hole.diameter;

  const pitchX = effW + layout.edgeGapX;
  const pitchY = effH + layout.edgeGapY;
  // Hexagon honeycomb (pointy-top, 60° staggered): the edge gap is a uniform ligament, so the
  // centre spacing is 2·apothem + gap (= effW·√3/2 + gap), not effW + gap.
  // Triangle fills via its alternating ▲▽ tiling under any GRID type;
  // Diamond interlocks into a rhombus lattice under the staggered mode.
  const { isRadial, isHexHoneycomb, isTriTiling, isDiamondLattice, uniformGapMode } = tilingFlags(
    hole.shape,
    patternType
  );
  const family = layoutFamily(patternType);
  // "free" is how the modes that place holes at arbitrary angles to one another
  // measure their spacing: from the circumscribed diameter, since neither the
  // width nor the height bounds how much room one of them needs.
  const usesFreeSpacing = layoutSpacingModel(patternType) === "free";
  const isCrosshatch = family === "crosshatch";
  const isPath = family === "path";
  const isFlow = family === "flow";
  const honeyPitchX = isHexHoneycomb ? (effW * Math.sqrt(3)) / 2 + layout.edgeGapX : pitchX;
  const honeyPitchY = isHexHoneycomb ? (honeyPitchX * Math.sqrt(3)) / 2 : pitchY;
  const triIn = triInradius(effW, effH);
  const triCellK = (triIn + layout.edgeGapX / 2) / triIn;
  const diaIn = (effW * effH) / (2 * Math.hypot(effW, effH));
  const diaCellK = (diaIn + layout.edgeGapX / 2) / diaIn;

  const radial = layout.radial;
  const radialExtents = getRadialShapeExtents(hole.shape, effW, effH, hole.diamondOrient);
  const radialOuterRadius = getRadialShapeOuterRadius(hole.shape, effW, effH);
  const ringSpacing =
    radial.layout === "Concentric" ? hole.diameter + radial.edgeGap : radialExtents.radial + radial.edgeGap;
  const circumSpacing =
    radial.layout === "Concentric" ? hole.diameter + radial.circumGap : radialExtents.tangential + radial.circumGap;
  const sunflowerGap = Math.max(radial.edgeGap, radial.circumGap);
  const sunflowerSpacing = radialOuterRadius * 2 + sunflowerGap;

  // Scatter, Spiral and Fibonacci place holes at arbitrary angles to one
  // another, so neither `effW` nor `effH` bounds how much room one needs: the
  // circumscribed diameter does, and it is the same measure the Sunflower layout
  // already uses. `freeSpacingX` is the minimum centre distance for Scatter, the
  // step along the curve for Spiral and the Fermat scale for Fibonacci;
  // `freeSpacingY` is the Spiral's turn-to-turn clearance.
  const freeDiameter = radialOuterRadius * 2;
  const freeSpacingX = freeDiameter + Math.max(0, layout.edgeGapX);
  const freeSpacingY = freeDiameter + Math.max(0, layout.edgeGapY);
  // Cross-hatch: the lattice its two line families cut out. The cell is a
  // parallelogram of side pitchX/|sin Δ| by pitchY, i.e. area pitchX·pitchY/|sin Δ|,
  // which is what the theoretical open-area ratio divides by. At Δ = 90° it is
  // the rectangular cell of the Straight grid, as it should be.
  const crossAngleA = layout.crosshatch.angleA;
  const crossAngleB = layout.crosshatch.angleB;
  const crossSin = Math.abs(Math.sin(((crossAngleB - crossAngleA) * Math.PI) / 180));
  // Below MIN_CROSS_SIN the two families are near enough to parallel that their
  // lattice cell is a sliver, so the mode places nothing at all. Derived here
  // rather than in the panel so the threshold stays inside the layouts.
  const crossDegenerate = isCrosshatch && crossSin < MIN_CROSS_SIN;
  const crossCellArea = isCrosshatch && !crossDegenerate ? (pitchX * pitchY) / crossSin : null;

  const perfW = sheet.w - margins.left - margins.right;
  const perfH = sheet.h - margins.top - margins.bottom;
  const hasAnyMargin = margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0;

  const taperActive = taper.enabled && taper.thickness > 0 && taper.angle > 0;
  const taperInset = taperActive ? 2 * taper.thickness * Math.tan((taper.angle * Math.PI) / 180) : 0;

  // Effective pitchY for staggered patterns (auto-derived). In staggered layouts the
  // nearest neighbour is diagonal at (pitchX/2, effPY).
  // From `gridLattice`, which is what the generator itself walks. Working these
  // out again here is exactly how the panel came to report a 45° row pitch the
  // generator had never used, and how the theoretical open-area ratio came to
  // divide by a cell that did not exist.
  const { inRowPitchX, rowPitch: effPitchY } = gridLattice({
    holeW: effW,
    holeH: effH,
    patternType,
    pitchX,
    pitchY,
    isHexHoneycomb,
  });
  const effPitchX = honeyPitchX;
  // Spacing readouts for the uniform-ligament modes (hex / triangle / diamond)
  const uniformColPitch = isTriTiling ? (effW * triCellK) / 2 : isDiamondLattice ? effW * diaCellK : effPitchX;
  const uniformRowPitch = isTriTiling ? effH * triCellK : isDiamondLattice ? (effH * diaCellK) / 2 : effPitchY;
  const polyCornerMax =
    hole.shape === "Diamond" || hole.shape === "Triangle"
      ? Math.max(0.1, Math.floor(maxCornerRadius(basePolyVerts(hole.shape, effW, effH)) * 10) / 10)
      : 0;
  const showGapY = patternType === "Straight" || patternType === "Custom Angle";
  // The neighbour distance the ligament search sizes its grid from. It only has
  // to be the right order of magnitude — too small and a genuinely nearest pair
  // could fall outside the search, too large and the search compares more pairs
  // than it needs.
  const nominalSpacing = isRadial
    ? Math.max(ringSpacing, circumSpacing)
    : usesFreeSpacing
      ? Math.max(freeSpacingX, freeSpacingY)
      : Math.max(pitchX, pitchY);

  return {
    hasCustomSize,
    // The shape the holes are drawn as. `hole.shape` above still sizes them —
    // in Voronoi the width and height sliders set how big a cell is, since the
    // sites are sown at the circumscribed diameter plus the gap like every other
    // free-form mode.
    holeShape: effectiveHoleShape(doc),
    effW,
    effH,
    pitchX,
    pitchY,
    isHexHoneycomb,
    honeyPitchX,
    honeyPitchY,
    isRadial,
    isTriTiling,
    isDiamondLattice,
    uniformGapMode,
    family,
    usesFreeSpacing,
    isCrosshatch,
    isPath,
    isFlow,
    hasUnitCell: LAYOUTS[patternType]?.theoretical === true,
    crossAngleA,
    crossAngleB,
    crossSin,
    crossDegenerate,
    crossCellArea,
    flowAngle: layout.flow.angle,
    freeDiameter,
    freeSpacingX,
    freeSpacingY,
    nominalSpacing,
    triCellK,
    diaCellK,
    ringSpacing,
    circumSpacing,
    sunflowerGap,
    sunflowerSpacing,
    perfW,
    perfH,
    hasAnyMargin,
    taperActive,
    taperInset,
    effPitchX,
    effPitchY,
    inRowPitchX,
    // The unit cell of the grid family: one hole per (in-row pitch × row pitch).
    gridCellArea: inRowPitchX * effPitchY,
    uniformColPitch,
    uniformRowPitch,
    polyCornerMax,
    showGapY,
  };
}

export function buildParams(doc, g) {
  const { hole, layout, sheet, boundary, taper } = doc;
  const { margins } = boundary;
  return {
    diameter: hole.diameter,
    holeShape: g.holeShape,
    holeW: g.effW,
    holeH: g.effH,
    holeRadius: hole.cornerRadius,
    diamondOrient: hole.diamondOrient,
    patternType: layout.type,
    pitchX: g.pitchX,
    pitchY: g.pitchY,
    sheetW: sheet.w,
    sheetH: sheet.h,
    marginTop: margins.top,
    marginBottom: margins.bottom,
    marginLeft: margins.left,
    marginRight: margins.right,
    cornerRadius: boundary.cornerRadius,
    customAngle: layout.customAngle,
    radialEdgeGap: layout.radial.edgeGap,
    circumEdgeGap: layout.radial.circumGap,
    ringSpacing: g.ringSpacing,
    circumSpacing: g.circumSpacing,
    radialMode: layout.radial.mode,
    radialLayout: layout.radial.layout,
    centerHole: layout.radial.centerHole,
    crossAngleA: g.crossAngleA,
    crossAngleB: g.crossAngleB,
    scatterSeed: layout.scatter.seed,
    freeSpacingX: g.freeSpacingX,
    freeSpacingY: g.freeSpacingY,
    // The ligament a Voronoi cell is inset to leave, which is the edge gap
    // itself and not the pitch it is folded into above. Two documents with the
    // same `freeSpacingX` can split it differently between the hole size and the
    // gap — a big hole with a narrow gap, a small one with a wide gap — and they
    // are different patterns, so the split has to be signed, not just the sum.
    cellGap: Math.max(0, layout.edgeGapX),
    // Flow Lines: the heading its streamlines take where no angle controller
    // bends them. The separation between two lines is `pitchX` and the width of
    // one is `holeW`, both already above — the mode measures itself from the
    // hole and the edge gap exactly as the grid family does.
    flowAngle: g.flowAngle,
    thickness: taper.enabled ? taper.thickness : 0,
    taperAngle: taper.enabled ? taper.angle : 0,
    taperDirection: taper.direction,
  };
}

// A document with no field controllers compiles to this, and every `has*` check
// below then short-circuits: the per-hole cost of the whole controller system on
// a document that does not use one is a single `.some()` over an empty array.
const NO_FIELD = [];

// A document's `fields` block, flattened and ready to sample. Takes the block
// rather than the whole document so the React memo can key on it alone — the
// document changes identity on every edit, the fields block only on its own.
// `ctx` carries the decoded image maps (`{ imageMaps }`), which only the UI has;
// a controller whose picture is missing compiles away rather than reading black.
export function compileDocumentField(fields, ctx = {}) {
  if (!fields?.enabled || !fields.controllers?.length) return NO_FIELD;
  return compileControllers(fields.controllers, ctx);
}

// The ctx `compileDocumentField` needs: the decoded image maps the UI holds,
// plus which channels this mode places by — an image may not drive one of those,
// and which they are depends on the mode. Takes the layout type rather than the
// document so a React memo can key on the one value that changes the answer.
export const fieldContext = (layoutType, imageMaps) => ({
  imageMaps,
  placementChannels: layoutPlacementChannels(layoutType),
});

// ─── The spacing channel ──────────────────────────────────────────────
// The one field channel that decides where a hole goes rather than what it looks
// like, so it is compiled separately from the rest and handed to the layouts.
// `null` when the document has no spacing controller, which is the common case
// and the one that has to cost nothing: the layouts then run the arithmetic they
// always ran, to the last bit, and every pinned baseline still holds.
//
// The returned object carries four things, and they must come from one place —
// a sampler and a signature that disagreed would be a hole that moves without
// the signature saying so, and removed-hole indices left pointing at the wrong
// holes:
//
//   sample(x, y)  the pitch multiplier at a point, clamped to the slider range
//   signature     what patternSignature adds for this channel
//   min, max      rigorous bounds on `sample`. The blend in evaluateCompiled is
//                 a convex combination of the base value and the targets, so the
//                 extremes of those bound every value it can return — which is
//                 what lets the scatter sampler size its search grid and the
//                 spiral its opening radius without either one guessing.
const SPACING_RANGE = DOC_LIMITS["controller.target.spacing"];

export function compileSpacing(fields) {
  if (!fields?.enabled || !fields.controllers?.length) return null;
  if (!fields.controllers.some(c => c.channel === "spacing")) return null;
  // The whole list is compiled, not just the spacing entries: a spacing
  // controller may borrow another channel's geometry through `syncWith`.
  const compiled = compileControllers(fields.controllers).filter(entry => entry.channel === "spacing");
  // A controller whose target IS the channel's neutral value has to compile away
  // entirely, not to a field that returns 1 everywhere. The two are the same
  // number and a very different pattern: a field, however neutral, puts the grid
  // on its accumulating row walk, and summing `pitch` a hundred times does not
  // land on `cy + 100·pitch` to the last bit. One row falling a bit-width past
  // the sheet edge dropped 31 holes from a 961-hole document while the open-area
  // readout — correctly, since `activeFieldChannels` already knew the controller
  // was inert — did not move at all.
  if (!compiledDrivesChannel(compiled, "spacing")) return null;
  const base = CHANNEL_INFO.spacing.base;
  const [lo, hi] = SPACING_RANGE;
  let min = base,
    max = base;
  for (const entry of compiled) {
    if (entry.target < min) min = entry.target;
    if (entry.target > max) max = entry.target;
  }
  return {
    sample: (x, y) => clamp(evaluateCompiled(compiled, "spacing", x, y, base), lo, hi),
    // The compiled entries rather than the authored ones: this is exactly what
    // the layouts will read, so two documents that place holes identically sign
    // identically, and a disabled or inert controller does not clear a removal.
    signature: JSON.stringify(compiled),
    min: clamp(min, lo, hi),
    max: clamp(max, lo, hi),
  };
}

// Everything `generateHoles` needs that is not a primitive, compiled once and
// signed once. Today that is the spacing field and the Path layout's curves;
// both move holes, neither fits in a record of primitives, and both have to be
// covered by the same signature the removed-hole rule reads.
//
// `null` when this document has neither, which is the common case and the one
// that has to cost nothing: the layouts then run the arithmetic they always ran,
// to the last bit, and every pinned baseline still holds.
//
// The decision about which modes read the spacing channel lives here rather than
// in the generator, so the sampler and the signature cannot disagree about it —
// a field the signature covered but the layout ignored used to clear the user's
// hole removals for nothing.
export function compilePlacement(doc) {
  const channels = layoutPlacementChannels(doc.layout.type);
  const spacing =
    channels.includes("spacing") && layoutReadsSpacing(doc.hole.shape, doc.layout.type)
      ? compileSpacing(doc.fields)
      : null;
  const angle = channels.includes("angle") ? compileChannelField(doc.fields, "angle") : null;
  const path = doc.layout.type === "Path" ? doc.layout.path : null;
  if (!spacing && !angle && !path) return null;
  return {
    spacing,
    angle,
    path,
    signature: JSON.stringify([spacing?.signature ?? "", angle?.signature ?? "", path ?? null]),
  };
}

// A channel compiled for a layout to read directly, rather than for
// decorateHoles to draw with. Same shape as `compileSpacing` above minus the
// bounds nothing needs here, and the same two refusals: no controller on the
// channel, or none that moves it off its neutral value, compiles to null so the
// mode runs the arithmetic it always ran.
//
// Image controllers are absent by construction — `compileControllers` is called
// with no decoded bitmaps, so one compiles away — and the editor will not let a
// picture onto a placement channel in the first place (imageChannels).
export function compileChannelField(fields, channel) {
  if (!fields?.enabled || !fields.controllers?.length) return null;
  if (!fields.controllers.some(c => c.channel === channel)) return null;
  const compiled = compileControllers(fields.controllers).filter(entry => entry.channel === channel);
  if (!compiledDrivesChannel(compiled, channel)) return null;
  const base = CHANNEL_INFO[channel].base;
  return {
    sample: (x, y) => evaluateCompiled(compiled, channel, x, y, base),
    signature: JSON.stringify(compiled),
  };
}

// Which channels a compiled field actually changes for THIS document. Two ways a
// controller can be inert: the shape cannot show what it drives (an angle over
// Circles, a morph over anything but the superellipse), or its target IS the
// channel's neutral value. Both matter twice over — an angle a shape cannot
// draw would still widen the rotated bounding box `estimateVisibleHoleArea`
// samples over, and either would push the statistics onto the counted-OAR path,
// which reports a slightly different figure for identical geometry. A 1.0× size
// controller moving the headline OAR from 35.4 to 35.6 is the readout lying
// about a change that did not happen.
//
// What this deliberately does NOT catch is a controller whose reach falls
// entirely off the sheet, or a 60° rotation of a hexagon: both need geometry
// this function does not have. They are conservative in the same direction — the
// counted figure is the honest one, just more expensive.
//
// The spacing channel is here too, and it is the odd one out: it moves holes
// rather than redrawing them, so it is not applied in decorateHoles at all. It
// still belongs in this answer, because "did a controller change this pattern?"
// is the question the counted-OAR switch asks — and a layout whose rows the
// field has stretched has no unit cell left to divide by. Whether the mode reads
// the channel at all is part of it: the three uniform-ligament tilings and
// Radial do not (see layoutReadsSpacing), and a controller they ignore must not
// move the readout either.
export function activeFieldChannels(doc, field = NO_FIELD) {
  // The effective shape, so that a mode which replaces it answers for it: a
  // Voronoi cell is a polygon nothing rotates and nothing morphs, whatever the
  // dropdown still says, and an angle or morph controller over one is inert.
  const shape = effectiveHoleShape(doc);
  return {
    size: compiledDrivesChannel(field, "size"),
    // A shape that is not drawn rotated still answers yes where the LAYOUT reads
    // the channel: in Flow Lines the angle field is the direction the lines run
    // in, so it changes the pattern completely without turning a single hole.
    angle:
      compiledDrivesChannel(field, "angle") &&
      (getShape(shape).rotates || layoutPlacementChannels(doc.layout.type).includes("angle")),
    // The shape channel blends against the document's own mix, so that — not
    // CHANNEL_INFO's constant — is the neutral value a controller must differ
    // from to be doing anything.
    shape: shape === MORPH_SHAPE && compiledDrivesChannel(field, "shape", doc.hole.shapeMix ?? 0.5),
    spacing: compiledDrivesChannel(field, "spacing") && layoutReadsSpacing(shape, doc.layout.type),
  };
}

export const anyFieldChannel = active => active.size || active.angle || active.shape || active.spacing;

// How a hole is resized, for the two modes that hand one its own geometry.
//
// An ordinary hole is a w × h box scaled about its centre, and the taper takes
// the same inset off every side of it. Neither statement survives a hole that is
// a shape in its own right, so each of those gets the operation that means the
// same thing for it:
//
//   a Voronoi cell    scales about its own site, and the taper ERODES it — every
//                     edge moved inward by half the inset, which is exactly what
//                     a tapered wall does to a convex outline
//   a Flow Lines slot keeps its centreline and takes its width from the field at
//                     each vertex, so one slot narrows and widens along its
//                     length; the taper thins it by half the inset a side
//
// `minSize` is what the variation cull compares against, and it is the reason
// this is not simply the bounding box: the smallest dimension of a slot is its
// width, not the length of the panel it crosses.
function decorateOutline(base, { scale, scaleAt, effW, effH, taperActive, taperInset }) {
  if (base.poly) {
    const poly = base.poly.map(([px, py]) => [px * scale, py * scale]);
    const exitPoly = taperActive ? insetConvexPoly(poly, taperInset / 2) : poly;
    const box = polyBBox(poly),
      exitBox = polyBBox(exitPoly);
    const w = Math.max(0.01, box.right - box.left),
      h = Math.max(0.01, box.bottom - box.top);
    return {
      outline: { poly, exitPoly },
      entry: poly,
      exit: exitPoly,
      w,
      h,
      exitW: exitBox.right - exitBox.left,
      exitH: exitBox.bottom - exitBox.top,
      minSize: Math.min(w, h),
      closed: exitPoly.length < 3,
    };
  }
  if (base.stroke) {
    const pts = base.stroke.pts;
    const halfW = pts.map(([dx, dy]) => Math.max(0, (effW / 2) * scaleAt(base.x + dx, base.y + dy)));
    const stroke = { pts, halfW };
    const exitStroke = taperActive ? { pts, halfW: halfW.map(value => Math.max(0, value - taperInset / 2)) } : stroke;
    const box = strokeBBox(stroke),
      exitBox = strokeBBox(exitStroke);
    return {
      outline: { stroke, exitStroke },
      entry: stroke,
      exit: exitStroke,
      w: Math.max(0.01, box.right - box.left),
      h: Math.max(0.01, box.bottom - box.top),
      exitW: Math.max(0, exitBox.right - exitBox.left),
      exitH: Math.max(0, exitBox.bottom - exitBox.top),
      // The widest point of the slot: a line is one hole and cannot be culled in
      // the middle, so it goes only when the whole of it is below the floor.
      minSize: strokeMaxWidth(stroke),
      closed: strokeMaxWidth(exitStroke) <= 0,
    };
  }
  const w = Math.max(0.01, effW * scale),
    h = Math.max(0.01, effH * scale);
  const exitW = taperActive ? Math.max(0, w - taperInset) : w;
  const exitH = taperActive ? Math.max(0, h - taperInset) : h;
  return { outline: null, entry: null, exit: null, w, h, exitW, exitH, minSize: Math.min(w, h), closed: exitW <= 0 || exitH <= 0 }; // prettier-ignore
}

// Apply size variation, the field channels, taper exit sizes and the size-floor
// cull to raw centres. `field` is the output of compileDocumentField.
export function decorateHoles(baseHoles, doc, g, field = NO_FIELD) {
  const { variation, hole, boundary } = doc;
  const { margins } = boundary;
  const { effW, effH, perfW, perfH, taperActive, taperInset, holeShape } = g;
  const holeRadius = hole.cornerRadius;
  const morphs = holeShape === MORPH_SHAPE;
  const baseMix = hole.shapeMix ?? 0.5;
  const baseSuperN = morphs ? superNFromMix(baseMix) : undefined;
  const { size: hasSize, angle: hasAngle, shape: hasShape } = activeFieldChannels(doc, field);
  return baseHoles.map((base, index) => {
    const nx = perfW > 0 ? clamp((base.x - margins.left) / perfW, 0, 1) : 0.5;
    const ny = perfH > 0 ? clamp((base.y - margins.top) / perfH, 0, 1) : 0.5;
    // Controllers are placed in sheet millimetres, so they are sampled at the
    // hole's real position — not at the normalised (nx, ny) the variation field
    // uses, which would move every controller when a margin changes.
    //
    // As a function of the point rather than a single number, because a Flow
    // Lines slot is not at one point: it reads the size field at every vertex of
    // its own centreline, so a gradient tapers one slot along its length instead
    // of setting a width for the whole of it from wherever its middle happens to
    // be. Called at the hole's origin, it is exactly the value it always was.
    const scaleAt = (px, py) => {
      const vx = perfW > 0 ? clamp((px - margins.left) / perfW, 0, 1) : 0.5;
      const vy = perfH > 0 ? clamp((py - margins.top) / perfH, 0, 1) : 0.5;
      return variationScaleAt(vx, vy, variation, index + 1) * (hasSize ? evaluateCompiled(field, "size", px, py) : 1);
    };
    const scale = scaleAt(base.x, base.y);
    const angle = hasAngle ? (base.angle || 0) + evaluateCompiled(field, "angle", base.x, base.y) * DEG : base.angle;
    const superN = hasShape ? superNFromMix(evaluateCompiled(field, "shape", base.x, base.y, baseMix)) : baseSuperN;
    const size = decorateOutline(base, { scale, scaleAt, effW, effH, taperActive, taperInset });
    const { w, h, exitW, exitH } = size;
    const culled = variation.enabled && variation.cullBelow > 0 && size.minSize < variation.cullBelow;
    const scaledRadius = Math.min(holeRadius * scale, w / 2, h / 2);
    const exitHoleRadius = Math.max(0, Math.min(scaledRadius - taperInset / 2, exitW / 2, exitH / 2));
    return {
      ...base,
      id: base.id || `hole-${index}`,
      culled,
      fieldValue: variation.enabled ? evaluateVariationField(nx, ny, variation, index + 1) : 1,
      scale,
      angle,
      superN,
      ...size.outline,
      w,
      h,
      holeRadius: scaledRadius,
      area: calcHoleArea(holeShape, w, h, scaledRadius, size.entry ?? superN),
      exitW,
      exitH,
      exitHoleRadius,
      exitArea: size.closed ? 0 : calcHoleArea(holeShape, exitW, exitH, exitHoleRadius, size.exit ?? superN),
      isClosed: taperActive && size.closed,
    };
  });
}

export function filterActive(holes, removedSet) {
  return holes.filter((hole, i) => !removedSet.has(i) && !hole.culled);
}

export function computeStats({ doc, g, params, holes, activeHoles, removedSet, overlaps, field = NO_FIELD }) {
  const { hole, sheet, boundary, variation } = doc;
  const shape = g.holeShape;
  const baseSuperN = shape === MORPH_SHAPE ? superNFromMix(hole.shapeMix ?? 0.5) : undefined;
  const { effW, effH, taperActive, taperInset } = g;
  const perfBounds = perfBoundsFromParams(params);
  const activeHoleCount = activeHoles.length;
  const holeCount = holes.length;
  const culledHoleCount = holes.reduce((n, h, i) => n + (h.culled && !removedSet.has(i) ? 1 : 0), 0);
  const grossArea = sheet.w * sheet.h;
  const perforatedArea = perfBoundsArea(perfBounds);

  const visible = activeHoles.reduce(
    (totals, h) => ({
      nominal: totals.nominal + estimateVisibleHoleArea(h, shape, perfBounds, false),
      exit: totals.exit + estimateVisibleHoleArea(h, shape, perfBounds, true),
    }),
    { nominal: 0, exit: 0 }
  );
  const totalHoleArea = visible.nominal;
  const totalExitHoleArea = visible.exit;
  const singleHoleArea = activeHoleCount > 0 ? totalHoleArea / activeHoleCount : 0;

  // OAR: theoretical (unit cell) for clean infinite patterns, counted whenever
  // margins, corner radius, removal, variation or radial mode make it wrong.
  // Only indices that address a hole in this list count. A document can arrive
  // with removals recorded against a different pattern (a hand-edited file, a
  // link from another version), and those must not read as removed holes.
  const removedHoleCount = holeCount - activeHoleCount - culledHoleCount;
  const hasRemovedHoles = removedHoleCount > 0;
  // A controller that this document's shape can actually show makes the unit
  // cell a fiction — size and shape vary the hole area across the sheet, and
  // angle turns holes into the boundary — so the counted path takes over for
  // exactly the reason variation already does.
  const hasFieldControllers = anyFieldChannel(activeFieldChannels(doc, field));
  // `g.hasUnitCell` is the layout registry's own answer — Radial, Scatter,
  // Spiral and Fibonacci place holes that are not a lattice, so the only honest
  // open-area figure for them is the counted one, and the registry is where that
  // fact is written down rather than repeated here.
  //
  // A pattern with no holes is the other case with no unit cell to divide by:
  // a Cross-hatch whose two line families are parallel places nothing, and used
  // to report the straight grid's 30.7% over an empty sheet.
  const useCountedOAR =
    variation.enabled || hasFieldControllers || hasRemovedHoles || g.hasAnyMargin || boundary.cornerRadius > 0 || !g.hasUnitCell || holeCount === 0; // prettier-ignore
  const theoreticalHoleArea = calcHoleArea(shape, effW, effH, hole.cornerRadius, baseSuperN);
  // Triangle tiling / diamond lattice: one hole per tiling cell (the hole
  // expanded by gap/2), so the unit cell is simply that cell's area. Cross-hatch
  // brings its own parallelogram cell for the same reason: pitch × pitch is the
  // right cell only where the two families cross at a right angle.
  const uniformCellArea = !g.hasUnitCell
    ? null
    : g.isTriTiling
      ? ((effW * effH) / 2) * g.triCellK * g.triCellK
      : g.isDiamondLattice
        ? ((effW * effH) / 2) * g.diaCellK * g.diaCellK
        : g.isCrosshatch
          ? g.crossCellArea
          : g.gridCellArea;
  const theoreticalOAR = calcCellOAR(uniformCellArea, theoreticalHoleArea);
  const countedOAR = perforatedArea > 0 ? (totalHoleArea / perforatedArea) * 100 : 0;
  const nominalOAR = useCountedOAR ? countedOAR : theoreticalOAR;

  // Closed-hole count and exit-size extremes in one pass. This used to spread the
  // per-hole values into Math.min/Math.max, which overflows the call stack past
  // roughly 125k arguments — reachable from the sliders alone (a 200 mm panel of
  // 0.5 mm holes at zero gap is 161,001 holes in the default staggered layout).
  let closedHoleCount = 0;
  let openHoleCount = 0;
  let exitSum = 0;
  let minExit = 0;
  let maxExit = 0;
  for (const h of activeHoles) {
    if (h.isClosed) {
      closedHoleCount++;
      continue;
    }
    const exit = Math.min(h.exitW, h.exitH);
    openHoleCount++;
    exitSum += exit;
    if (openHoleCount === 1 || exit < minExit) minExit = exit;
    if (openHoleCount === 1 || exit > maxExit) maxExit = exit;
  }
  const holeClosed = activeHoleCount > 0 && closedHoleCount === activeHoleCount;
  const hasClosedHoles = closedHoleCount > 0;
  const dExit = openHoleCount ? exitSum / openHoleCount : 0;
  const theoreticalExitW = taperActive ? Math.max(0, effW - taperInset) : effW;
  const theoreticalExitH = taperActive ? Math.max(0, effH - taperInset) : effH;
  const theoreticalExitRadius = Math.max(
    0,
    Math.min(hole.cornerRadius - taperInset / 2, theoreticalExitW / 2, theoreticalExitH / 2)
  );
  const theoreticalExitArea =
    theoreticalExitW > 0 && theoreticalExitH > 0
      ? calcHoleArea(shape, theoreticalExitW, theoreticalExitH, theoreticalExitRadius, baseSuperN)
      : 0;
  const theoreticalEffOAR = calcCellOAR(uniformCellArea, theoreticalExitArea);
  const countedEffOAR = perforatedArea > 0 ? (totalExitHoleArea / perforatedArea) * 100 : 0;
  const effectiveOAR = useCountedOAR ? countedEffOAR : theoreticalEffOAR;
  const oarDelta = taperActive ? effectiveOAR - nominalOAR : 0;
  const displayOAR = taperActive ? effectiveOAR : nominalOAR;

  const minLigament = calcMinLigament(activeHoles, shape, g.nominalSpacing);
  const perfMode = holeCount > PERF_MODE_HOLE_LIMIT;

  return {
    perfBounds,
    activeHoleCount,
    holeCount,
    culledHoleCount,
    removedHoleCount,
    hasRemovedHoles,
    grossArea,
    perforatedArea,
    totalHoleArea,
    totalExitHoleArea,
    singleHoleArea,
    useCountedOAR,
    theoreticalOAR,
    countedOAR,
    nominalOAR,
    effectiveOAR,
    oarDelta,
    displayOAR,
    closedHoleCount,
    holeClosed,
    hasClosedHoles,
    dExit,
    minExit,
    maxExit,
    minLigament,
    perfMode,
    hasOverlap: overlaps.size > 0,
  };
}

// One-shot convenience for tests and headless export: the whole pipeline.
export function computePattern(doc, ctx = {}) {
  const g = deriveGeometry(doc);
  const params = buildParams(doc, g);
  const placement = compilePlacement(doc);
  const baseHoles = generateHoles(params, placement);
  const field = compileDocumentField(doc.fields, { ...fieldContext(doc.layout.type, ctx.imageMaps), ...ctx });
  const holes = decorateHoles(baseHoles, doc, g, field);
  const removedSet = new Set(doc.removedHoles);
  const activeHoles = filterActive(holes, removedSet);
  const overlaps = findOverlaps(activeHoles, g.holeShape, g.nominalSpacing);
  const stats = computeStats({ doc, g, params, holes, activeHoles, removedSet, overlaps, field });
  return { geometry: g, params, baseHoles, holes, activeHoles, removedSet, overlaps, stats, field, placement };
}

// The params generateHoles actually reads — keep in step with its destructuring.
// buildParams also carries the hole corner radius and the taper fields, which
// change how a hole is drawn but never where it sits.
//
// The size, angle and shape field channels are out for the same reason: they are
// applied in decorateHoles, after the centres exist, so a controller resizes,
// turns or morphs a hole without moving it and the removed-hole indices stay
// meaningful. `hole.shapeMix` never reaches buildParams at all.
//
// The SPACING channel does move holes, and it is the one placement input that is
// not a param: it is a sampler, and this list is primitives. It reaches
// generateHoles as a second argument and is signed separately — see
// patternSignature below, which is the value the removed-hole rule actually
// rests on.
//
// What makes this sound is structural, not empirical: generateHoles is pure in
// (params, spacing) — it reads no module state, and every sub-generator receives
// only values derived from these — so a list equal to its destructuring, plus
// the spacing signature, cannot miss a placement input. pipeline.test.js asserts
// that equality directly by parsing layouts/index.js, and separately sweeps
// documents × edits; the sweep alone catches only 18 of the 23 original entries
// if they are dropped. Four of the rest — radialEdgeGap, circumEdgeGap,
// ringSpacing, circumSpacing — cannot be isolated by any document at all, since
// each ring spacing is derived from its gap. The fifth, diameter, is redundant
// only while holeW and holeH are non-falsy: index.js reads `holeW || diameter`,
// so a zero width would make it load-bearing again. That is hypothetical today —
// DOC_LIMITS floors hole.w at 0.5 and every width slider starts there — but the
// list does not depend on the floor staying put.
export const PLACEMENT_PARAMS = [
  "diameter",
  "holeShape",
  "holeW",
  "holeH",
  "patternType",
  "pitchX",
  "pitchY",
  "sheetW",
  "sheetH",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "cornerRadius",
  "customAngle",
  "radialEdgeGap",
  "circumEdgeGap",
  "ringSpacing",
  "circumSpacing",
  "radialMode",
  "radialLayout",
  "centerHole",
  "diamondOrient",
  "crossAngleA",
  "crossAngleB",
  "scatterSeed",
  "freeSpacingX",
  "freeSpacingY",
  "cellGap",
  "flowAngle",
];

// Value signature of everything that decides where holes land. Removed-hole
// indices only stay meaningful while this is unchanged, so edits that alter it
// clear them (see ui/useDocument.js). Link flags, colours and the document name
// are absent by construction: they never reach buildParams.
export function patternSignature(doc) {
  const params = buildParams(doc, deriveGeometry(doc));
  // The second half of generateHoles' input is the second half of the signature,
  // and it comes from the same `compilePlacement` call that builds what the
  // layouts read — one function, so the signature cannot describe a field the
  // layouts do not see, or miss one they do. That includes which modes read the
  // spacing channel at all: in the four that ignore it, signing it anyway meant
  // dragging that controller's radius wiped the user's hole removals for a field
  // nothing reads.
  const placement = compilePlacement(doc)?.signature ?? "";
  // Pairs of [type, text] inside JSON. The type keeps null, undefined and NaN
  // apart — JSON alone writes all three as null in array position, and the three
  // behave very differently in the arithmetic in generateHoles. JSON's quoting
  // then stops a value that happens to contain the separator from shifting the
  // fields around it, which joining on a separator does not.
  // String() throws for a value with no primitive form, and this runs inside the
  // reducer, where a throw takes down the render. Not caught, because it cannot
  // happen: every document reaching the reducer comes either from createDocument
  // or through validateDocument, which rebuilds each field from those defaults.
  // So each param below is a number, a string or a boolean by the time it gets
  // here — pipeline.test.js asserts that over the whole document, poisoned leaf
  // by leaf, under two shapes. deriveGeometry throws first on half of the same
  // input but only half — customAngle and cornerRadius, among others, it never
  // touches — which is why validation and not the pipeline is what makes it safe.
  return JSON.stringify([PLACEMENT_PARAMS.map(key => [typeof params[key], String(params[key])]), placement]);
}
