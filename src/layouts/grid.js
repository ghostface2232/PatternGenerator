// Hole placement for the grid family (Straight, Staggered 60°/45°, Custom Angle)
// and the three uniform-ligament tilings. Returns hole centres (plus an optional
// per-hole rotation `angle`) in sheet mm; `layouts/index.js` owns the dispatch,
// the boundary clip and the params contract.
//
// Centres may lie slightly outside the perforation bounds (within one hole
// radius); edge clipping is handled visually and by estimateVisibleHoleArea, not
// by dropping holes. `bounds` therefore arrives already padded by that radius.
import { triInradius } from "../geometry/polygon.js";

// A backstop for the spacing field at its densest: 0.2× of a 0.5 mm pitch over a
// 1000 mm panel is ten thousand rows, and the cap is well clear of that.
const MAX_ROWS = 20000;

// Where the rows go, from the top of the region down, each paired with its
// distance in steps from the centre row — which is what decides the stagger
// offset's parity, and so has to survive a variable pitch.
//
// With no spacing field this is the arithmetic sequence the layout has always
// used, written the same way so the same holes come out to the last bit. With
// one, each row's pitch is the base pitch scaled by the field sampled at that
// row's own centre, accumulated outward from the middle of the sheet.
//
// Rows and rows only. Sampling a per-column pitch as well would vary the density
// in two dimensions, but each row would then sample the field at different
// points along its length and the columns would stop lining up — a grid whose
// columns wander is not a grid. Cross-hatch is the mode that varies both
// directions, and it does it by moving whole lines rather than by re-sampling
// per hole.
function rowPositions(cy, yTop, yBottom, pitch, sampleRow) {
  const rows = [];
  if (!(pitch > 0) || !(yBottom >= yTop)) return rows;
  if (!sampleRow) {
    const up = Math.ceil((cy - yTop) / pitch);
    const down = Math.ceil((yBottom - cy) / pitch);
    for (let step = -up; step <= down; step++) {
      const y = cy + step * pitch;
      if (y < yTop || y > yBottom) continue;
      rows.push([y, step < 0 ? -step : step]);
    }
    return rows;
  }
  const below = [];
  for (let y = cy, step = 0; y <= yBottom && rows.length + below.length < MAX_ROWS;) {
    const advance = pitch * sampleRow(y);
    if (!(advance > 0)) break;
    y += advance;
    step++;
    if (y > yBottom) break;
    below.push([y, step]);
  }
  const above = [];
  for (let y = cy, step = 0; above.length + below.length < MAX_ROWS;) {
    const advance = pitch * sampleRow(y);
    if (!(advance > 0)) break;
    y -= advance;
    step++;
    if (y < yTop) break;
    above.push([y, step]);
  }
  above.reverse();
  return above.concat(cy >= yTop && cy <= yBottom ? [[cy, 0]] : [], below);
}

export function generateGridHoles(options) {
  const { holeShape, holeW, holeH, patternType, pitchX, pitchY, bounds, pad, flatTheta, customAngle, spacing } =
    options;
  const { xMin, xMax, yMin, yMax } = bounds;
  const holes = [];
  if (xMin >= xMax || yMin >= yMax) return holes;
  const xLeft = xMin - pad,
    xRight = xMax + pad,
    yTop = yMin - pad,
    yBottom = yMax + pad;
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;
  // Each row reads the field at its own centre, which is the one point on a row
  // that does not depend on where along it you look.
  const sampleRow = spacing ? y => spacing.sample(cx, y) : null;

  // ─── Triangle: dedicated alternating ▲▽ row tiling ───────────────────
  // Triangles of base W × height H tile the plane exactly when up/down copies
  // alternate every half-base within a row and the alternation phase flips per
  // row. The edge gap becomes a uniform ligament by keeping that perfect
  // lattice for the EXPANDED triangle (offset outward by gap/2) and drawing
  // each actual triangle inset at the shared incenter — every facing pair of
  // edges then sits exactly `gap` apart, so gap 0 is a seamless fit.
  if (holeShape === "Triangle") {
    const w = holeW,
      h = holeH;
    const rIn = triInradius(w, h);
    const gap = Math.max(0, pitchX - w);
    const k = (rIn + gap / 2) / rIn;
    const cellW = w * k,
      cellH = h * k,
      rCell = rIn + gap / 2;
    const rowsUp = Math.ceil((cy - yTop) / cellH) + 1;
    const rowsDown = Math.ceil((yBottom - cy) / cellH) + 1;
    const cols = Math.ceil((Math.max(cx - xMin, xMax - cx) + pad) / (cellW / 2)) + 1;
    for (let j = -rowsUp; j <= rowsDown; j++) {
      const rowTop = cy - cellH / 2 + j * cellH;
      if (rowTop > yBottom || rowTop + cellH < yTop) continue;
      for (let i = -cols; i <= cols; i++) {
        const up = (((i + j) % 2) + 2) % 2 === 0;
        const x = cx + i * (cellW / 2);
        const y = up ? rowTop + cellH - rCell : rowTop + rCell;
        if (x < xLeft || x > xRight) continue;
        holes.push({ x, y, angle: up ? 0 : Math.PI });
      }
    }
    return holes;
  }

  // For 45° staggered, pitchX is the nearest-neighbor (diagonal) distance t.
  // The actual in-row horizontal pitch = t√2, offset = t/√2, vertical pitch = t/√2.
  // This produces a true 45° angle: arctan((t/√2) / (t/√2)) = 45°.
  // For 60° staggered, pitchX = in-row pitch = nearest-neighbor distance (equilateral).
  const is45 = patternType === "Staggered 45°";
  const holeHeight = holeH;
  const holeWidth = holeW;

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
  for (const [y, rowIdx] of rowPositions(cy, yTop, yBottom, effPY, sampleRow)) {
    const off = offsetFn(rowIdx);
    const colsLeft = Math.ceil((cx - xLeft) / inRowPitchX) + 1;
    const colsRight = Math.ceil((xRight - cx) / inRowPitchX) + 1;
    for (let ci = -colsLeft; ci <= colsRight; ci++) {
      const x = cx + ci * inRowPitchX + off;
      if (x >= xLeft && x <= xRight) {
        holes.push(flatTheta ? { x, y, angle: flatTheta } : { x, y });
      }
    }
  }

  return holes;
}

// ─── Diamond + Staggered 60°: interlocking rhombus lattice ─────────────
// Point-up rhombi tile edge-to-edge on the lattice u=(W,0), v=(W/2, H/2).
// As with the triangle tiling, the gap is a uniform ligament: the lattice is
// that of the expanded rhombus (offset outward by gap/2). "Flat up" rotates
// the lattice together with the shapes so the tiling stays exact.
export function diamondLatticeBasis(holeW, holeH, pitchX, flatTheta) {
  const rho = (holeW * holeH) / (2 * Math.hypot(holeW, holeH));
  const gap = Math.max(0, pitchX - holeW);
  const k = (rho + gap / 2) / rho;
  const cellW = holeW * k,
    cellH = holeH * k;
  const ct = Math.cos(flatTheta),
    st = Math.sin(flatTheta);
  return {
    u: [cellW * ct, cellW * st],
    v: [(cellW / 2) * ct - (cellH / 2) * st, (cellW / 2) * st + (cellH / 2) * ct],
  };
}
