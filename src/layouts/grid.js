// Hole placement for the grid family (Straight, Staggered 60°/45°, Custom Angle)
// and the three uniform-ligament tilings. Returns hole centres (plus an optional
// per-hole rotation `angle`) in sheet mm; `layouts/index.js` owns the dispatch,
// the boundary clip and the params contract.
//
// Centres may lie slightly outside the perforation bounds (within one hole
// radius); edge clipping is handled visually and by estimateVisibleHoleArea, not
// by dropping holes. `bounds` therefore arrives already padded by that radius.
import { triInradius } from "../geometry/polygon.js";

// Where the rows go, from the top of the region down: the arithmetic sequence
// cy + k·pitch, written the same way it always was so the same holes come out
// to the last bit. Each entry is [y, steps from the centre row]: the step count
// decides the stagger offset's parity.
function rowPositions(cy, yTop, yBottom, pitch) {
  const rows = [];
  if (!(pitch > 0) || !(yBottom >= yTop)) return rows;
  const up = Math.ceil((cy - yTop) / pitch);
  const down = Math.ceil((yBottom - cy) / pitch);
  for (let step = -up; step <= down; step++) {
    const y = cy + step * pitch;
    if (y < yTop || y > yBottom) continue;
    rows.push([y, step < 0 ? -step : step]);
  }
  return rows;
}

// The lattice the grid family actually draws: the pitch along a row, and the
// pitch between rows. Exported because `deriveGeometry` needs the same two
// numbers — for the panel's readouts and for the unit cell the theoretical
// open-area ratio divides by — and it used to work them out again, differently.
// Its copy read the 45° row pitch as `pitchX` where this reads `pitchX/√2`, so
// the panel reported a row pitch the generator had never used and the open-area
// figure divided by a cell 40% too large.
//
// `rowPitch` is not simply the requested pitch: in the staggered modes the
// nearest neighbour is diagonal, so the rows are pushed apart far enough that
// the DIAGONAL clearance is the gap that was asked for. For a hole that is not
// square that lifts the row pitch well above the nominal one, which is exactly
// the case the two copies disagreed on.
export function gridLattice({ holeW, holeH, patternType, pitchX, pitchY, isHexHoneycomb }) {
  const is45 = patternType === "Staggered 45°";
  // Hexagon + 60° staggered → true honeycomb. Pointy-top hexagons share an edge with all
  // six neighbours, so the requested edge gap becomes a uniform ligament between facing
  // parallel edges. Circumradius R = holeW/2 (corner-to-corner), apothem = R·√3/2;
  // touching centres sit 2·apothem apart, so centre spacing = 2·apothem + gap and rows
  // step by spacing·√3/2 to keep the lattice equilateral (every neighbour the same gap).
  const hexSpacing = (holeW * Math.sqrt(3)) / 2 + Math.max(0, pitchX - holeW);
  // For 45° staggered, pitchX is the nearest-neighbor (diagonal) distance t.
  // The actual in-row horizontal pitch = t√2, offset = t/√2, vertical pitch = t/√2.
  // This produces a true 45° angle: arctan((t/√2) / (t/√2)) = 45°.
  // For 60° staggered, pitchX = in-row pitch = nearest-neighbor distance (equilateral).
  const inRowPitchX = isHexHoneycomb ? hexSpacing : is45 ? pitchX * Math.SQRT2 : pitchX;
  if (isHexHoneycomb) {
    // Equilateral hex lattice: row spacing = inRowPitchX·√3/2 gives a uniform gap on every edge.
    return { inRowPitchX, rowPitch: (inRowPitchX * Math.sqrt(3)) / 2 };
  }
  if (patternType !== "Staggered 60°" && !is45) return { inRowPitchX, rowPitch: pitchY };
  // Adjacent rows are offset by inRowPitchX/2 horizontally, so the nearest
  // neighbour is diagonal: use the Euclidean distance for the minimum-gap check
  // rather than the purely vertical one, which over-constrains the spacing.
  const halfPX = inRowPitchX / 2;
  const minDist = Math.max(holeW, holeH) + Math.max(0, Math.min(pitchX - holeW, pitchY - holeH));
  const staggeredMinPY = Math.sqrt(Math.max(holeH * holeH, minDist * minDist - halfPX * halfPX));
  const nominal = patternType === "Staggered 60°" ? (pitchX * Math.sqrt(3)) / 2 : pitchX / Math.SQRT2;
  return { inRowPitchX, rowPitch: Math.max(nominal, staggeredMinPY) };
}

export function generateGridHoles(options) {
  const { holeShape, holeW, holeH, patternType, pitchX, pitchY, bounds, pad, flatTheta, customAngle, spacing, isHexHoneycomb } = options; // prettier-ignore
  const { xMin, xMax, yMin, yMax } = bounds;
  const holes = [];
  if (xMin >= xMax || yMin >= yMax) return holes;
  const xLeft = xMin - pad,
    xRight = xMax + pad,
    yTop = yMin - pad,
    yBottom = yMax + pad;
  const cx = (xMin + xMax) / 2,
    cy = (yMin + yMax) / 2;

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

  // Which shape/mode pairs land on which tiling is `tilingFlags` in index.js —
  // one answer, read here as an argument rather than re-derived. The lattice
  // itself is `gridLattice` above, shared with deriveGeometry for the same reason.
  const { inRowPitchX, rowPitch } = gridLattice({ holeW, holeH, patternType, pitchX, pitchY, isHexHoneycomb });

  let offsetFn = () => 0;
  if (patternType === "Staggered 60°" || patternType === "Staggered 45°") {
    offsetFn = rowIdx => (rowIdx % 2 !== 0 ? inRowPitchX / 2 : 0);
  } else if (patternType === "Custom Angle") {
    // The offset IS a slope: shear = rise × tan(angle), on the nominal lattice.
    // The warp below moves the sheared lattice as a whole, so under a uniform
    // field the angle survives exactly, which layouts.test.js pins.
    const angleRad = (customAngle * Math.PI) / 180;
    offsetFn = rowIdx => (rowIdx % 2 !== 0 ? rowPitch * Math.tan(angleRad) : 0);
  }

  // Under a spacing field the lattice is laid down as it always is and then
  // WARPED: each nominal point moves by what the field says at its position, so
  // the pitch around it becomes pitch × field (compileWarp in
  // fields/controllers.js). A grid cannot pick a pitch per hole — the columns
  // would stop lining up — but it can move as a lattice, and this moves it in
  // both directions and only around the controller. The rule this replaces
  // moved whole rows, and so widened the pitch between them from one edge of the
  // sheet to the other while the pitch along them never changed.
  //
  // Warping moves points in from beyond the region (a crowding field) as well as
  // out of it, so the nominal lattice covers the region grown by what the field
  // can move a point that lands inside it; what lands outside is dropped.
  const grow = spacing ? spacing.expand({ xMin: xLeft, xMax: xRight, yMin: yTop, yMax: yBottom }) : 0;
  const nominal = { xLeft: xLeft - grow, xRight: xRight + grow, yTop: yTop - grow, yBottom: yBottom + grow };
  const colsLeft = Math.ceil((cx - nominal.xLeft) / inRowPitchX) + 1;
  const colsRight = Math.ceil((nominal.xRight - cx) / inRowPitchX) + 1;

  // Center-aligned: start from panel center, expand outward
  for (const [y, rowIdx] of rowPositions(cy, nominal.yTop, nominal.yBottom, rowPitch)) {
    const off = offsetFn(rowIdx);
    for (let ci = -colsLeft; ci <= colsRight; ci++) {
      const x = cx + ci * inRowPitchX + off;
      if (x < nominal.xLeft || x > nominal.xRight) continue;
      if (!spacing) {
        holes.push(flatTheta ? { x, y, angle: flatTheta } : { x, y });
        continue;
      }
      const [ux, uy] = spacing.displace(x, y);
      const wx = x + ux,
        wy = y + uy;
      if (wx < xLeft || wx > xRight || wy < yTop || wy > yBottom) continue;
      holes.push(flatTheta ? { x: wx, y: wy, angle: flatTheta } : { x: wx, y: wy });
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
