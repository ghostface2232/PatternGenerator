// Hole placement for the grid family (Straight, Staggered 60°/45°, Custom Angle)
// and the three uniform-ligament tilings. Returns hole centres (plus an optional
// per-hole rotation `angle`) in sheet mm; `layouts/index.js` owns the dispatch,
// the boundary clip and the params contract.
//
// Centres may lie slightly outside the perforation bounds (within one hole
// radius); edge clipping is handled visually and by estimateVisibleHoleArea, not
// by dropping holes. `bounds` therefore arrives already padded by that radius.
import { triInradius } from "../geometry/polygon.js";
import { strongestAlong } from "./field-sampling.js";

// A backstop on the accumulating walk. Unreachable for any document: the worst
// legal case is a 0.2× field over a 0.354 mm row pitch on a 1000 mm panel, about
// 14 600 rows.
const MAX_ROWS = 100_000;
// Samples per row when the spacing field is read. See `strongestAlong`.
const SPACING_SAMPLES = 32;

// Where the rows go, from the top of the region down. Each entry is
// [y, steps from the centre row, the vertical advance that reached it]: the step
// count decides the stagger offset's parity, and the advance is what a Custom
// Angle row shears by, so both have to survive a variable pitch.
//
// With no spacing field this is the arithmetic sequence the layout has always
// used, written the same way so the same holes come out to the last bit. With
// one, each row's pitch is the base pitch scaled by what the field reads along
// that row, accumulated outward from the middle of the sheet.
//
// The accumulation is anchored — it sums the dimensionless multipliers and
// multiplies by the pitch once — so a field that happens to read 1 over a
// stretch gives back exactly `cy + k·pitch` instead of k roundings of it. Not a
// nicety: a row landing one bit-width past the sheet edge is a whole row of
// holes that disappears.
//
// Rows and rows only. Sampling a per-column pitch as well would vary the density
// in two dimensions, but each row would then read the field at different points
// along its length and the columns would stop lining up — a grid whose columns
// wander is not a grid. Cross-hatch is the mode that varies both directions, and
// it does it by moving whole lines rather than by re-sampling per hole.
function rowPositions(cy, yTop, yBottom, pitch, sampleRow) {
  const rows = [];
  if (!(pitch > 0) || !(yBottom >= yTop)) return rows;
  if (!sampleRow) {
    const up = Math.ceil((cy - yTop) / pitch);
    const down = Math.ceil((yBottom - cy) / pitch);
    for (let step = -up; step <= down; step++) {
      const y = cy + step * pitch;
      if (y < yTop || y > yBottom) continue;
      rows.push([y, step < 0 ? -step : step, pitch]);
    }
    return rows;
  }
  const below = [];
  for (let y = cy, sum = 0, step = 0; y <= yBottom && below.length < MAX_ROWS;) {
    const factor = sampleRow(y);
    if (!(factor > 0)) break;
    sum += factor;
    step++;
    const next = cy + pitch * sum;
    if (next > yBottom) break;
    below.push([next, step, next - y]);
    y = next;
  }
  const above = [];
  for (let y = cy, sum = 0, step = 0; above.length < MAX_ROWS;) {
    const factor = sampleRow(y);
    if (!(factor > 0)) break;
    sum += factor;
    step++;
    const next = cy - pitch * sum;
    if (next < yTop) break;
    above.push([next, step, y - next]);
    y = next;
  }
  above.reverse();
  return above.concat(cy >= yTop && cy <= yBottom ? [[cy, 0, pitch]] : [], below);
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
  // What a row reads from the field: its STRONGEST value along the row, meaning
  // the one furthest from the channel's neutral 1×. For a point controller that
  // is the value at the row's closest approach to it, so a row reads a
  // controller by how far away it is — which is the whole of what a row can
  // say, and it says it the same wherever along the row the controller sits.
  //
  // Reading one fixed point instead — the row's centre, which is what this did
  // first — left the mode blind to everything off the vertical midline: a
  // controller dropped on the left half of the sheet lit up the canvas heat map
  // and moved not one hole. Averaging along the row sees it, but dilutes it by
  // however much of the row it covers, so a controller reaching a fifth of the
  // sheet came out at a fifth of its strength and the Target slider stopped
  // meaning anything.
  const sampleRow = spacing ? y => strongestAlong(spacing, xMin, y, xMax, y, SPACING_SAMPLES) : null;

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

  // The offset takes the row's own advance as well as its parity, because Custom
  // Angle's offset IS a slope: shear = rise × tan(angle). Using the nominal
  // pitch there while the spacing field moved the rise turned a 30° stagger into
  // a 55° one — the one slider in the app that names an angle, no longer naming
  // it. The staggered modes' half-pitch offset is horizontal and unaffected.
  let offsetFn = () => 0;
  if (patternType === "Staggered 60°" || patternType === "Staggered 45°") {
    offsetFn = rowIdx => (rowIdx % 2 !== 0 ? inRowPitchX / 2 : 0);
  } else if (patternType === "Custom Angle") {
    const angleRad = (customAngle * Math.PI) / 180;
    offsetFn = (rowIdx, advance) => (rowIdx % 2 !== 0 ? advance * Math.tan(angleRad) : 0);
  }

  // Center-aligned: start from panel center, expand outward
  for (const [y, rowIdx, advance] of rowPositions(cy, yTop, yBottom, rowPitch, sampleRow)) {
    const off = offsetFn(rowIdx, advance);
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
