// Hole placement for the grid family (Straight, Staggered 60°/45°, Custom Angle),
// the three uniform-ligament tilings, and dispatch to the radial engine.
// Returns hole centres (plus an optional per-hole rotation `angle`) in sheet mm.
// Centres may lie slightly outside the perforation bounds (within one hole radius);
// edge clipping is handled visually and by estimateVisibleHoleArea, not by dropping holes.
import { isInsideRoundedRect } from "../geometry/rounded-rect.js";
import { triInradius } from "../geometry/polygon.js";
import { diamondFlatAngle, generateRadialHoles } from "./radial-engine.js";

export function generateHoles(params) {
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
  } = params;
  const hw = (holeW || diameter) / 2,
    hh = (holeH || diameter) / 2;
  const r = Math.max(hw, hh);
  const holes = [];
  const xMin = marginLeft,
    xMax = sheetW - marginRight;
  const yMin = marginTop,
    yMax = sheetH - marginBottom;
  if (xMin >= xMax || yMin >= yMax) return holes;

  // Diamond "Flat up" = canonical point-up rhombus rotated onto one of its edges.
  const flatTheta = holeShape === "Diamond" && diamondOrient === "Flat up" ? diamondFlatAngle(hw * 2, hh * 2) : 0;
  const clipToBoundary = pts =>
    cornerRadius > 0 ? pts.filter(p => isInsideRoundedRect(p.x, p.y, xMin, yMin, xMax, yMax, cornerRadius)) : pts;

  if (patternType === "Radial") {
    return generateRadialHoles({
      shape: holeShape,
      w: hw * 2,
      h: hh * 2,
      bounds: { xMin, xMax, yMin, yMax },
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

  // ─── Triangle: dedicated alternating ▲▽ row tiling ───────────────────
  // Triangles of base W × height H tile the plane exactly when up/down copies
  // alternate every half-base within a row and the alternation phase flips per
  // row. The edge gap becomes a uniform ligament by keeping that perfect
  // lattice for the EXPANDED triangle (offset outward by gap/2) and drawing
  // each actual triangle inset at the shared incenter — every facing pair of
  // edges then sits exactly `gap` apart, so gap 0 is a seamless fit.
  if (holeShape === "Triangle") {
    const w = hw * 2,
      h = hh * 2;
    const rIn = triInradius(w, h);
    const gap = Math.max(0, pitchX - w);
    const k = (rIn + gap / 2) / rIn;
    const cellW = w * k,
      cellH = h * k,
      rCell = rIn + gap / 2;
    const cx = (xMin + xMax) / 2,
      cy = (yMin + yMax) / 2;
    const rowsUp = Math.ceil((cy - yMin + r) / cellH) + 1;
    const rowsDown = Math.ceil((yMax + r - cy) / cellH) + 1;
    const cols = Math.ceil((Math.max(cx - xMin, xMax - cx) + r) / (cellW / 2)) + 1;
    for (let j = -rowsUp; j <= rowsDown; j++) {
      const rowTop = cy - cellH / 2 + j * cellH;
      if (rowTop > yMax + r || rowTop + cellH < yMin - r) continue;
      for (let i = -cols; i <= cols; i++) {
        const up = (((i + j) % 2) + 2) % 2 === 0;
        const x = cx + i * (cellW / 2);
        const y = up ? rowTop + cellH - rCell : rowTop + rCell;
        if (x < xMin - r || x > xMax + r) continue;
        holes.push({ x, y, angle: up ? 0 : Math.PI });
      }
    }
    return clipToBoundary(holes);
  }

  // ─── Diamond + Staggered 60°: interlocking rhombus lattice ───────────
  // Point-up rhombi tile edge-to-edge on the lattice u=(W,0), v=(W/2, H/2).
  // As with the triangle tiling, the gap is a uniform ligament: the lattice is
  // that of the expanded rhombus (offset outward by gap/2). "Flat up" rotates
  // the lattice together with the shapes so the tiling stays exact.
  if (holeShape === "Diamond" && patternType === "Staggered 60°") {
    const w = hw * 2,
      h = hh * 2;
    const rho = (w * h) / (2 * Math.hypot(w, h));
    const gap = Math.max(0, pitchX - w);
    const k = (rho + gap / 2) / rho;
    const cellW = w * k,
      cellH = h * k;
    const ct = Math.cos(flatTheta),
      st = Math.sin(flatTheta);
    const u = [cellW * ct, cellW * st];
    const v = [(cellW / 2) * ct - (cellH / 2) * st, (cellW / 2) * st + (cellH / 2) * ct];
    const cx = (xMin + xMax) / 2,
      cy = (yMin + yMax) / 2;
    const det = u[0] * v[1] - u[1] * v[0];
    let iMin = Infinity,
      iMax = -Infinity,
      jMin = Infinity,
      jMax = -Infinity;
    for (const [bx, by] of [
      [xMin - r, yMin - r],
      [xMax + r, yMin - r],
      [xMin - r, yMax + r],
      [xMax + r, yMax + r],
    ]) {
      const dx = bx - cx,
        dy = by - cy;
      const fi = (dx * v[1] - dy * v[0]) / det;
      const fj = (u[0] * dy - u[1] * dx) / det;
      iMin = Math.min(iMin, fi);
      iMax = Math.max(iMax, fi);
      jMin = Math.min(jMin, fj);
      jMax = Math.max(jMax, fj);
    }
    for (let j = Math.floor(jMin) - 1; j <= Math.ceil(jMax) + 1; j++) {
      for (let i = Math.floor(iMin) - 1; i <= Math.ceil(iMax) + 1; i++) {
        const x = cx + i * u[0] + j * v[0];
        const y = cy + i * u[1] + j * v[1];
        if (x < xMin - r || x > xMax + r || y < yMin - r || y > yMax + r) continue;
        holes.push({ x, y, angle: flatTheta });
      }
    }
    return clipToBoundary(holes);
  }

  // For 45° staggered, pitchX is the nearest-neighbor (diagonal) distance t.
  // The actual in-row horizontal pitch = t√2, offset = t/√2, vertical pitch = t/√2.
  // This produces a true 45° angle: arctan((t/√2) / (t/√2)) = 45°.
  // For 60° staggered, pitchX = in-row pitch = nearest-neighbor distance (equilateral).
  const is45 = patternType === "Staggered 45°";
  const holeHeight = holeH || diameter;
  const holeWidth = holeW || diameter;

  // Hexagon + 60° staggered → true honeycomb. Pointy-top hexagons share an edge with all
  // six neighbours, so the requested edge gap becomes a uniform ligament between facing
  // parallel edges. Circumradius R = holeWidth/2 (corner-to-corner), apothem = R·√3/2;
  // touching centres sit 2·apothem apart, so centre spacing = 2·apothem + gap and rows
  // step by spacing·√3/2 to keep the lattice equilateral (every neighbour the same gap).
  const isHexHoneycomb = holeShape === "Hexagon" && patternType === "Staggered 60°";
  const hexGap = Math.max(0, pitchX - holeWidth);
  const hexSpacing = (holeWidth * Math.sqrt(3)) / 2 + hexGap;

  let inRowPitchX = is45 ? pitchX * Math.SQRT2 : pitchX;
  if (isHexHoneycomb) inRowPitchX = hexSpacing;

  let offsetFn = () => 0;
  if (patternType === "Staggered 60°" || is45) {
    offsetFn = rowIdx => (rowIdx % 2 !== 0 ? inRowPitchX / 2 : 0);
  } else if (patternType === "Custom Angle") {
    const angleRad = (customAngle * Math.PI) / 180;
    offsetFn = rowIdx => (rowIdx % 2 !== 0 ? pitchY * Math.tan(angleRad) : 0);
  }

  const minEdgeGap = Math.min(pitchX - holeWidth, pitchY - holeHeight);
  const safeMinGap = Math.max(0, minEdgeGap);

  let effPY = pitchY;
  if (isHexHoneycomb) {
    // Equilateral hex lattice: row spacing = inRowPitchX·√3/2 gives a uniform gap on every edge.
    effPY = (inRowPitchX * Math.sqrt(3)) / 2;
  } else if (patternType === "Staggered 60°" || is45) {
    // In staggered layouts, adjacent rows are offset by inRowPitchX/2 horizontally.
    // The nearest neighbor is diagonal, so use Euclidean distance for min gap check
    // instead of purely vertical distance which over-constrains the spacing.
    const halfPX = inRowPitchX / 2;
    const holeDim = Math.max(holeWidth, holeHeight);
    const minDist = holeDim + safeMinGap;
    const staggeredMinPY = Math.sqrt(Math.max(holeHeight * holeHeight, minDist * minDist - halfPX * halfPX));
    if (patternType === "Staggered 60°") {
      effPY = Math.max((pitchX * Math.sqrt(3)) / 2, staggeredMinPY);
    } else {
      // 45°: vertical pitch = t/√2 where t = pitchX (nearest-neighbor distance)
      effPY = Math.max(pitchX / Math.SQRT2, staggeredMinPY);
    }
  }

  // Center-aligned: start from panel center, expand outward
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  const rowsUp = Math.ceil((cy - yMin + r) / effPY);
  const rowsDown = Math.ceil((yMax + r - cy) / effPY);

  for (let ri = -rowsUp; ri <= rowsDown; ri++) {
    const y = cy + ri * effPY;
    if (y < yMin - r || y > yMax + r) continue;
    const rowIdx = Math.abs(ri);
    const off = offsetFn(rowIdx);
    const colsLeft = Math.ceil((cx - xMin + r) / inRowPitchX) + 1;
    const colsRight = Math.ceil((xMax + r - cx) / inRowPitchX) + 1;
    for (let ci = -colsLeft; ci <= colsRight; ci++) {
      const x = cx + ci * inRowPitchX + off;
      if (x >= xMin - r && x <= xMax + r) {
        holes.push(flatTheta ? { x, y, angle: flatTheta } : { x, y });
      }
    }
  }

  return clipToBoundary(holes);
}
