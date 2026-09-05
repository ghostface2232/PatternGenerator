import test from "node:test";
import assert from "node:assert/strict";
import {
  arcSegmentsFor,
  circleRing,
  normalizeRings,
  ringsArea,
  ringsBBox,
  ringsContains,
  ringsGap,
  ringsSVGPath,
  simplifyPolyline,
  simplifyRing,
  transformRings,
  unitRings,
} from "./rings.js";
import { isConvexPoly, isInsidePoly, isInsideRoundedPoly, polyGap, roundedPolyArea, signedPolyArea } from "./polygon.js"; // prettier-ignore

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const square = (x, y, size) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];
// An L: a 10 mm square with its bottom-right quarter cut away. Wound clockwise
// on screen, with one reflex vertex at (5, 5).
const L = [
  [0, 0],
  [10, 0],
  [10, 5],
  [5, 5],
  [5, 10],
  [0, 10],
];

// Monte-Carlo area from a containment test, on a fixed lattice so it is exact
// to the lattice and repeatable.
function countedArea(contains, box, n = 800) {
  const w = box.right - box.left,
    h = box.bottom - box.top;
  let inside = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (contains(box.left + ((i + 0.5) * w) / n, box.top + ((j + 0.5) * h) / n)) inside++;
    }
  }
  return (inside * w * h) / (n * n);
}

test("even-odd containment and convexity read a concave outline correctly", () => {
  assert.equal(isInsidePoly(2, 2, L), true);
  assert.equal(isInsidePoly(7, 7, L), false, "the notch is outside");
  assert.equal(isInsidePoly(7, 2, L), true);
  assert.equal(isInsidePoly(2, 7, L), true);
  assert.equal(isInsidePoly(12, 2, L), false);
  assert.equal(isConvexPoly(L), false);
  assert.equal(isConvexPoly(square(0, 0, 10)), true);
  assert.equal(isConvexPoly(square(0, 0, 10).reverse()), true);
  // A collinear vertex is still convex.
  assert.equal(
    isConvexPoly([
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]),
    true
  );
});

test("the general polygon clearance agrees with the convex one and handles notches", () => {
  near(polyGap(square(0, 0, 10), square(13, 0, 10)), 3);
  // A square tucked into the L's notch: disjoint, 1 mm from both arms.
  near(polyGap(L, square(6, 6, 3)), 1);
  // Pushed into the arm it overlaps, and the sign says so.
  assert.ok(polyGap(L, square(4, 6, 3)) < -0.001);
  // Entirely inside is an overlap too, even with no edge crossing.
  assert.ok(polyGap(L, square(1, 1, 2)) < -0.001);
  // Two crosses whose vertices all lie outside each other still overlap.
  const cross = (cx, cy) => [
    [cx - 1, cy - 5],
    [cx + 1, cy - 5],
    [cx + 1, cy - 1],
    [cx + 5, cy - 1],
    [cx + 5, cy + 1],
    [cx + 1, cy + 1],
    [cx + 1, cy + 5],
    [cx - 1, cy + 5],
    [cx - 1, cy + 1],
    [cx - 5, cy + 1],
    [cx - 5, cy - 1],
    [cx - 1, cy - 1],
  ];
  assert.ok(polyGap(cross(0, 0), cross(3, 3)) < -0.001);
  near(polyGap(cross(0, 0), cross(12, 0)), 2);
});

test("corner rounding on a concave outline adds at the notch and removes at the corners", () => {
  // Five convex corners lose (r² − πr²/4) each; the reflex one gains it back.
  const r = 1;
  const trade = r * r - (Math.PI * r * r) / 4;
  near(roundedPolyArea(L, r), 75 - 5 * trade + trade, 1e-9);
  // And the containment test describes the same shape, to the lattice.
  const box = { left: -0.5, right: 10.5, top: -0.5, bottom: 10.5 };
  const counted = countedArea((x, y) => isInsideRoundedPoly(x, y, L, r), box);
  assert.ok(Math.abs(counted - roundedPolyArea(L, r)) < 0.2, `${counted} vs ${roundedPolyArea(L, r)}`);
  // The reflex fillet: a point in the metal's corner is now hole …
  assert.equal(isInsideRoundedPoly(5.1, 5.1, L, r), true);
  // … and a point in a convex corner is now metal.
  assert.equal(isInsideRoundedPoly(0.05, 0.05, L, r), false);
  // The convex case is exactly what it was.
  near(roundedPolyArea(square(0, 0, 10), 2), 100 - 4 * (4 - Math.PI), 1e-9);
  const convexCounted = countedArea((x, y) => isInsideRoundedPoly(x, y, square(0, 0, 10), 2), box);
  assert.ok(Math.abs(convexCounted - roundedPolyArea(square(0, 0, 10), 2)) < 0.2);
  // Winding does not change the shape.
  near(roundedPolyArea(L.slice().reverse(), r), roundedPolyArea(L, r));
  assert.equal(isInsideRoundedPoly(5.1, 5.1, L.slice().reverse(), r), true);
});

test("rings are normalised by nesting: outers clockwise, bores the other way", () => {
  const rings = normalizeRings([square(2, 2, 6).reverse(), square(0, 0, 10).reverse(), square(4, 4, 2)]);
  assert.ok(signedPolyArea(rings[1]) > 0, "outer ring wound clockwise on screen");
  assert.ok(signedPolyArea(rings[0]) < 0, "bore wound the other way");
  assert.ok(signedPolyArea(rings[2]) > 0, "an island inside the bore is an outer again");
  near(ringsArea(rings), 100 - 36 + 4);
  assert.equal(ringsContains(rings, 1, 1), true);
  assert.equal(ringsContains(rings, 3, 3), false);
  assert.equal(ringsContains(rings, 5, 5), true);
  // Degenerate rings are dropped rather than left to poison the area.
  assert.equal(normalizeRings([[[0, 0], [1, 1]], square(0, 0, 1)]).length, 1); // prettier-ignore
  assert.deepEqual(ringsBBox(rings), { left: 0, right: 10, top: 0, bottom: 10 });
});

test("unit rings fill the unit square and remember the aspect", () => {
  const { rings, aspect } = unitRings([square(10, 20, 40).concat([]), square(50, 20, 40)]); // two squares side by side, 80 × 40
  assert.deepEqual(ringsBBox(rings), { left: -0.5, right: 0.5, top: -0.5, bottom: 0.5 });
  near(aspect, 0.5);
  near(ringsArea(rings), 1);
  // Scaled back to 80 × 40 they cover 3200 mm², whatever the rotation.
  near(ringsArea(transformRings(rings, 7, 7, 80, 40, 0)), 3200);
  near(ringsArea(transformRings(rings, 7, 7, 80, 40, 0.7)), 3200);
  assert.deepEqual(unitRings([]), { rings: [], aspect: 1 });
});

test("the clearance between ring outlines sees bores and separate pieces", () => {
  const ring = circleRing(0, 0, 5, 64);
  const bore = circleRing(0, 0, 3, 64);
  const washer = normalizeRings([ring, bore]);
  // A small hole sitting inside the bore is not an overlap; the metal between
  // them is the bore's wall.
  const inner = [circleRing(0, 0, 1, 32)];
  const gap = ringsGap(washer, inner);
  assert.ok(gap > 1.99 && gap <= 2, `${gap}`);
  // Two washers side by side are as far apart as their rims.
  const far = ringsGap(washer, transformRings(washer, 13, 0));
  assert.ok(far > 2.99 && far <= 3, `${far}`);
  assert.ok(ringsGap(washer, transformRings(washer, 8, 0)) < 0);
  // A two-piece outline is measured by its nearest piece.
  const slots = [square(-5, -1, 3), square(2, -1, 3)];
  near(ringsGap(slots, [square(-1, -1, 2)]), 1);
});

test("SVG paths and simplification", () => {
  const d = ringsSVGPath([square(0, 0, 2)], 10, 10, 1, 1);
  assert.equal(d, "M 10.000 10.000 L 12.000 10.000 L 12.000 12.000 L 10.000 12.000 Z");
  // A noisy line simplifies to its ends; a bent one keeps the bend.
  assert.deepEqual(simplifyPolyline([[0, 0], [1, 0.01], [2, -0.01], [3, 0]], 0.05), [[0, 0], [3, 0]]); // prettier-ignore
  assert.deepEqual(simplifyPolyline([[0, 0], [1, 0], [2, 2], [3, 0]], 0.05), [[0, 0], [1, 0], [2, 2], [3, 0]]); // prettier-ignore
  // A 256-gon circle at 0.05 mm keeps enough vertices to stay within tolerance
  // and drops the rest.
  const fine = circleRing(0, 0, 10, 256);
  const coarse = simplifyRing(fine, 0.05);
  assert.ok(coarse.length < fine.length && coarse.length >= arcSegmentsFor(10, Math.PI * 2, 0.05) - 2);
  near(ringsArea([coarse]), Math.PI * 100, Math.PI * 100 * 0.01);
  assert.equal(arcSegmentsFor(10, Math.PI * 2, 0.05), Math.ceil((2 * Math.PI) / (2 * Math.acos(1 - 0.005))));
});
