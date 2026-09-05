// The layout registry and the one entry point into hole placement.
//
// `generateHoles(params, spacing)` is the whole contract: a flat record of
// primitives describing the sheet, the hole and the mode, plus an optional
// compiled spacing field. Everything below it takes explicit arguments — no mode
// reaches back into `params` — so the list in core/pipeline.js
// (PLACEMENT_PARAMS) can be exactly the destructuring below, and that equality
// is what makes the removed-hole rule sound: an edit that could move a hole must
// change the pattern signature, and a signature over these values plus the
// spacing field covers every input placement has.
//
// The spacing field is the Phase 3 addition, and the reason it is a second
// argument rather than a param: it is a sampler, not a value, and it carries its
// own signature (see `compileSpacing` in core/pipeline.js) so the pair stays
// signable without smuggling a function through a record of primitives.
import { isInsideRoundedRect } from "../geometry/rounded-rect.js";
import { forEachLatticePoint } from "./lattice.js";
import { diamondLatticeBasis, generateGridHoles } from "./grid.js";
import { diamondFlatAngle, generateRadialHoles } from "./radial-engine.js";
import { generateCrosshatchHoles } from "./crosshatch.js";
import { generateScatterHoles } from "./scatter.js";
import { generateSpiralHoles } from "./spiral.js";
import { generateFibonacciHoles } from "./fibonacci.js";

// One entry per mode the Type dropdown offers, in that order.
//
//   family       which panel of parameters the mode is described by
//   spacing      does the mode read the spacing field channel
//   theoretical  can its open-area ratio come from a unit cell, or must the
//                statistics count the holes that are actually there
//
// core/constants.js keeps PATTERN_TYPES as the ordered list the document may
// hold; layouts.test.js asserts the two agree, so neither can gain a mode the
// other has not heard of.
export const LAYOUTS = {
  Straight: { family: "grid", spacing: true, theoretical: true },
  "Staggered 60°": { family: "grid", spacing: true, theoretical: true },
  "Staggered 45°": { family: "grid", spacing: true, theoretical: true },
  Radial: { family: "radial", spacing: false, theoretical: false },
  "Custom Angle": { family: "grid", spacing: true, theoretical: true },
  "Cross-hatch": { family: "crosshatch", spacing: true, theoretical: true },
  Scatter: { family: "free", spacing: true, theoretical: false },
  Spiral: { family: "free", spacing: true, theoretical: false },
  Fibonacci: { family: "free", spacing: true, theoretical: false },
};

export const layoutFamily = patternType => LAYOUTS[patternType]?.family ?? "grid";

// Which of the three uniform-ligament tilings a shape/mode pair lands on. They
// replace the generic grid with an exact tiling whose edge gap is the same
// ligament on every side, and they are the reason `isTriTiling` asks whether the
// mode is in the GRID family rather than merely whether it is not Radial: a
// triangle scattered at random is not tiling anything.
export function tilingFlags(holeShape, patternType) {
  const isGrid = layoutFamily(patternType) === "grid";
  const isHexHoneycomb = holeShape === "Hexagon" && patternType === "Staggered 60°";
  const isTriTiling = holeShape === "Triangle" && isGrid;
  const isDiamondLattice = holeShape === "Diamond" && patternType === "Staggered 60°";
  return {
    isGrid,
    isRadial: patternType === "Radial",
    isHexHoneycomb,
    isTriTiling,
    isDiamondLattice,
    uniformGapMode: isHexHoneycomb || isTriTiling || isDiamondLattice,
  };
}

// True when a spacing controller would actually move a hole in this document.
//
// The three uniform-ligament tilings say no on principle: each is an exact
// interlocking lattice whose whole point is a constant ligament on every edge,
// and a field that stretches it is not varying the density of that pattern, it
// is destroying the pattern.
//
// Radial says no as a scope decision, not an impossibility — Concentric does
// have a constant ring pitch that the grid's accumulate-outward rule would
// transfer to directly. What it does not have is Sunflower and 6k Rosette, which
// place their rings by SOLVING for the gaps they were given, so the three
// sub-layouts would need three different answers under one dropdown. Spiral and
// Fibonacci are where a variable-density radial pattern lives meanwhile.
export const layoutReadsSpacing = (holeShape, patternType) =>
  LAYOUTS[patternType]?.spacing === true && !tilingFlags(holeShape, patternType).uniformGapMode;

export function generateHoles(params, spacing = null) {
  const {
    diameter,
    holeShape,
    holeW,
    holeH,
    patternType,
    pitchX,
    pitchY,
    sheetW,
    sheetH,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    cornerRadius,
    customAngle,
    radialEdgeGap,
    circumEdgeGap,
    ringSpacing,
    circumSpacing,
    radialMode,
    radialLayout,
    centerHole,
    diamondOrient,
    crossAngleA,
    crossAngleB,
    scatterSeed,
    freeSpacingX,
    freeSpacingY,
  } = params;
  const hw = (holeW || diameter) / 2,
    hh = (holeH || diameter) / 2;
  const pad = Math.max(hw, hh);
  const xMin = marginLeft,
    xMax = sheetW - marginRight;
  const yMin = marginTop,
    yMax = sheetH - marginBottom;
  const bounds = { xMin, xMax, yMin, yMax };
  if (xMin >= xMax || yMin >= yMax) return [];

  // Diamond "Flat up" = canonical point-up rhombus rotated onto one of its edges.
  const flatTheta = holeShape === "Diamond" && diamondOrient === "Flat up" ? diamondFlatAngle(hw * 2, hh * 2) : 0;
  const clipToBoundary = pts =>
    cornerRadius > 0 ? pts.filter(p => isInsideRoundedRect(p.x, p.y, xMin, yMin, xMax, yMax, cornerRadius)) : pts;

  if (patternType === "Radial") {
    // The radial engine walks its own rings and applies its own boundary test,
    // corner radius included.
    return generateRadialHoles({
      shape: holeShape,
      w: hw * 2,
      h: hh * 2,
      bounds,
      radialGap: radialEdgeGap,
      circumGap: circumEdgeGap,
      fillMode: radialMode,
      layout: radialLayout,
      ringSpacing,
      circumSpacing,
      center: radialLayout === "Concentric" ? { x: sheetW / 2, y: sheetH / 2 } : undefined,
      centerHole,
      cornerRadius,
      diamondOrient,
    });
  }

  const flags = tilingFlags(holeShape, patternType);
  const field = layoutReadsSpacing(holeShape, patternType) ? spacing : null;
  // Grid-family centres may overhang the perforation bounds by up to one hole
  // radius; the free-form modes fill the bounds exactly, because a scattered
  // hole hanging half off the panel edge reads as a mistake where a grid's does
  // not.
  const padded = { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad };

  if (flags.isDiamondLattice) {
    const { u, v } = diamondLatticeBasis(hw * 2, hh * 2, pitchX, flatTheta);
    const holes = [];
    forEachLatticePoint((xMin + xMax) / 2, (yMin + yMax) / 2, u, v, padded, (x, y) =>
      holes.push({ x, y, angle: flatTheta })
    );
    return clipToBoundary(holes);
  }

  if (patternType === "Cross-hatch") {
    return clipToBoundary(
      generateCrosshatchHoles({
        angleA: crossAngleA,
        angleB: crossAngleB,
        pitchA: pitchX,
        pitchB: pitchY,
        bounds: padded,
        spacing: field,
        holeAngle: flatTheta,
      })
    );
  }
  if (patternType === "Scatter") {
    return clipToBoundary(
      generateScatterHoles({ bounds, minDist: freeSpacingX, seed: scatterSeed, spacing: field, holeAngle: flatTheta })
    );
  }
  if (patternType === "Spiral") {
    return clipToBoundary(
      generateSpiralHoles({
        bounds,
        alongStep: freeSpacingX,
        turnGap: freeSpacingY,
        spacing: field,
        holeAngle: flatTheta,
      })
    );
  }
  if (patternType === "Fibonacci") {
    return clipToBoundary(
      generateFibonacciHoles({ bounds, minSpacing: freeSpacingX, spacing: field, holeAngle: flatTheta })
    );
  }

  // Explicit rather than a fallthrough. A mode added to PATTERN_TYPES and to
  // LAYOUTS but forgotten in the dispatch above would otherwise come out as a
  // plausible straight grid, and every test in layouts.test.js — fills the
  // sheet, stays in bounds, exports, gets denser as the gap closes — would pass
  // on it. An empty pattern is the loud failure.
  if (flags.isGrid) {
    return clipToBoundary(
      generateGridHoles({
        holeShape,
        holeW: hw * 2,
        holeH: hh * 2,
        patternType,
        pitchX,
        pitchY,
        bounds,
        pad,
        flatTheta,
        customAngle,
        spacing: field,
        isHexHoneycomb: flags.isHexHoneycomb,
      })
    );
  }
  return [];
}
