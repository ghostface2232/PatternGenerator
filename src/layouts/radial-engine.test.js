import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRadialHoles,
  getRadialShapeExtents,
  getRadialShapeOuterRadius,
  projectedShapeGap,
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
  const radii = [...new Set(holes.map(hole => Math.hypot(hole.x - 120, hole.y - 120).toFixed(5)))].map(Number).sort((a, b) => a - b);
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
      shape, w, h, diamondOrient: "Point up",
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
  const wrappedDelta = ((b - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
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
