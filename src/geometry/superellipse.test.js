import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPER_N_MAX,
  superArea,
  superContains,
  superellipseVerts,
  superMixFromN,
  superNFromMix,
  superReach,
  superSupport,
} from "./superellipse.js";
import { calcHoleArea, calcShapeGap, checkShapeOverlap, isPointInsideHole } from "./shapes.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the mix slider puts the diamond, the ellipse and the square where it says", () => {
  near(superNFromMix(0), 1);
  near(superNFromMix(0.5), 2);
  near(superNFromMix(1), SUPER_N_MAX);
  // Monotone in between, so dragging the slider never doubles back.
  let previous = 0;
  for (let i = 0; i <= 20; i++) {
    const n = superNFromMix(i / 20);
    assert.ok(n > previous, `n must increase with the mix (${i / 20} → ${n})`);
    previous = n;
  }
  // And the inverse round-trips, which is what the panel's readout relies on.
  for (const mix of [0, 0.17, 0.5, 0.63, 1]) near(superMixFromN(superNFromMix(mix)), mix, 1e-9);
  // Out-of-range input is clamped rather than producing a non-convex outline.
  near(superNFromMix(-3), 1);
  near(superNFromMix(9), SUPER_N_MAX);
  near(superNFromMix(NaN), 2);
});

test("area is exact at the two shapes with a closed form of their own", () => {
  // n = 1 is the rhombus of diagonals w × h, n = 2 the ellipse.
  near(superArea(3, 2, 1), 2 * 3 * 2);
  near(superArea(3, 2, 2), Math.PI * 3 * 2, 1e-9);
  near(superArea(2.5, 2.5, 2), Math.PI * 6.25, 1e-9);
  // And it climbs toward the bounding rectangle without ever reaching it.
  const box = 4 * 3 * 2;
  assert.ok(superArea(3, 2, SUPER_N_MAX) < box);
  assert.ok(superArea(3, 2, SUPER_N_MAX) > 0.95 * box);
  for (const n of [1, 1.4, 2, 3, 5, 8]) {
    // Cross-check the closed form against the traced outline: the polygon is
    // inscribed, so it must land just under the exact value.
    const verts = superellipseVerts(6, 4, n, 2048);
    let shoelace = 0;
    for (let i = 0; i < verts.length; i++) {
      const [x1, y1] = verts[i],
        [x2, y2] = verts[(i + 1) % verts.length];
      shoelace += x1 * y2 - x2 * y1;
    }
    const polygon = Math.abs(shoelace) / 2;
    const exact = superArea(3, 2, n);
    assert.ok(polygon <= exact + 1e-9, `n=${n}: polygon ${polygon} must not exceed the exact ${exact}`);
    assert.ok(polygon > exact * 0.9999, `n=${n}: polygon ${polygon} too far below the exact ${exact}`);
  }
});

test("reach and contains agree with each other and with the implicit equation", () => {
  for (const n of [1, 1.5, 2, 4, 8]) {
    for (let i = 0; i < 24; i++) {
      const theta = (i / 24) * Math.PI * 2;
      const r = superReach(3, 2, n, theta);
      const x = r * Math.cos(theta),
        y = r * Math.sin(theta);
      near(Math.pow(Math.abs(x / 3), n) + Math.pow(Math.abs(y / 2), n), 1, 1e-9);
      assert.equal(superContains(x * 0.99, y * 0.99, 3, 2, n), true);
      assert.equal(superContains(x * 1.01, y * 1.01, 3, 2, n), false);
    }
  }
  // The ellipse is the only member whose reach is a familiar formula.
  near(superReach(3, 2, 2, 0), 3);
  near(superReach(3, 2, 2, Math.PI / 2), 2);
});

test("the registry entry drives area, hit test and clearance through the exponent", () => {
  near(calcHoleArea("Superellipse", 5, 5, 0, 2), Math.PI * 6.25, 1e-9);
  near(calcHoleArea("Superellipse", 5, 5, 0, 1), 12.5);
  // No exponent supplied → the ellipse, so a hole that predates the shape
  // channel (or arrives without one) still measures sensibly.
  near(calcHoleArea("Superellipse", 5, 5, 0), Math.PI * 6.25, 1e-9);

  const hole = (x, n, y = 0) => ({ x, y, w: 5, h: 5, holeRadius: 0, superN: n });
  // Two ellipses 8 mm apart, 5 mm across: a 3 mm ligament, like two circles.
  // Along the axes every exponent has the same reach (w/2), so the gap there is
  // the same for all of them — the family only differs off-axis.
  for (const n of [1, 2, 8]) near(calcShapeGap(hole(0, n), hole(8, n), "Superellipse"), 3, 1e-9);
  // Diagonally is where it shows: squaring them off eats into the gap from both
  // sides, and rhombi open it up.
  const diag = n => calcShapeGap(hole(0, n), hole(6, n, 6), "Superellipse");
  near(diag(2), Math.hypot(6, 6) - 5, 1e-9);
  assert.ok(diag(8) < diag(2), `${diag(8)} should be tighter than the ellipse's ${diag(2)}`);
  assert.ok(diag(1) > diag(2), `${diag(1)} should be looser than the ellipse's ${diag(2)}`);
  assert.equal(checkShapeOverlap(hole(0, 2), hole(4, 2), "Superellipse"), true);
  assert.equal(checkShapeOverlap(hole(0, 2), hole(8, 2), "Superellipse"), false);

  // The hit test reads the exponent off the hole, so a near-square hole covers
  // its corner where an ellipse of the same box does not.
  const square = { x: 0, y: 0, w: 5, h: 5, holeRadius: 0, exitW: 5, exitH: 5, superN: 8 };
  const round = { ...square, superN: 2 };
  assert.equal(isPointInsideHole(2.2, 2.2, square, "Superellipse"), true);
  assert.equal(isPointInsideHole(2.2, 2.2, round, "Superellipse"), false);
});

test("the traced outline closes and stays inside its box", () => {
  const verts = superellipseVerts(6, 4, 3);
  assert.equal(verts.length, 64);
  for (const [x, y] of verts) {
    assert.ok(Math.abs(x) <= 3 + 1e-9 && Math.abs(y) <= 2 + 1e-9, `${x},${y} escapes the 6×4 box`);
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
  }
  // The extremes are actually reached, so the drawn hole fills its nominal size.
  near(Math.max(...verts.map(v => v[0])), 3);
  near(Math.max(...verts.map(v => v[1])), 2);
});

test("the support function bounds the shape, and the radial function does not", () => {
  // h(θ) is the distance to the tangent line with normal θ; ρ(θ) is the distance
  // to the outline along θ. For a convex body ρ ≤ h, equal only where the normal
  // lines up with θ. Checked against a direct maximisation over the outline.
  for (const n of [1, 1.5, 2, 4, 8]) {
    for (let i = 0; i < 32; i++) {
      const theta = (i / 32) * Math.PI * 2;
      const verts = superellipseVerts(6, 4, n, 4096);
      const brute = Math.max(...verts.map(([x, y]) => x * Math.cos(theta) + y * Math.sin(theta)));
      near(superSupport(3, 2, n, theta), brute, 2e-5);
      assert.ok(superReach(3, 2, n, theta) <= superSupport(3, 2, n, theta) + 1e-12);
    }
  }
  // The two coincide only for the circle — where every normal points along its
  // own radius. That is why the difference stayed hidden: the ellipse at the
  // middle of the slider is a circle whenever the hole is as wide as it is tall.
  for (let i = 0; i < 16; i++) {
    const theta = (i / 16) * Math.PI * 2;
    near(superReach(3, 3, 2, theta), superSupport(3, 3, 2, theta), 1e-9);
    assert.ok(superSupport(3, 2, 2, theta) >= superReach(3, 2, 2, theta) - 1e-12);
  }
  // At the ends of the family it is the rhombus's own support function, and it
  // climbs toward the rectangle's.
  near(superSupport(3, 2, 1, Math.PI / 4), 3 * Math.cos(Math.PI / 4), 1e-9);
  assert.ok(superSupport(3, 2, 8, Math.PI / 4) < (3 + 2) * Math.cos(Math.PI / 4));
  assert.ok(superSupport(3, 2, 8, Math.PI / 4) > 0.75 * (3 + 2) * Math.cos(Math.PI / 4));
});

test("the reported clearance is never larger than the real one", () => {
  // The bug this replaces: `gap` measured each hole's reach along the centre
  // line instead of its support, so it reported a ligament up to 13% WIDER than
  // the metal actually is — on the default 60° lattice with the shape slider at
  // the square end, no controller needed. Over-reporting a ligament is the one
  // direction this statistic must never fail in.
  const hole = (x, y, n, angle = 0, w = 5, h = 5) => ({ x, y, w, h, holeRadius: 0, superN: n, angle });
  // Brute force: the true clearance between two convex outlines.
  const clearance = (a, b) => {
    const outline = o =>
      superellipseVerts(o.w, o.h, o.superN, 720).map(([x, y]) => [
        o.x + x * Math.cos(o.angle) - y * Math.sin(o.angle),
        o.y + x * Math.sin(o.angle) + y * Math.cos(o.angle),
      ]);
    const A = outline(a),
      B = outline(b);
    let best = Infinity;
    for (const [px, py] of A) for (const [qx, qy] of B) best = Math.min(best, Math.hypot(px - qx, py - qy));
    return best;
  };

  const cases = [
    // The default staggered-60° lattice at the square end of the slider: the
    // nearest neighbour sits on a diagonal, which is where reach and support
    // diverge most.
    [hole(0, 0, 8), hole(3.5, 6.06, 8)],
    [hole(0, 0, 1, Math.PI / 4), hole(3.5, 6.06, 1, Math.PI / 4)],
    [hole(0, 0, 4, -0.35), hole(7, 0, 4, 0.35)],
    [hole(0, 0, 8, 0.35), hole(7, 0, 8, 0.35)],
    [hole(0, 0, 2), hole(8, 0, 2)],
    [hole(0, 0, 8, 0, 10, 3), hole(9, 4, 8, 1.1, 10, 3)],
  ];
  for (const [a, b] of cases) {
    const reported = calcShapeGap(a, b, "Superellipse");
    const truth = clearance(a, b);
    const label = `n=${a.superN} at (${b.x}, ${b.y})`;
    // Never looser than the metal is: this is the direction the statistic must
    // not fail in, and every direction the search tries gives a valid lower
    // bound, so stopping early costs precision rather than soundness.
    assert.ok(reported <= truth + 1e-3, `${label}: reported ${reported} exceeds the true ${truth}`);
    // And close enough that the two-decimal readout is honest. The old
    // reach-based gap was 0.14 mm OVER on the first of these.
    assert.ok(reported > truth - 0.05, `${label}: reported ${reported} too far under the true ${truth}`);
  }

  // Crossing slots: genuinely overlapping, and the reach-based gap called them
  // 2.12 mm apart. Overlap must not be missed.
  assert.equal(checkShapeOverlap(hole(0, 0, 8, 0, 8, 2), hole(3.5, 3.5, 8, Math.PI / 2, 8, 2), "Superellipse"), true);
});
