import test from "node:test";
import assert from "node:assert/strict";
import { HOLE_SHAPES, PRESET_HOLE_SHAPES } from "../core/constants.js";
import { SHAPES, calcHoleArea, calcShapeGap, checkShapeOverlap, holeSVGElement, isPointInsideHole } from "./shapes.js";
import { SHAPE_PRESETS, presetRings } from "./shape-presets.js";
import { ringsArea, ringsBBox, ringsContains } from "./rings.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const hole = (x, y, w, h, extra = {}) => ({ x, y, w, h, holeRadius: 0, ...extra });

test("every shape implements the full registry interface", () => {
  for (const name of HOLE_SHAPES) {
    const def = SHAPES[name];
    assert.ok(def, `${name} missing`);
    for (const fn of ["area", "trace", "svg", "contains", "gap"]) {
      assert.equal(typeof def[fn], "function", `${name}.${fn}`);
    }
  }
});

test("exact areas", () => {
  near(calcHoleArea("Circle", 5, 5, 0), Math.PI * 6.25);
  near(calcHoleArea("Rectangle", 4, 2, 0), 8);
  near(calcHoleArea("Rectangle", 4, 2, 1), 8 - 4 + Math.PI); // fully rounded ends
  near(calcHoleArea("Pill", 10, 4, 0), Math.PI * 4 + 4 * 6);
  near(calcHoleArea("Hexagon", 5, 5, 0), ((3 * Math.sqrt(3)) / 2) * 6.25);
  near(calcHoleArea("Diamond", 6, 4, 0), 12);
  near(calcHoleArea("Triangle", 6, 4, 0), 12);
});

test("gap is signed, symmetric and matches the centre distance for circles", () => {
  const a = hole(0, 0, 5, 5),
    b = hole(8, 0, 5, 5);
  near(calcShapeGap(a, b, "Circle"), 3);
  near(calcShapeGap(b, a, "Circle"), 3);
  assert.equal(checkShapeOverlap(a, hole(4, 0, 5, 5), "Circle"), true);
  assert.equal(checkShapeOverlap(a, b, "Circle"), false);
});

test("honeycomb neighbours at 2·apothem share an edge (gap 0, no overlap)", () => {
  const R = 2.5,
    apothem = (R * Math.sqrt(3)) / 2;
  const a = hole(0, 0, 2 * R, 2 * R),
    b = hole(2 * apothem, 0, 2 * R, 2 * R);
  near(calcShapeGap(a, b, "Hexagon"), 0, 1e-9);
  assert.equal(checkShapeOverlap(a, b, "Hexagon"), false);
});

test("triangle ▲▽ pair inset by gap/2 reports exactly the gap", () => {
  // Two equilateral triangles from the tiling: base 5, height 5·√3/2, gap 1.5.
  const w = 5,
    h = (w * Math.sqrt(3)) / 2,
    gap = 1.5;
  const rIn = (w * h) / 2 / (w / 2 + Math.hypot(w / 2, h));
  const k = (rIn + gap / 2) / rIn;
  const cellW = w * k,
    cellH = h * k,
    rCell = rIn + gap / 2;
  const up = hole(0, cellH - rCell, w, h, { angle: 0 });
  const down = hole(cellW / 2, rCell, w, h, { angle: Math.PI });
  near(calcShapeGap(up, down, "Triangle"), gap, 1e-9);
});

test("hit test honours rotation", () => {
  const rect = hole(0, 0, 10, 2, { angle: Math.PI / 2 });
  assert.equal(isPointInsideHole(0, 4, rect, "Rectangle"), true);
  assert.equal(isPointInsideHole(4, 0, rect, "Rectangle"), false);
});

test("SVG elements carry mm coordinates and a rotation transform when needed", () => {
  assert.equal(
    holeSVGElement(1, 2, "Circle", 5, 5, 'fill="#000"', "", 0, 0),
    '    <circle cx="1.000" cy="2.000" r="2.500" fill="#000" />\n'
  );
  const rect = holeSVGElement(0, 0, "Rectangle", 4, 2, 'fill="#000"', "", Math.PI / 4, 0.5);
  assert.match(
    rect,
    /^ {4}<rect x="-2\.000" y="-1\.000" width="4\.000" height="2\.000" rx="0\.500" ry="0\.500" fill="#000" +transform="rotate\(45\.00 0\.000 0\.000\)"\/>\n$/
  );
});

// ─── Polygon: the one outline a layout imposes rather than a document choosing ───

test("the polygon shape reads its outline off the hole", () => {
  // A 10 mm square cell, its site 1 mm off centre — which is what a Voronoi site
  // is, and the reason none of this can go through the w × h box.
  const square = [
    [-4, -6],
    [6, -6],
    [6, 4],
    [-4, 4],
  ];
  const cell = hole(20, 20, 10, 10, { poly: square });
  near(calcHoleArea("Polygon", 10, 10, 0, square), 100);
  assert.equal(isPointInsideHole(25, 23, cell, "Polygon"), true);
  assert.equal(isPointInsideHole(27, 20, cell, "Polygon"), false, "outside the cell, inside the w × h box");
  // An angle nothing draws must not turn the hit test either.
  assert.equal(isPointInsideHole(25, 23, { ...cell, angle: Math.PI / 2 }, "Polygon"), true);

  // The clearance is the polygon one, measured between the outlines in place.
  const right = hole(33, 20, 10, 10, { poly: square });
  near(calcShapeGap(cell, right, "Polygon"), 3, 1e-9);
  assert.equal(checkShapeOverlap(cell, right, "Polygon"), false);
  assert.equal(checkShapeOverlap(cell, hole(25, 20, 10, 10, { poly: square }), "Polygon"), true);

  // A hole with no outline draws nothing and bridges nothing, rather than
  // throwing or reading as a zero-width overlap with its neighbour.
  const empty = hole(0, 0, 1, 1);
  near(calcHoleArea("Polygon", 1, 1, 0, undefined), 0);
  assert.equal(isPointInsideHole(0, 0, empty, "Polygon"), false);
  assert.equal(calcShapeGap(empty, cell, "Polygon"), Infinity);
  assert.match(holeSVGElement(0, 0, "Polygon", 1, 1, 'fill="#000"', "", 0, 0), /^ {4}<path d="" fill="#000" \/>\n$/);
});

test("the polygon shape is not a shape a document may name", () => {
  // It is imposed by a layout, never chosen: a document that named it would be
  // asking for holes with no outline to draw.
  assert.ok(SHAPES.Polygon, "the registry has it");
  assert.equal(HOLE_SHAPES.includes("Polygon"), false, "the dropdown does not offer it");
});

// ─── Phase 4: the preset shapes, one unit-space entry for all of them ───

test("every preset shape scales its unit outline by the hole's width and height", () => {
  for (const name of PRESET_HOLE_SHAPES) {
    const preset = SHAPE_PRESETS[name];
    const rings = presetRings(name, 0.5, preset.count?.default);
    assert.ok(rings.length >= 1, name);
    const unit = ringsArea(rings);
    assert.ok(unit > 0.05 && unit <= 1, `${name}: unit area ${unit}`);
    // Area is unitArea × w × h exactly, so a 6 × 3 outline covers 18 times it.
    near(calcHoleArea(name, 6, 3, 0, rings), unit * 18, 1e-9);
    // The outline's longest extent is exactly 1, and its origin is on the hole.
    const box = ringsBBox(rings);
    near(Math.max(box.right - box.left, box.bottom - box.top), 1, 1e-9);
    assert.ok(box.left < 0 && box.right > 0 && box.top < 0 && box.bottom > 0, `${name}: the origin is inside the box`);
    // And on the outline itself, at either end of the parameter's range: a
    // hole whose centre is not on the hole misses every test of the centre.
    // The Ring and the Hex Nut have a bore in the middle by design.
    if (name !== "Ring" && name !== "Hex Nut") {
      for (const ratio of [0, 0.5, 1]) {
        assert.equal(ringsContains(presetRings(name, ratio, preset.count?.default), 0, 0), true, `${name} at ${ratio}`);
      }
    }
    // Its SVG element is one path per hole, and its hit test reads the outline
    // rather than the box: the middle of a ring is metal.
    const h = hole(10, 10, 6, 3, { rings });
    assert.match(holeSVGElement(10, 10, name, 6, 3, 'fill="#000"', "", 0, 0, rings), /^ {4}<path d="M [^"]+" fill-rule="evenodd" fill="#000" \/>\n$/); // prettier-ignore
    const middle = isPointInsideHole(10, 10, h, name);
    assert.equal(middle, ringsContains(rings, 0, 0), name);
    assert.equal(isPointInsideHole(10 + 6 * box.right + 0.2, 10, h, name), false, `${name}: outside the width`);
  }
  // The parameters do what they say: a thicker plus covers more, a star with
  // more points covers more, a wider bore leaves less.
  assert.ok(ringsArea(presetRings("Plus", 0.9)) > ringsArea(presetRings("Plus", 0.1)));
  assert.ok(ringsArea(presetRings("Star", 0.9, 5)) > ringsArea(presetRings("Star", 0.1, 5)));
  assert.equal(presetRings("Star", 0.5, 7)[0].length, 14);
  assert.ok(ringsArea(presetRings("Ring", 0.9)) < ringsArea(presetRings("Ring", 0.1)));
  near(ringsArea(presetRings("Ring", 0)), (Math.PI / 4) * (1 - 0.1 * 0.1), 0.01);
  assert.equal(presetRings("Slots", 0.5, 4).length, 4);
  // The same request comes back as the same list, so every hole shares one.
  assert.equal(presetRings("Star", 0.3, 6), presetRings("Star", 0.3, 6));
});

test("preset holes measure their clearance by the outline, turned as they are", () => {
  const rings = presetRings("Plus", 0.5);
  const a = hole(0, 0, 10, 10, { rings });
  // A second plus to the right, arms 2 mm apart: the gap is between the arms,
  // not between the boxes.
  const b = hole(12, 0, 10, 10, { rings });
  near(calcShapeGap(a, b, "Plus"), 2, 1e-9);
  // Turned by 45° it becomes a cross whose arm tips reach the corner: nearer.
  const turned = hole(12, 0, 10, 10, { rings, angle: Math.PI / 4 });
  assert.ok(calcShapeGap(a, turned, "Plus") < 2);
  // Diagonal neighbours whose boxes overlap but whose arms do not are clear.
  const diagonal = hole(8, 8, 10, 10, { rings });
  assert.ok(calcShapeGap(a, diagonal, "Plus") > 0, "the boxes overlap, the arms do not");
  assert.equal(checkShapeOverlap(a, hole(6, 0, 10, 10, { rings }), "Plus"), true);
  // Rings: the bore is metal, so a small hole inside it is clear of the ring.
  const washer = hole(0, 0, 10, 10, { rings: presetRings("Ring", 0.6) });
  const pin = hole(0, 0, 1, 1, { rings: presetRings("Ring", 0.5) });
  assert.ok(calcShapeGap(washer, pin, "Ring") > 1.9, "a pin inside the bore");
});

test("a preset's parameter never moves its points, so the free-form spacing holds still", () => {
  // The star's points sit at the unit radius whatever its inner radius is; the
  // plus's arm tips likewise. That is what keeps a parameter slider from
  // clearing the user's hole removals — see patternSignature.
  const reach = rings => rings.flat().reduce((r, [x, y]) => Math.max(r, Math.hypot(x, y)), 0);
  near(reach(presetRings("Star", 0.1, 5)), reach(presetRings("Star", 0.9, 5)));
  near(reach(presetRings("Ring", 0.1)), reach(presetRings("Ring", 0.9)));
  near(reach(presetRings("Hex Nut", 0.1)), reach(presetRings("Hex Nut", 0.9)));
  // Where the parameter genuinely moves the outline's furthest point — a
  // plus's arm corners swing out as the arm widens — the reach follows it.
  assert.ok(reach(presetRings("Plus", 0.9)) > reach(presetRings("Plus", 0.1)));
});
