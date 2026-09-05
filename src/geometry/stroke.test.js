import test from "node:test";
import assert from "node:assert/strict";
import { signedPolyArea } from "./polygon.js";
import { calcShapeGap, calcHoleArea, isPointInsideHole } from "./shapes.js";
import { strokeBBox, strokeMaxWidth, strokeOutline, strokeVisibleArea } from "./stroke.js";

const near = (a, b, eps) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
// A 20 mm slot 4 mm wide, lying along x, its origin at its own middle.
const straight = (halfW = 2) => ({
  pts: [
    [-10, 0],
    [0, 0],
    [10, 0],
  ],
  halfW: [halfW, halfW, halfW],
});
const slot = (x, y, stroke) => ({ x, y, stroke, w: strokeBBox(stroke).right - strokeBBox(stroke).left, h: 2 * halfOf(stroke) }); // prettier-ignore
const halfOf = stroke => strokeMaxWidth(stroke) / 2;

test("a stroke is a swept disc: length by width, plus a round cap at each end", () => {
  const s = straight(2);
  // 20 mm of centreline at 4 mm wide, plus one full disc of radius 2 shared
  // between the two half-round ends. The caps are chords, so they fall a little
  // short of the circle they stand for — a sixth of a percent of the total here.
  const exact = 20 * 4 + Math.PI * 4;
  near(calcHoleArea("Stroke", 0, 0, 0, s), exact, exact * 0.01);
  assert.ok(calcHoleArea("Stroke", 0, 0, 0, s) < exact, "chords cannot exceed the arc they cut");
  // Wound like every other outline here, so the polygon helpers read it the
  // same way round.
  assert.ok(signedPolyArea(strokeOutline(s)) > 0);
  assert.deepEqual(strokeBBox(s), { left: -12, right: 12, top: -2, bottom: 2 });
  assert.equal(strokeMaxWidth(s), 4);
  assert.equal(calcHoleArea("Stroke", 0, 0, 0, null), 0, "no centreline, no hole");
});

test("a stroke that tapers is measured where it actually is", () => {
  // Four millimetres wide at one end, one at the other: the trapezoid between
  // them, plus the two half-caps.
  const tapered = { pts: straight().pts, halfW: [2, 1.25, 0.5] };
  const exact = 10 * (2 + 1.25) + 10 * (1.25 + 0.5) + (Math.PI * (4 + 0.25)) / 2;
  near(calcHoleArea("Stroke", 0, 0, 0, tapered), exact, exact * 0.02);

  const hole = slot(50, 50, tapered);
  // The hit test reads the width where the point projects, not the widest.
  assert.equal(isPointInsideHole(40, 51.5, hole, "Stroke"), true);
  assert.equal(isPointInsideHole(60, 51.5, hole, "Stroke"), false, "the narrow end is narrow");
  assert.equal(isPointInsideHole(60, 50.4, hole, "Stroke"), true);
  // And a slot is not a box: the corner of its bounding box is not in it.
  assert.equal(isPointInsideHole(38.5, 48.5, hole, "Stroke"), false);
});

test("two slots are as close as their closest pair of segments", () => {
  const a = slot(0, 0, straight(2));
  const b = slot(0, 9, straight(2));
  // Nine millimetres apart, two millimetres of half-width each: five of metal.
  near(calcShapeGap(a, b, "Stroke"), 5, 1e-9);
  // End to end, the round caps decide it: 30 mm between the origins, 20 mm of
  // centreline between the facing ends, four of half-width.
  near(calcShapeGap(a, slot(30, 0, straight(2)), "Stroke"), 30 - 20 - 4, 1e-9);
  // Crossing slots overlap, however thin.
  assert.ok(calcShapeGap(a, slot(0, 0, { pts: [[0, -10], [0, 10]], halfW: [1, 1] }), "Stroke") < 0); // prettier-ignore
});

test("a slot measures its own visible area rather than sampling a box round it", () => {
  // Half of a 20 mm slot inside the boundary. Sampling its bounding box would
  // put a handful of 144 samples on a shape 4 mm thick and 24 mm wide; walking
  // the centreline lands every one of them on the slot.
  const s = straight(2);
  const hole = slot(0, 0, s);
  const inside = x => x <= 0;
  const exact = calcHoleArea("Stroke", 0, 0, 0, s);
  near(
    strokeVisibleArea(hole, s, exact, () => true),
    exact,
    1e-9
  );
  near(
    strokeVisibleArea(hole, s, exact, (x, y) => inside(x, y)),
    exact / 2,
    exact * 0.02
  );
  assert.equal(
    strokeVisibleArea(hole, s, exact, () => false),
    0
  );
});
