import test from "node:test";
import assert from "node:assert/strict";
import { clipPolyHalfPlane, insetConvexPoly, polyArea, polyBBox, signedPolyArea } from "./polygon.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
// Clockwise on screen (y runs down), which is the winding the interior tests and
// the inset below both read as "inside on the left".
const square = (x, y, size) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];

test("shoelace area, and the sign that says which way round the outline runs", () => {
  near(polyArea(square(0, 0, 10)), 100);
  assert.ok(signedPolyArea(square(0, 0, 10)) > 0);
  assert.ok(signedPolyArea(square(0, 0, 10).reverse()) < 0);
  near(polyArea(square(0, 0, 10).reverse()), 100, 1e-9);
  // A triangle, and the degenerate cases the statistics must survive.
  near(
    polyArea([
      [0, 0],
      [4, 0],
      [0, 3],
    ]),
    6
  );
  near(polyArea([]), 0);
  assert.deepEqual(polyBBox([]), { left: 0, right: 0, top: 0, bottom: 0 });
  assert.deepEqual(polyBBox(square(2, 3, 5)), { left: 2, right: 7, top: 3, bottom: 8 });
});

test("half-plane clipping keeps the side it is asked for", () => {
  // Everything with x ≤ 4, out of a 10 mm square at the origin.
  const left = clipPolyHalfPlane(square(0, 0, 10), 1, 0, 4);
  near(polyArea(left), 40);
  assert.ok(left.every(([x]) => x <= 4 + 1e-9));
  // A cut that misses leaves the polygon alone; one that passes it leaves nothing.
  assert.equal(clipPolyHalfPlane(square(0, 0, 10), 1, 0, 20).length, 4);
  assert.equal(clipPolyHalfPlane(square(0, 0, 10), 1, 0, -1).length, 0);
});

test("the convex inset is the exact erosion, whichever way the outline is wound", () => {
  // A square inset by 1 is a square 2 mm smaller in each direction — and the same
  // answer from the reversed winding, which is the case that would otherwise GROW
  // the polygon by 1 instead of shrinking it.
  for (const verts of [square(0, 0, 10), square(0, 0, 10).reverse()]) {
    const inner = insetConvexPoly(verts, 1);
    near(polyArea(inner), 64);
    assert.deepEqual(polyBBox(inner), { left: 1, right: 9, top: 1, bottom: 9 });
  }
  // Two squares 10 mm apart, each pulled back by half of that, leave exactly the
  // gap between them: the property the Voronoi ligament rests on.
  const gap = 3;
  const a = insetConvexPoly(square(0, 0, 10), gap / 2);
  const b = insetConvexPoly(square(10, 0, 10), gap / 2);
  near(polyBBox(b).left - polyBBox(a).right, gap);
  // Past the inradius the polygon closes up rather than turning inside out.
  assert.deepEqual(insetConvexPoly(square(0, 0, 10), 5.1), []);
  assert.deepEqual(insetConvexPoly(square(0, 0, 10), 0), square(0, 0, 10), "no inset, no copy");
});
