import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRadialHoles,
  getRadialShapeExtents,
  getRadialShapeOuterRadius,
  projectedShapeGap,
  shapeExtent,
  shapeReach,
} from "./radial-engine.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("radial shape extents follow the oriented hole axes", () => {
  assert.deepEqual(getRadialShapeExtents("Rectangle", 12, 5), { radial: 12, tangential: 5 });
  assert.deepEqual(getRadialShapeExtents("Triangle", 10, 8), { radial: 8, tangential: 10 });
  const hex = getRadialShapeExtents("Hexagon", 10, 10);
  assert.ok(Math.abs(hex.radial - 5 * Math.sqrt(3)) < 1e-9);
  assert.equal(hex.tangential, 10);
});

test("radial outer radii enclose rotated and asymmetric shapes", () => {
  assert.equal(getRadialShapeOuterRadius("Circle", 10, 10), 5);
  assert.equal(getRadialShapeOuterRadius("Rectangle", 12, 5), 6.5);
  assert.equal(getRadialShapeOuterRadius("Pill", 12, 5), 6);
  assert.ok(getRadialShapeOuterRadius("Triangle", 10, 8.66) > 5);
});

test("legacy concentric layout accepts the original sheet center", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 40, xMax: 200, yMin: 10, yMax: 150 },
    radialGap: 5,
    circumGap: 5,
    fillMode: "Circle",
    centerHole: true,
    center: { x: 100, y: 80 },
  });
  assert.deepEqual({ x: holes[0].x, y: holes[0].y }, { x: 100, y: 80 });
});

test("legacy concentric ring populations use the circumference approximation", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 0, xMax: 200, yMin: 0, yMax: 200 },
    radialGap: 5,
    circumGap: 5,
    fillMode: "Circle",
    ringSpacing: 10,
    circumSpacing: 10,
  });
  const firstRing = holes.filter(hole => Math.abs(distance(hole, { x: 100, y: 100 }) - 10) < 1e-7);
  const secondRing = holes.filter(hole => Math.abs(distance(hole, { x: 100, y: 100 }) - 20) < 1e-7);
  assert.equal(firstRing.length, Math.floor(2 * Math.PI));
  assert.equal(secondRing.length, Math.floor(4 * Math.PI));
});

test("legacy concentric rings retain their shared zero-degree seam", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 0, xMax: 200, yMin: 0, yMax: 200 },
    radialGap: 5,
    circumGap: 5,
    fillMode: "Circle",
  });
  const onPositiveAxis = holes.filter(hole => Math.abs(hole.y - 100) < 1e-7 && hole.x > 100);
  assert.equal(onPositiveAxis.length, 10);
});

test("legacy sparse one-point rings remain on the same spoke", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
    radialGap: 1,
    circumGap: 50,
    fillMode: "Circle",
  });
  assert.ok(holes.length >= 2);
  const a = Math.atan2(holes[0].y - 50, holes[0].x - 50);
  const b = Math.atan2(holes[1].y - 50, holes[1].x - 50);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("legacy concentric spacing stays diameter-based for custom rectangles", () => {
  const holes = generateRadialHoles({
    shape: "Rectangle",
    w: 12,
    h: 5,
    bounds: { xMin: 0, xMax: 240, yMin: 0, yMax: 240 },
    radialGap: 3,
    circumGap: 3,
    fillMode: "Circle",
    ringSpacing: 8,
    circumSpacing: 8,
  });
  const radii = [...new Set(holes.map(hole => Math.hypot(hole.x - 120, hole.y - 120).toFixed(5)))]
    .map(Number)
    .sort((a, b) => a - b);
  assert.equal(radii[0], 8);
  assert.equal(radii[1] - radii[0], 8);
});

test("legacy concentric ring populations are independent of hole shape", () => {
  const cases = [
    ["Circle", 5, 5],
    ["Rectangle", 12, 5],
    ["Pill", 12, 5],
    ["Hexagon", 5, 5],
    ["Diamond", 10, 6],
    ["Triangle", 10, 8.66],
  ];
  let expectedCount = null;
  for (const [shape, w, h] of cases) {
    const holes = generateRadialHoles({
      shape,
      w,
      h,
      diamondOrient: "Point up",
      bounds: { xMin: 0, xMax: 120, yMin: 0, yMax: 120 },
      radialGap: 3,
      circumGap: 3,
      fillMode: "Circle",
      ringSpacing: 8,
      circumSpacing: 8,
    });
    expectedCount ??= holes.length;
    assert.equal(holes.length, expectedCount, `${shape} changed the legacy ring population`);
  }
});

test("sunflower layout follows a golden-angle Fermat spiral", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 0, xMax: 120, yMin: 0, yMax: 120 },
    radialGap: 3,
    circumGap: 3,
    fillMode: "Circle",
    layout: "Sunflower",
  });
  const center = { x: 60, y: 60 };
  const radii = holes.slice(0, 8).map(hole => distance(hole, center));
  const squaredStep = radii[0] ** 2;
  for (let i = 0; i < radii.length; i++) {
    assert.ok(Math.abs(radii[i] ** 2 - squaredStep * (i + 1)) < 1e-7);
  }
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const a = Math.atan2(holes[0].y - center.y, holes[0].x - center.x);
  const b = Math.atan2(holes[1].y - center.y, holes[1].x - center.x);
  const wrappedDelta = (((b - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  assert.ok(Math.abs(wrappedDelta - goldenAngle) < 1e-9);
});

test("sunflower layout preserves its requested edge gap", () => {
  const config = { shape: "Rectangle", w: 12, h: 5, diamondOrient: "Point up" };
  const holes = generateRadialHoles({
    ...config,
    bounds: { xMin: 0, xMax: 160, yMin: 0, yMax: 160 },
    radialGap: 3,
    circumGap: 3,
    fillMode: "Circle",
    layout: "Sunflower",
    centerHole: true,
  });
  let minimum = Infinity;
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      minimum = Math.min(minimum, projectedShapeGap(holes[i], holes[j], config));
    }
  }
  assert.ok(minimum >= 3 - 1e-7, `Sunflower minimum projected gap was ${minimum}`);
});

test("6k rosette places exactly 6k holes on ring k", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 0, xMax: 120, yMin: 0, yMax: 120 },
    radialGap: 3,
    circumGap: 3,
    fillMode: "Circle",
    layout: "6k Rosette",
  });
  const populations = new Map();
  for (const hole of holes) {
    const radius = distance(hole, { x: 60, y: 60 }).toFixed(6);
    populations.set(radius, (populations.get(radius) || 0) + 1);
  }
  assert.deepEqual([...populations.values()].slice(0, 5), [6, 12, 18, 24, 30]);
});

test("6k rosette expands rings to preserve circumferential gaps", () => {
  const config = { shape: "Circle", w: 5, h: 5 };
  const holes = generateRadialHoles({
    ...config,
    bounds: { xMin: 0, xMax: 240, yMin: 0, yMax: 240 },
    radialGap: 1,
    circumGap: 10,
    fillMode: "Circle",
    layout: "6k Rosette",
  });
  let minimum = Infinity;
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      minimum = Math.min(minimum, projectedShapeGap(holes[i], holes[j], config));
    }
  }
  assert.ok(minimum >= 1 - 1e-6, `6k Rosette minimum projected gap was ${minimum}`);
  const firstRingRadius = Math.min(...holes.map(hole => distance(hole, { x: 120, y: 120 })));
  assert.ok(firstRingRadius >= 15 - 1e-7);
});

test("6k rosette preserves projected gaps for every radial hole shape", () => {
  const cases = [
    ["Circle", 5, 5],
    ["Rectangle", 12, 5],
    ["Pill", 12, 5],
    ["Hexagon", 8, 8],
    ["Diamond", 10, 6],
    ["Triangle", 10, 8.66],
  ];
  for (const [shape, w, h] of cases) {
    const config = { shape, w, h, diamondOrient: "Point up" };
    const holes = generateRadialHoles({
      ...config,
      bounds: { xMin: 0, xMax: 140, yMin: 0, yMax: 140 },
      radialGap: 3,
      circumGap: 3,
      fillMode: "Circle",
      layout: "6k Rosette",
      centerHole: true,
    });
    let minimum = Infinity;
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        minimum = Math.min(minimum, projectedShapeGap(holes[i], holes[j], config));
      }
    }
    assert.ok(minimum >= 3 - 1e-6, `${shape} 6k Rosette gap was ${minimum}`);
  }
});

test("shapeReach is the centre distance at which two holes are the gap apart", () => {
  // Along a hole's own axis the reach is its width plus the gap, for every
  // shape; off-axis it is the exit of the hole's difference body, which is
  // shorter than the extent — a 20 × 2 mm slot shifted along 30° clears its
  // twin after 4 mm (the 2 mm height over sin 30°), not after the 18.3 mm it
  // is wide along that direction.
  const rad = deg => (deg * Math.PI) / 180;
  assert.equal(shapeReach("Circle", 5, 5, 0, rad(37), 3), 8);
  assert.ok(Math.abs(shapeReach("Rectangle", 20, 2, 0, 0, 3) - 23) < 1e-9);
  assert.ok(Math.abs(shapeReach("Rectangle", 20, 2, 0, rad(90), 1) - 3) < 1e-9);
  assert.ok(Math.abs(shapeReach("Rectangle", 20, 2, 0, rad(30), 0) - 4) < 1e-9);
  assert.ok(Math.abs(shapeExtent("Rectangle", 20, 2, 0, rad(30)) - (20 * Math.cos(rad(30)) + 2 * Math.sin(rad(30)))) < 1e-9); // prettier-ignore
  // Turning the hole with the direction leaves the reach unchanged.
  assert.ok(Math.abs(shapeReach("Rectangle", 20, 2, rad(30), rad(60), 0) - 4) < 1e-9);
  // The pill's closed form agrees with the exact reading of it as a polygon:
  // along its axis the caps meet, across it the flanks do, and in between the
  // gap is measured round the cap.
  assert.ok(Math.abs(shapeReach("Pill", 12, 4, 0, 0, 2) - 14) < 1e-9);
  assert.ok(Math.abs(shapeReach("Pill", 12, 4, 0, rad(90), 2) - 6) < 1e-9);
  assert.ok(Math.abs(shapeReach("Pill", 4, 12, 0, 0, 2) - 6) < 1e-9);
  const pillGap = (t, theta) => {
    // Clearance of a 12 × 4 stadium from its translate by t along theta: the
    // distance between the two 8 mm core segments, less the two radii.
    const dx = t * Math.cos(theta),
      dy = t * Math.sin(theta);
    let best = Infinity;
    for (const ax of [-4, 4]) for (const bx of [-4, 4]) best = Math.min(best, Math.hypot(bx + dx - ax, dy));
    const foot = Math.min(4, Math.max(-4, dx - 4)),
      foot2 = Math.min(4, Math.max(-4, -dx - 4));
    best = Math.min(best, Math.hypot(dx - 4 - foot, dy), Math.hypot(-dx - 4 - foot2, dy));
    return best - 4;
  };
  for (const deg of [10, 25, 45, 70]) {
    const t = shapeReach("Pill", 12, 4, 0, rad(deg), 1.5);
    assert.ok(Math.abs(pillGap(t, rad(deg)) - 1.5) < 1e-9, `${deg}°: ${pillGap(t, rad(deg))}`);
  }
  // The polygons are the ones the holes are drawn with. A 6 mm triangle
  // shifted along its base clears after its base width, and slid along its
  // slant only once the whole edge has passed — the slant's length, which is
  // longer than the base. A pointy-top hexagon meets its neighbour flat to
  // flat across, corner to corner up.
  assert.ok(Math.abs(shapeReach("Triangle", 6, 6, 0, 0, 0) - 6) < 1e-9);
  assert.ok(Math.abs(shapeReach("Triangle", 6, 6, 0, Math.atan2(-6, 3), 0) - Math.hypot(3, 6)) < 1e-9);
  assert.ok(Math.abs(shapeReach("Hexagon", 6, 6, 0, 0, 0) - 3 * Math.sqrt(3)) < 1e-9);
  assert.ok(Math.abs(shapeReach("Hexagon", 6, 6, 0, rad(90), 0) - 6) < 1e-9);
  assert.ok(Math.abs(shapeReach("Diamond", 8, 4, 0, rad(90), 1) - 5) < 1e-9);
  // Never more than the extent plus the gap, which is what it replaces.
  for (const shape of ["Rectangle", "Hexagon", "Diamond", "Triangle", "Superellipse"])
    for (const deg of [0, 17, 45, 80, 130])
      assert.ok(shapeReach(shape, 9, 4, 0.3, rad(deg), 2) <= shapeExtent(shape, 9, 4, 0.3, rad(deg)) + 2 + 1e-9, `${shape} ${deg}°`); // prettier-ignore
});
