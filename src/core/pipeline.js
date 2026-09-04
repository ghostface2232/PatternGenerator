// The pure data pipeline, document → holes → statistics. The React app calls
// these steps through memos; tests call computePattern() directly.
//
//   deriveGeometry(doc)              effective hole extents, pitches, tiling flags
//   buildParams(doc, geometry)       the flat params object for generateHoles / exports
//   decorateHoles(base, doc, g)      applies size variation, taper exit sizes, cull flags
//   filterActive(holes, removed)     drops removed / culled holes
//   computeStats(...)                OAR (theoretical or counted), ligament, overlaps
import { CUSTOM_SIZE_SHAPES, PERF_MODE_HOLE_LIMIT } from "./constants.js";
import { clamp } from "./math.js";
import { basePolyVerts, maxCornerRadius, triInradius } from "../geometry/polygon.js";
import { calcHoleArea } from "../geometry/shapes.js";
import { estimateVisibleHoleArea, perfBoundsArea, perfBoundsFromParams } from "../geometry/boundary.js";
import { calcMinLigament, findOverlaps } from "../geometry/ligament.js";
import { calcTheoreticalOAR } from "../geometry/oar.js";
import { generateHoles } from "../layouts/grid.js";
import { getRadialShapeExtents, getRadialShapeOuterRadius } from "../layouts/radial-engine.js";
import { evaluateVariationField, variationScaleAt } from "../fields/variation-engine.js";

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

// Apply size variation, taper exit sizes and the size-floor cull to raw centres.
export function decorateHoles(baseHoles, doc, g) {
  const { variation, hole, boundary } = doc;
  const { margins } = boundary;
  const { effW, effH, perfW, perfH, taperActive, taperInset } = g;
  const holeRadius = hole.cornerRadius;
  return baseHoles.map((base, index) => {
    const nx = perfW > 0 ? clamp((base.x - margins.left) / perfW, 0, 1) : 0.5;
    const ny = perfH > 0 ? clamp((base.y - margins.top) / perfH, 0, 1) : 0.5;
    const scale = variationScaleAt(nx, ny, variation, index + 1);
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
      w,
      h,
      holeRadius: scaledRadius,
      area: calcHoleArea(hole.shape, w, h, scaledRadius),
      exitW,
      exitH,
      exitHoleRadius,
      exitArea: exitW > 0 && exitH > 0 ? calcHoleArea(hole.shape, exitW, exitH, exitHoleRadius) : 0,
      isClosed: taperActive && (exitW <= 0 || exitH <= 0),
    };
  });
}

export function filterActive(holes, removedSet) {
  return holes.filter((hole, i) => !removedSet.has(i) && !hole.culled);
}

export function computeStats({ doc, g, params, holes, activeHoles, removedSet, overlaps }) {
  const { hole, layout, sheet, boundary, variation } = doc;
  const shape = hole.shape;
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
  const hasRemovedHoles = removedSet.size > 0;
  const useCountedOAR = variation.enabled || hasRemovedHoles || g.hasAnyMargin || boundary.cornerRadius > 0 || isRadial;
  const theoreticalHoleArea = calcHoleArea(shape, effW, effH, hole.cornerRadius);
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
  // 0.5 mm holes at zero gap is 160,801 holes).
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
      ? calcHoleArea(shape, theoreticalExitW, theoreticalExitH, theoreticalExitRadius)
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
export function computePattern(doc) {
  const g = deriveGeometry(doc);
  const params = buildParams(doc, g);
  const baseHoles = generateHoles(params);
  const holes = decorateHoles(baseHoles, doc, g);
  const removedSet = new Set(doc.removedHoles);
  const activeHoles = filterActive(holes, removedSet);
  const overlaps = findOverlaps(activeHoles, doc.hole.shape);
  const stats = computeStats({ doc, g, params, holes, activeHoles, removedSet, overlaps });
  return { geometry: g, params, baseHoles, holes, activeHoles, removedSet, overlaps, stats };
}

// Value signature of everything that shapes the generated hole list. Removed-hole
// indices only stay meaningful while this is unchanged, so edits that alter it
// clear them (see ui/useDocument.js). Link flags and colours are absent by
// construction: they never reach buildParams.
export function patternSignature(doc) {
  return JSON.stringify(buildParams(doc, deriveGeometry(doc)));
}
