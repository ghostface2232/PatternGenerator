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
import { CUSTOM_SIZE_SHAPES, MORPH_SHAPE, PERF_MODE_HOLE_LIMIT } from "./constants.js";
import { clamp, DEG } from "./math.js";
import { basePolyVerts, maxCornerRadius, triInradius } from "../geometry/polygon.js";
import { calcHoleArea, getShape } from "../geometry/shapes.js";
import { superNFromMix } from "../geometry/superellipse.js";
import { estimateVisibleHoleArea, perfBoundsArea, perfBoundsFromParams } from "../geometry/boundary.js";
import { calcMinLigament, findOverlaps } from "../geometry/ligament.js";
import { calcTheoreticalOAR } from "../geometry/oar.js";
import { generateHoles } from "../layouts/grid.js";
import { getRadialShapeExtents, getRadialShapeOuterRadius } from "../layouts/radial-engine.js";
import { evaluateVariationField, variationScaleAt } from "../fields/variation-engine.js";
import { compileControllers, compiledHasChannel, evaluateCompiled } from "../fields/controllers.js";

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
  const isHexHoneycomb = hole.shape === "Hexagon" && patternType === "Staggered 60°";
  const honeyPitchX = isHexHoneycomb ? (effW * Math.sqrt(3)) / 2 + layout.edgeGapX : pitchX;
  const honeyPitchY = isHexHoneycomb ? (honeyPitchX * Math.sqrt(3)) / 2 : pitchY;
  // Triangle always fills via its alternating ▲▽ tiling (except Radial);
  // Diamond interlocks into a rhombus lattice under the staggered mode.
  const isRadial = patternType === "Radial";
  const isTriTiling = hole.shape === "Triangle" && !isRadial;
  const isDiamondLattice = hole.shape === "Diamond" && patternType === "Staggered 60°";
  const uniformGapMode = isHexHoneycomb || isTriTiling || isDiamondLattice;
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

  const perfW = sheet.w - margins.left - margins.right;
  const perfH = sheet.h - margins.top - margins.bottom;
  const hasAnyMargin = margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0;

  const taperActive = taper.enabled && taper.thickness > 0 && taper.angle > 0;
  const taperInset = taperActive ? 2 * taper.thickness * Math.tan((taper.angle * Math.PI) / 180) : 0;

  // Effective pitchY for staggered patterns (auto-derived). In staggered layouts the
  // nearest neighbour is diagonal at (pitchX/2, effPY).
  const sHalfPX = pitchX / 2;
  const sMinGap = Math.min(layout.edgeGapX, layout.edgeGapY);
  const sHoleDim = Math.max(effW, effH);
  const sMinDist = sHoleDim + sMinGap;
  const sMinPY = Math.sqrt(Math.max(effH * effH, sMinDist * sMinDist - sHalfPX * sHalfPX));
  const effPitchX = honeyPitchX;
  const effPitchY = isHexHoneycomb
    ? honeyPitchY
    : patternType === "Staggered 60°"
      ? Math.max((pitchX * Math.sqrt(3)) / 2, sMinPY)
      : patternType === "Staggered 45°"
        ? Math.max(pitchX, sMinPY)
        : pitchY;
  // Spacing readouts for the uniform-ligament modes (hex / triangle / diamond)
  const uniformColPitch = isTriTiling ? (effW * triCellK) / 2 : isDiamondLattice ? effW * diaCellK : effPitchX;
  const uniformRowPitch = isTriTiling ? effH * triCellK : isDiamondLattice ? (effH * diaCellK) / 2 : effPitchY;
  const polyCornerMax =
    hole.shape === "Diamond" || hole.shape === "Triangle"
      ? Math.max(0.1, Math.floor(maxCornerRadius(basePolyVerts(hole.shape, effW, effH)) * 10) / 10)
      : 0;
  const showGapY = patternType === "Straight" || patternType === "Custom Angle";

  return {
    hasCustomSize,
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
    holeShape: hole.shape,
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

// Which channels a compiled field actually changes for THIS document. A shape
// controller over Circles and an angle controller over Circles both compile
// fine and then do nothing, and the difference matters twice over: an angle a
// shape cannot show would still widen the rotated bounding box
// `estimateVisibleHoleArea` samples over, and a channel that changes nothing
// must not push the statistics onto the counted-OAR path, which would move the
// reported figure without moving a hole.
//
// The spacing channel is absent on purpose: it is the one channel that decides
// where holes go, so it belongs to the layouts, and they start reading it in
// Phase 3. Until then a spacing controller round-trips through save, share and
// undo without changing anything.
export function activeFieldChannels(doc, field = NO_FIELD) {
  const shape = doc.hole.shape;
  return {
    size: compiledHasChannel(field, "size"),
    angle: compiledHasChannel(field, "angle") && getShape(shape).rotates,
    shape: shape === MORPH_SHAPE && compiledHasChannel(field, "shape"),
  };
}

export const anyFieldChannel = active => active.size || active.angle || active.shape;

// Apply size variation, the field channels, taper exit sizes and the size-floor
// cull to raw centres. `field` is the output of compileDocumentField.
export function decorateHoles(baseHoles, doc, g, field = NO_FIELD) {
  const { variation, hole, boundary } = doc;
  const { margins } = boundary;
  const { effW, effH, perfW, perfH, taperActive, taperInset } = g;
  const holeRadius = hole.cornerRadius;
  const morphs = hole.shape === MORPH_SHAPE;
  const baseMix = hole.shapeMix ?? 0.5;
  const baseSuperN = morphs ? superNFromMix(baseMix) : undefined;
  const { size: hasSize, angle: hasAngle, shape: hasShape } = activeFieldChannels(doc, field);
  return baseHoles.map((base, index) => {
    const nx = perfW > 0 ? clamp((base.x - margins.left) / perfW, 0, 1) : 0.5;
    const ny = perfH > 0 ? clamp((base.y - margins.top) / perfH, 0, 1) : 0.5;
    // Controllers are placed in sheet millimetres, so they are sampled at the
    // hole's real position — not at the normalised (nx, ny) the variation field
    // uses, which would move every controller when a margin changes.
    const scale = variationScaleAt(nx, ny, variation, index + 1) * (hasSize ? evaluateCompiled(field, "size", base.x, base.y) : 1); // prettier-ignore
    const angle = hasAngle ? (base.angle || 0) + evaluateCompiled(field, "angle", base.x, base.y) * DEG : base.angle;
    const superN = hasShape ? superNFromMix(evaluateCompiled(field, "shape", base.x, base.y, baseMix)) : baseSuperN;
    const w = Math.max(0.01, effW * scale);
    const h = Math.max(0.01, effH * scale);
    const culled = variation.enabled && variation.cullBelow > 0 && Math.min(w, h) < variation.cullBelow;
    const scaledRadius = Math.min(holeRadius * scale, w / 2, h / 2);
    const exitW = taperActive ? Math.max(0, w - taperInset) : w;
    const exitH = taperActive ? Math.max(0, h - taperInset) : h;
    const exitHoleRadius = Math.max(0, Math.min(scaledRadius - taperInset / 2, exitW / 2, exitH / 2));
    return {
      ...base,
      id: base.id || `hole-${index}`,
      culled,
      fieldValue: variation.enabled ? evaluateVariationField(nx, ny, variation, index + 1) : 1,
      scale,
      angle,
      superN,
      w,
      h,
      holeRadius: scaledRadius,
      area: calcHoleArea(hole.shape, w, h, scaledRadius, superN),
      exitW,
      exitH,
      exitHoleRadius,
      exitArea: exitW > 0 && exitH > 0 ? calcHoleArea(hole.shape, exitW, exitH, exitHoleRadius, superN) : 0,
      isClosed: taperActive && (exitW <= 0 || exitH <= 0),
    };
  });
}

export function filterActive(holes, removedSet) {
  return holes.filter((hole, i) => !removedSet.has(i) && !hole.culled);
}

export function computeStats({ doc, g, params, holes, activeHoles, removedSet, overlaps, field = NO_FIELD }) {
  const { hole, layout, sheet, boundary, variation } = doc;
  const shape = hole.shape;
  const baseSuperN = shape === MORPH_SHAPE ? superNFromMix(hole.shapeMix ?? 0.5) : undefined;
  const { effW, effH, isRadial, taperActive, taperInset } = g;
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
  const useCountedOAR =
    variation.enabled || hasFieldControllers || hasRemovedHoles || g.hasAnyMargin || boundary.cornerRadius > 0 || isRadial; // prettier-ignore
  const theoreticalHoleArea = calcHoleArea(shape, effW, effH, hole.cornerRadius, baseSuperN);
  // Triangle tiling / diamond lattice: one hole per tiling cell (the hole
  // expanded by gap/2), so the unit cell is simply that cell's area.
  const uniformCellArea = g.isTriTiling
    ? ((effW * effH) / 2) * g.triCellK * g.triCellK
    : g.isDiamondLattice
      ? ((effW * effH) / 2) * g.diaCellK * g.diaCellK
      : null;
  const theoreticalOAR = uniformCellArea
    ? Math.min((theoreticalHoleArea / uniformCellArea) * 100, 100)
    : calcTheoreticalOAR(layout.type, g.honeyPitchX, g.honeyPitchY, theoreticalHoleArea);
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
  const theoreticalEffOAR = uniformCellArea
    ? Math.min((theoreticalExitArea / uniformCellArea) * 100, 100)
    : calcTheoreticalOAR(layout.type, g.honeyPitchX, g.honeyPitchY, theoreticalExitArea);
  const countedEffOAR = perforatedArea > 0 ? (totalExitHoleArea / perforatedArea) * 100 : 0;
  const effectiveOAR = useCountedOAR ? countedEffOAR : theoreticalEffOAR;
  const oarDelta = taperActive ? effectiveOAR - nominalOAR : 0;
  const displayOAR = taperActive ? effectiveOAR : nominalOAR;

  const nominalNeighborSpacing = isRadial ? Math.max(g.ringSpacing, g.circumSpacing) : Math.max(g.pitchX, g.pitchY);
  const minLigament = calcMinLigament(activeHoles, shape, nominalNeighborSpacing);
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
  const baseHoles = generateHoles(params);
  const field = compileDocumentField(doc.fields, ctx);
  const holes = decorateHoles(baseHoles, doc, g, field);
  const removedSet = new Set(doc.removedHoles);
  const activeHoles = filterActive(holes, removedSet);
  const overlaps = findOverlaps(activeHoles, doc.hole.shape);
  const stats = computeStats({ doc, g, params, holes, activeHoles, removedSet, overlaps, field });
  return { geometry: g, params, baseHoles, holes, activeHoles, removedSet, overlaps, stats, field };
}

// The params generateHoles actually reads — keep in step with its destructuring.
// buildParams also carries the hole corner radius and the taper fields, which
// change how a hole is drawn but never where it sits.
//
// The Phase 2 field channels are out for the same reason: size, angle and shape
// are applied in decorateHoles, after the centres exist, so a controller resizes,
// turns or morphs a hole without moving it and the removed-hole indices stay
// meaningful. `hole.shapeMix` never reaches buildParams at all. The spacing
// channel WILL move holes — Phase 3 is where the layouts start reading it, and
// that is the point at which this list has to grow.
//
// What makes this sound is structural, not empirical: generateHoles is pure in
// `params` (it reads no module state, and generateRadialHoles receives only
// values derived from these), so a list equal to its destructuring cannot miss a
// placement input. pipeline.test.js asserts that equality directly by parsing
// grid.js, and separately sweeps documents × edits; the sweep alone catches only
// 18 of the 23 if they are dropped. Four of the rest — radialEdgeGap,
// circumEdgeGap, ringSpacing, circumSpacing — cannot be isolated by any document
// at all, since each ring spacing is derived from its gap. The fifth, diameter,
// is redundant only while holeW and holeH are non-falsy: grid.js reads
// `holeW || diameter`, so a zero width would make it load-bearing again. That is
// hypothetical today — DOC_LIMITS floors hole.w at 0.5 and every width slider
// starts there — but the list does not depend on the floor staying put.
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
];

// Value signature of everything that decides where holes land. Removed-hole
// indices only stay meaningful while this is unchanged, so edits that alter it
// clear them (see ui/useDocument.js). Link flags, colours and the document name
// are absent by construction: they never reach buildParams.
export function patternSignature(doc) {
  const params = buildParams(doc, deriveGeometry(doc));
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
  return JSON.stringify(PLACEMENT_PARAMS.map(key => [typeof params[key], String(params[key])]));
}
