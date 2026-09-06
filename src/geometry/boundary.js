// The perforation boundary: the region of the sheet that receives holes.
//
// `compileBoundary` turns the document's boundary block into a REGION — one
// object every consumer reads, so the generator, the statistics, the canvas and
// the exporters cannot disagree about what is perforated. The outline is a
// margin-inset rectangle with rounded corners, the ellipse inscribed in that
// rectangle, or any closed polygon (drawn, or read out of an SVG file), less a
// list of cutouts; Radial's Circle fill mode inscribes a circle in whichever it
// is. Everything is in sheet millimetres.
//
// Two forms of every outline live side by side, on purpose. Containment and
// area use the exact primitive wherever one exists (a rounded rectangle, an
// ellipse, a circle), because the open-area figure divides by the region's
// area and reads to a tenth of a percent. Clipping, Voronoi cells and the
// distance-to-edge search use `rings` — the same outline flattened at
// BOUNDARY_TOLERANCE — because a clip path and a polygon clipper need
// polygons. The two agree to within that tolerance, which is well under what
// anything downstream resolves.
//
// A polygon boundary is read by the even-odd rule over its rings, so an
// imported logo keeps its counters, and it is intersected with the sheet: the
// material ends where the sheet does, whatever the outline says.
import { DOC_LIMITS } from "../core/constants.js";
import { SpatialHash } from "./spatial-hash.js";
import { isInsideRoundedRect, roundedRectArea } from "./rounded-rect.js";
import { getShape, holeExitOutline, holeOutline, holeVertices, isPointInsideHole } from "./shapes.js";
import { distPointSeg } from "./polygon.js";
import { arcPoints, arcSegmentsFor, circleRing, normalizeRings, ringsArea, ringsBBox, ringsSVGPath, ringsTrace } from "./rings.js"; // prettier-ignore
import { differencePolygons, intersectPolygons } from "./offset.js";

// How closely the region's polygon form follows a curved outline, in mm. Finer
// than the roadmap's 0.05 mm for imported curves: this polygon is what the
// area of a region WITH cutouts is measured on, and a tenth of a percent of
// open area on a 100 mm circle is 0.08 mm of radius.
export const BOUNDARY_TOLERANCE = 0.02;
const f3 = n => n.toFixed(3);
const COORD = DOC_LIMITS["boundary.coord"];

// ─── Point-in-rings, indexed ──────────────────────────────────────────
// The even-odd test over a logo's few hundred edges is asked once per hole
// centre, per scatter dart, per flow-line step. Segments are bucketed by the
// horizontal bands they span, so a query walks the edges at its own height and
// not the whole outline; the answer is the same crossing count either way.
function ringsIndex(rings) {
  const box = ringsBBox(rings);
  const segments = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i],
        [bx, by] = ring[(i + 1) % ring.length];
      if (ay !== by) segments.push([ax, ay, bx, by]);
    }
  }
  const bandCount = Math.max(1, Math.min(256, Math.ceil(segments.length / 8)));
  const height = Math.max(1e-9, box.bottom - box.top);
  const bands = Array.from({ length: bandCount }, () => []);
  const bandOf = y => Math.max(0, Math.min(bandCount - 1, Math.floor(((y - box.top) / height) * bandCount)));
  for (const segment of segments) {
    const lo = bandOf(Math.min(segment[1], segment[3])),
      hi = bandOf(Math.max(segment[1], segment[3]));
    for (let b = lo; b <= hi; b++) bands[b].push(segment);
  }
  return {
    box,
    contains(x, y) {
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
      let inside = false;
      for (const [ax, ay, bx, by] of bands[bandOf(y)]) {
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      }
      return inside;
    },
  };
}

// ─── Outlines as rings ────────────────────────────────────────────────
function roundedRectRing({ xMin, xMax, yMin, yMax }, radius, tolerance) {
  const r = Math.min(Math.max(0, radius), (xMax - xMin) / 2, (yMax - yMin) / 2);
  if (!(r > 0)) {
    return [
      [xMin, yMin],
      [xMax, yMin],
      [xMax, yMax],
      [xMin, yMax],
    ];
  }
  const HALF = Math.PI / 2;
  const n = arcSegmentsFor(r, HALF, tolerance);
  const corners = [
    [xMax - r, yMin + r, -HALF],
    [xMax - r, yMax - r, 0],
    [xMin + r, yMax - r, HALF],
    [xMin + r, yMin + r, Math.PI],
  ];
  const verts = [];
  for (const [cx, cy, from] of corners) {
    for (const [x, y] of arcPoints(cx, cy, r, from, from + HALF, n)) {
      const last = verts[verts.length - 1];
      if (last && Math.hypot(last[0] - x, last[1] - y) < 1e-9) continue;
      verts.push([x, y]);
    }
  }
  const [fx, fy] = verts[0],
    [lx, ly] = verts[verts.length - 1];
  if (verts.length > 2 && Math.hypot(fx - lx, fy - ly) < 1e-9) verts.pop();
  return verts;
}

function ellipseRing(cx, cy, a, b, tolerance) {
  const n = Math.max(8, arcSegmentsFor(Math.max(a, b), Math.PI * 2, tolerance));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n;
    pts.push([cx + Math.cos(t) * a, cy + Math.sin(t) * b]);
  }
  return pts;
}

// A document ring ([[x, y], …]) with anything unusable dropped: fewer than
// three finite vertices, or no area, is not an outline.
const cleanRing = ring =>
  Array.isArray(ring)
    ? ring
        .filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(([x, y]) => [Math.min(COORD[1], Math.max(COORD[0], x)), Math.min(COORD[1], Math.max(COORD[0], y))])
    : [];
export const cleanRings = rings => normalizeRings((Array.isArray(rings) ? rings : []).map(cleanRing));

// ─── Cutouts ──────────────────────────────────────────────────────────
function compileCutout(raw, tolerance) {
  const shape = raw?.shape;
  const x = Number(raw?.x),
    y = Number(raw?.y);
  if (shape === "Polygon") {
    const ring = cleanRing(raw?.points);
    if (ring.length < 3) return null;
    const index = ringsIndex([ring]);
    return { shape, ring, box: index.box, contains: (px, py) => index.contains(px, py) };
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (shape === "Circle") {
    const r = Number(raw.w) / 2;
    if (!(r > 0)) return null;
    return {
      shape,
      ring: circleRing(x, y, r, Math.max(8, arcSegmentsFor(r, Math.PI * 2, tolerance))),
      box: { left: x - r, right: x + r, top: y - r, bottom: y + r },
      contains: (px, py) => Math.hypot(px - x, py - y) <= r,
    };
  }
  if (shape === "Rectangle") {
    const w = Number(raw.w),
      h = Number(raw.h);
    if (!(w > 0) || !(h > 0)) return null;
    const angle = ((Number(raw.rotation) || 0) * Math.PI) / 180;
    const radius = Math.min(Math.max(0, Number(raw.cornerRadius) || 0), w / 2, h / 2);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const local = roundedRectRing({ xMin: -w / 2, xMax: w / 2, yMin: -h / 2, yMax: h / 2 }, radius, tolerance);
    const ring = local.map(([lx, ly]) => [x + lx * c - ly * s, y + lx * s + ly * c]);
    return {
      shape,
      ring,
      box: ringsBBox([ring]),
      contains: (px, py) => {
        const dx = px - x,
          dy = py - y;
        const lx = dx * c + dy * s,
          ly = -dx * s + dy * c;
        return isInsideRoundedRect(lx, ly, -w / 2, -h / 2, w / 2, h / 2, radius);
      },
    };
  }
  return null;
}

// ─── The region ───────────────────────────────────────────────────────
// `sheet` is { w, h }, `boundary` the document block, `circleMode` whether the
// Radial layout's Circle fill is on. Pure and cheap for a rectangle or an
// ellipse; a polygon pays for its index once, and the polygon form of a region
// with cutouts (which needs a boolean difference) is built on first use.
export function compileBoundary(sheet, boundary, circleMode = false) {
  const tolerance = BOUNDARY_TOLERANCE;
  const margins = boundary?.margins || {};
  const sheetW = Number(sheet?.w) || 0,
    sheetH = Number(sheet?.h) || 0;
  const marginFrame = {
    xMin: Number(margins.left) || 0,
    xMax: sheetW - (Number(margins.right) || 0),
    yMin: Number(margins.top) || 0,
    yMax: sheetH - (Number(margins.bottom) || 0),
  };
  const polygonRings = boundary?.shape === "Polygon" ? cleanRings(boundary.rings) : [];
  // A Polygon boundary with nothing drawn yet is the rectangle: the panel's
  // shape switch must not empty the sheet before the first vertex exists.
  const kind = boundary?.shape === "Ellipse" ? "ellipse" : polygonRings.length ? "polygon" : "rect";
  const cutouts = (Array.isArray(boundary?.cutouts) ? boundary.cutouts : [])
    .map(raw => compileCutout(raw, tolerance))
    .filter(Boolean);

  let frame = marginFrame;
  let polygonIndex = null;
  if (kind === "polygon") {
    polygonIndex = ringsIndex(polygonRings);
    const box = polygonIndex.box;
    frame = {
      xMin: Math.max(0, box.left),
      xMax: Math.min(sheetW, box.right),
      yMin: Math.max(0, box.top),
      yMax: Math.min(sheetH, box.bottom),
    };
  }
  const w = Math.max(0, frame.xMax - frame.xMin),
    h = Math.max(0, frame.yMax - frame.yMin);
  const cornerRadius = kind === "rect" ? Math.min(Math.max(0, Number(boundary?.cornerRadius) || 0), w / 2, h / 2) : 0;
  const cx = (frame.xMin + frame.xMax) / 2,
    cy = (frame.yMin + frame.yMax) / 2;
  const circleRadius = Math.min(w, h) / 2;
  const empty = !(w > 0) || !(h > 0);

  const outerContains =
    kind === "rect"
      ? (x, y) => isInsideRoundedRect(x, y, frame.xMin, frame.yMin, frame.xMax, frame.yMax, cornerRadius)
      : kind === "ellipse"
        ? (x, y) => ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2 <= 1
        : (x, y) => x >= 0 && x <= sheetW && y >= 0 && y <= sheetH && polygonIndex.contains(x, y);
  const inCircle = circleMode ? (x, y) => Math.hypot(x - cx, y - cy) <= circleRadius : null;
  const contains = empty
    ? () => false
    : (x, y) => {
        if (!outerContains(x, y)) return false;
        if (inCircle && !inCircle(x, y)) return false;
        for (const cutout of cutouts) if (cutout.contains(x, y)) return false;
        return true;
      };

  // The outline as a plain primitive the canvas and SVG can draw natively —
  // only when nothing has been taken out of it.
  const simple = !cutouts.length && kind !== "polygon";
  const primitive = empty
    ? null
    : circleMode
      ? { type: "circle", cx, cy, r: circleRadius }
      : kind === "ellipse"
        ? { type: "ellipse", cx, cy, rx: w / 2, ry: h / 2 }
        : { type: "rect", x: frame.xMin, y: frame.yMin, w, h, r: cornerRadius };

  // Lazily: the polygon form, the area and the edge index.
  let polygons = null; // [[outer, …holes], …]
  let rings = null; // every ring of the above, flat
  let area = null;
  let edges = null;
  const build = () => {
    if (polygons) return;
    if (empty) {
      polygons = [];
      rings = [];
      return;
    }
    let outer;
    if (kind === "rect") outer = [[roundedRectRing(frame, cornerRadius, tolerance)]];
    else if (kind === "ellipse") outer = [[ellipseRing(cx, cy, w / 2, h / 2, tolerance)]];
    else {
      // Rings by the even-odd rule are one MultiPolygon under the library's
      // rules as well, once nesting has decided which are holes — which
      // `normalizeRings` did. Grouping holes under their outer is the
      // library's job: an exclusive-or of the rings with nothing is the union
      // that sorts them.
      const sheetRing = [[0, 0], [sheetW, 0], [sheetW, sheetH], [0, sheetH]]; // prettier-ignore
      const evenOdd = polygonRings.reduce((acc, ring) => (acc === null ? [[ring]] : xorRing(acc, ring)), null);
      outer = intersectPolygons(evenOdd || [], [[sheetRing]]);
    }
    if (circleMode && kind !== "rect") {
      outer = intersectPolygons(outer, [[circleRing(cx, cy, circleRadius, Math.max(8, arcSegmentsFor(circleRadius, Math.PI * 2, tolerance)))]]); // prettier-ignore
    } else if (circleMode) {
      outer = [[circleRing(cx, cy, circleRadius, Math.max(8, arcSegmentsFor(circleRadius, Math.PI * 2, tolerance)))]];
    }
    polygons = cutouts.length
      ? differencePolygons(
          outer,
          cutouts.map(c => [c.ring])
        )
      : outer;
    rings = polygons.flat();
  };
  const xorRing = (acc, ring) => {
    // (acc ∖ ring) ∪ (ring ∖ acc): the even-odd combination of one more ring.
    const a = differencePolygons(acc, [[ring]]);
    const b = differencePolygons([[ring]], acc);
    return a.concat(b);
  };
  const regionArea = () => {
    if (area !== null) return area;
    if (empty) return (area = 0);
    if (simple && circleMode) return (area = Math.PI * circleRadius * circleRadius);
    if (simple && kind === "rect") return (area = roundedRectArea(w, h, cornerRadius));
    if (simple && kind === "ellipse") return (area = (Math.PI * w * h) / 4);
    build();
    return (area = polygons.reduce((sum, polygon) => sum + ringsArea(polygon), 0));
  };
  // The outline's edges in a grid, for "is anything within d of here".
  const edgeIndex = () => {
    if (edges) return edges;
    build();
    const list = [];
    let longest = 0;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        longest = Math.max(longest, Math.hypot(b[0] - a[0], b[1] - a[1]));
        list.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 });
      }
    }
    const hash = new SpatialHash(Math.max(1, longest));
    list.forEach((segment, index) => hash.insert(segment.x, segment.y, index));
    return (edges = { list, longest, hash });
  };
  // True when some edge of the outline (cutouts included) comes within d of
  // (x, y). Exact for the rounded rectangle; on the flattened outline for the
  // rest, which is the outline the clip is drawn with.
  const nearEdge = (x, y, d) => {
    if (simple && kind === "rect" && !circleMode) {
      return !isInsideRoundedRect(x, y, frame.xMin + d, frame.yMin + d, frame.xMax - d, frame.yMax - d, Math.max(0, cornerRadius - d)) || d > Math.min(w, h) / 2; // prettier-ignore
    }
    const { list, longest, hash } = edgeIndex();
    return hash.forEachNear(x, y, d + longest / 2, index => {
      const s = list[index];
      return distPointSeg(x, y, s.ax, s.ay, s.bx, s.by) <= d;
    });
  };

  return {
    kind,
    frame,
    w,
    h,
    cx,
    cy,
    empty,
    circleMode,
    circleRadius,
    cornerRadius,
    cutouts,
    simple,
    primitive,
    // Is the region the whole sheet, or less than it? Decides the counted
    // open-area path and whether the canvas draws the boundary at all.
    clips:
      kind !== "rect" ||
      cutouts.length > 0 ||
      circleMode ||
      cornerRadius > 0 ||
      frame.xMin > 0 ||
      frame.yMin > 0 ||
      frame.xMax < sheetW ||
      frame.yMax < sheetH,
    // The plain rectangle every layout has always handled from its params:
    // Rectangle (or a Polygon with nothing drawn) and no cutouts. Such a region
    // is not passed to the generator at all, so the default document's pattern
    // is produced by exactly the arithmetic that always produced it.
    isPlainRect: kind === "rect" && cutouts.length === 0,
    // The sharp rectangle with cutouts: the outline is still the one the
    // layouts have always filled loosely — grid centres overhang it by up to a
    // hole radius and the sheet clips the rest visually — so a cutout must
    // only take away what it covers, never tighten the edges of the rectangle
    // as well. Layouts test `inCutout` alone when this is set, `contains`
    // otherwise.
    looseCentres: kind === "rect" && cornerRadius === 0 && !circleMode,
    inCutout: (x, y) => cutouts.some(c => c.contains(x, y)),
    contains,
    // Whether (x, y) is inside with at least `d` of region all round it.
    containsWithClearance: (x, y, d) => contains(x, y) && !(d > 0 && nearEdge(x, y, d)),
    // "inside" when the box is certainly wholly inside the region, "outside"
    // when certainly wholly outside, else "mixed". The certain cases are what
    // lets a hole or a Voronoi cell skip the exact work.
    classifyBox(left, top, right, bottom) {
      if (empty) return "outside";
      const corners = [[left, top], [right, top], [left, bottom], [right, bottom]]; // prettier-ignore
      const insideCount = corners.filter(([x, y]) => contains(x, y)).length;
      if (simple && kind !== "polygon" && !circleMode) {
        // Convex outline, no cutouts: the corners decide.
        if (insideCount === 4) return "inside";
      }
      const { list, longest, hash } = edgeIndex();
      const hx = (left + right) / 2,
        hy = (top + bottom) / 2;
      const reach = Math.hypot(right - left, bottom - top) / 2 + longest / 2;
      const crossed = hash.forEachNear(hx, hy, reach, index => {
        const s = list[index];
        return (
          Math.max(s.ax, s.bx) >= left && Math.min(s.ax, s.bx) <= right && Math.max(s.ay, s.by) >= top && Math.min(s.ay, s.by) <= bottom // prettier-ignore
        );
      });
      if (crossed) return "mixed";
      return insideCount === 4 ? "inside" : insideCount === 0 ? "outside" : "mixed";
    },
    get area() {
      return regionArea();
    },
    get polygons() {
      build();
      return polygons;
    },
    get rings() {
      build();
      return rings;
    },
    // Canvas path of the region, for clipping and for the outline. Even-odd
    // for the polygon form, so a cutout is a hole in the path.
    trace(ctx) {
      if (empty) return;
      if (simple && primitive.type === "rect")
        ctx.roundRect(primitive.x, primitive.y, primitive.w, primitive.h, primitive.r); // prettier-ignore
      else if (simple && primitive.type === "circle") ctx.arc(primitive.cx, primitive.cy, primitive.r, 0, Math.PI * 2);
      else if (simple && primitive.type === "ellipse")
        ctx.ellipse(primitive.cx, primitive.cy, primitive.rx, primitive.ry, 0, 0, Math.PI * 2); // prettier-ignore
      else ringsTrace(ctx, this.rings, 0, 0);
    },
    fillRule: simple ? "nonzero" : "evenodd",
    // Cutout outlines alone, for drawing them as keep-outs.
    traceCutouts(ctx) {
      for (const cutout of cutouts) ringsTrace(ctx, [cutout.ring], 0, 0);
    },
    // The region as one SVG element body (no attributes), for a clip path or
    // for the outline of a trimmed sheet.
    svg(extra = "") {
      if (empty) return `<path d="" ${extra}/>`;
      if (simple && primitive.type === "rect") {
        return `<rect x="${f3(primitive.x)}" y="${f3(primitive.y)}" width="${f3(primitive.w)}" height="${f3(primitive.h)}" rx="${f3(primitive.r)}" ry="${f3(primitive.r)}" ${extra}/>`; // prettier-ignore
      }
      if (simple && primitive.type === "circle") return `<circle cx="${f3(primitive.cx)}" cy="${f3(primitive.cy)}" r="${f3(primitive.r)}" ${extra}/>`; // prettier-ignore
      if (simple && primitive.type === "ellipse") return `<ellipse cx="${f3(primitive.cx)}" cy="${f3(primitive.cy)}" rx="${f3(primitive.rx)}" ry="${f3(primitive.ry)}" ${extra}/>`; // prettier-ignore
      return `<path d="${ringsSVGPath(this.rings, 0, 0)}" fill-rule="evenodd" clip-rule="evenodd" ${extra}/>`;
    },
    svgCutouts: () => cutouts.map(cutout => ringsSVGPath([cutout.ring], 0, 0)),
    // What the placement signature signs: everything about the region that
    // moves a hole and is not already a placement param.
    signature: JSON.stringify([kind, kind === "polygon" ? polygonRings : null, cutouts.map(c => c.ring)]),
  };
}

// Legacy entry point: the region a params record describes, which is always a
// plain rectangle (rounded, or the inscribed circle under Radial's Circle fill).
// Kept for the callers that carry params and not the document — the exporters'
// tests, mostly — and for the generator's own fallback.
export function regionFromParams(params) {
  const {
    sheetW,
    sheetH,
    marginLeft = 0,
    marginRight = 0,
    marginTop = 0,
    marginBottom = 0,
    cornerRadius = 0,
    patternType,
    radialMode,
  } = params;
  return compileBoundary(
    { w: sheetW, h: sheetH },
    { margins: { left: marginLeft, right: marginRight, top: marginTop, bottom: marginBottom }, cornerRadius },
    patternType === "Radial" && radialMode === "Circle"
  );
}

// Area of a hole that actually lies inside the region. Exact when the hole is
// fully inside; otherwise a 12×12 sample of its bounding box.
export function estimateVisibleHoleArea(hole, shape, region, useExit = false) {
  const w = useExit ? hole.exitW : hole.w;
  const h = useExit ? hole.exitH : hole.h;
  const exactArea = useExit ? hole.exitArea : hole.area;
  if (w <= 0 || h <= 0) return 0;
  // A shape that can measure itself against the boundary does. The box sampling
  // below assumes a hole fills a useful share of its own bounding box, and a Flow
  // Lines slot running corner to corner does not: it would land a handful of the
  // 144 samples on the metal and read the open area off the noise between them.
  const own = getShape(shape).visibleArea;
  if (own) {
    return own(hole, useExit ? holeExitOutline(hole) : holeOutline(hole), exactArea, (px, py) => region.contains(px, py)); // prettier-ignore
  }
  const angle = hole.angle || 0;
  const polyVerts = holeVertices(hole, shape, useExit);
  let left, right, top, bottom;
  if (polyVerts?.length) {
    // Polygon shapes are not centred in their w×h box (triangle origin = incenter,
    // Voronoi cell = wherever its site fell), so take the exact bounding box of
    // the vertices themselves.
    left = Infinity;
    right = -Infinity;
    top = Infinity;
    bottom = -Infinity;
    for (const [x, y] of polyVerts) {
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  } else {
    const bw = Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h;
    const bh = Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h;
    left = hole.x - bw / 2;
    right = hole.x + bw / 2;
    top = hole.y - bh / 2;
    bottom = hole.y + bh / 2;
  }
  const boxW = right - left,
    boxH = bottom - top;

  const where = region.classifyBox(left, top, right, bottom);
  if (where === "inside") return exactArea;
  if (where === "outside") return 0;

  const samples = 12;
  let inside = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const px = left + ((sx + 0.5) * boxW) / samples;
      const py = top + ((sy + 0.5) * boxH) / samples;
      if (region.contains(px, py) && isPointInsideHole(px, py, hole, shape, useExit)) inside++;
    }
  }
  return (boxW * boxH * inside) / (samples * samples);
}

// A cutout as the document stores it, with an id that is free in `existing`.
export function createCutout(shape, x, y, size, existing = []) {
  const taken = new Set(existing.map(c => c.id));
  let id;
  for (let i = 1; ; i++) {
    id = `cut-${i}`;
    if (!taken.has(id)) break;
  }
  const cutout = { id, shape, x, y, w: size, h: size, rotation: 0, cornerRadius: 0, points: [] };
  if (shape === "Polygon") {
    const r = size / 2;
    cutout.points = [
      [x, y - r],
      [x + r, y],
      [x, y + r],
      [x - r, y],
    ];
  }
  return cutout;
}
