import test from "node:test";
import assert from "node:assert/strict";
import { HOLE_SHAPES } from "../core/constants.js";
import {
  SHAPES, calcHoleArea, calcShapeGap, checkShapeOverlap, holeSVGElement, isPointInsideHole,
} from "./shapes.js";

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
  near(calcHoleArea("Rectangle", 4, 2, 1), 8 - 4 + Math.PI);          // fully rounded ends
  near(calcHoleArea("Pill", 10, 4, 0), Math.PI * 4 + 4 * 6);
  near(calcHoleArea("Hexagon", 5, 5, 0), (3 * Math.sqrt(3) / 2) * 6.25);
  near(calcHoleArea("Diamond", 6, 4, 0), 12);
  near(calcHoleArea("Triangle", 6, 4, 0), 12);
});

test("gap is signed, symmetric and matches the centre distance for circles", () => {
  const a = hole(0, 0, 5, 5), b = hole(8, 0, 5, 5);
  near(calcShapeGap(a, b, "Circle"), 3);
  near(calcShapeGap(b, a, "Circle"), 3);
  assert.equal(checkShapeOverlap(a, hole(4, 0, 5, 5), "Circle"), true);
  assert.equal(checkShapeOverlap(a, b, "Circle"), false);
});

test("honeycomb neighbours at 2·apothem share an edge (gap 0, no overlap)", () => {
  const R = 2.5, apothem = R * Math.sqrt(3) / 2;
  const a = hole(0, 0, 2 * R, 2 * R), b = hole(2 * apothem, 0, 2 * R, 2 * R);
  near(calcShapeGap(a, b, "Hexagon"), 0, 1e-9);
  assert.equal(checkShapeOverlap(a, b, "Hexagon"), false);
});

test("triangle ▲▽ pair inset by gap/2 reports exactly the gap", () => {
  // Two equilateral triangles from the tiling: base 5, height 5·√3/2, gap 1.5.
  const w = 5, h = w * Math.sqrt(3) / 2, gap = 1.5;
  const rIn = (w * h / 2) / (w / 2 + Math.hypot(w / 2, h));
  const k = (rIn + gap / 2) / rIn;
  const cellW = w * k, cellH = h * k, rCell = rIn + gap / 2;
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
  assert.equal(holeSVGElement(1, 2, "Circle", 5, 5, 'fill="#000"', "", 0, 0), '    <circle cx="1.000" cy="2.000" r="2.500" fill="#000" />\n');
  const rect = holeSVGElement(0, 0, "Rectangle", 4, 2, 'fill="#000"', "", Math.PI / 4, 0.5);
  assert.match(rect, /^ {4}<rect x="-2\.000" y="-1\.000" width="4\.000" height="2\.000" rx="0\.500" ry="0\.500" fill="#000" +transform="rotate\(45\.00 0\.000 0\.000\)"\/>\n$/);
});
