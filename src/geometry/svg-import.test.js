import test from "node:test";
import assert from "node:assert/strict";
import { svgToRings, svgToUnitShape } from "./svg-import.js";
import { ringsArea, ringsContains, ringsGap } from "./rings.js";

const square = (x, y, size) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];
// Canvas uses winding, while SVG export and hit testing use parity.
const winding = (rings, x, y) =>
  rings.reduce((sum, ring) => {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i],
        [bx, by] = ring[(i + 1) % ring.length];
      const cross = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
      if (ay <= y && by > y && cross > 0) sum++;
      if (ay > y && by <= y && cross < 0) sum--;
    }
    return sum;
  }, 0);

test("overlapping imported elements resolve to the same solid for every consumer", () => {
  const file = '<svg><rect width="10" height="10"/><rect x="5" width="10" height="10"/></svg>';
  const rings = svgToRings(file);
  assert.equal(ringsArea(rings), 100);
  assert.equal(ringsContains(rings, 7, 5), false);
  assert.ok(ringsGap(rings, [square(6, 4, 2)]) > 0);
  assert.ok(ringsGap(rings, [square(1, 4, 2)]) < 0);
  const unit = svgToUnitShape(file);
  assert.ok(Math.abs(ringsArea(unit.rings) * 15 * 10 - 100) < 1e-9);
  for (let x = 0.25; x < 15; x += 0.5) {
    const expected = x < 5 || x > 10;
    assert.equal(ringsContains(rings, x, 5), expected);
    assert.equal(winding(rings, x, 5) !== 0, expected);
    assert.equal(ringsContains(unit.rings, x / 15 - 0.5, 0), expected);
  }
});

test("import normalization retains nested bores and cancels duplicate loops", () => {
  const nested =
    '<svg><rect width="10" height="10"/><rect x="2" y="2" width="6" height="6"/><rect x="4" y="4" width="2" height="2"/></svg>';
  const rings = svgToRings(nested);
  assert.equal(ringsArea(rings), 68);
  for (const [x, solid] of [
    [1, true],
    [3, false],
    [5, true],
  ]) {
    assert.equal(ringsContains(rings, x, 5), solid);
    assert.equal(winding(rings, x, 5) !== 0, solid);
  }
  assert.deepEqual(svgToRings('<svg><rect width="10" height="10"/><rect width="10" height="10"/></svg>'), []);
});
