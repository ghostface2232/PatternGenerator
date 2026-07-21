import test from "node:test";
import assert from "node:assert/strict";
import {
  generateRadialHoles,
  getRadialShapeExtents,
  getRadialShapeOuterRadius,
  maxRingPointCount,
  projectedShapeGap,
} from "./radial-engine.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("ring counts use the real chord instead of the circumference approximation", () => {
  assert.equal(maxRingPointCount(5.5, 10), 2);
  assert.equal(maxRingPointCount(10, 10), 6);
  assert.ok(2 * 10 * Math.sin(Math.PI / maxRingPointCount(10, 10)) >= 10 - 1e-9);
});

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

test("radial layout is centered in asymmetric perforation bounds", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 40, xMax: 200, yMin: 10, yMax: 150 },
    radialGap: 5,
    circumGap: 5,
    fillMode: "Circle",
    centerHole: true,
  });
  assert.deepEqual({ x: holes[0].x, y: holes[0].y }, { x: 120, y: 80 });
});

test("linked circular gaps preserve the requested minimum center spacing", () => {
  const holes = generateRadialHoles({
    shape: "Circle",
    w: 5,
    h: 5,
    bounds: { xMin: 0, xMax: 200, yMin: 0, yMax: 200 },
    radialGap: 5,
    circumGap: 5,
    fillMode: "Circle",
  });
  let minimum = Infinity;
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) minimum = Math.min(minimum, distance(holes[i], holes[j]));
  }
  assert.ok(minimum >= 10 - 1e-6, `minimum center spacing was ${minimum}`);
});

test("successive rings do not share one persistent zero-degree seam", () => {
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
  assert.ok(onPositiveAxis.length < 4, `${onPositiveAxis.length} rings still aligned on the seam`);
});

test("sparse one-point rings rotate instead of stacking on one spoke", () => {
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
  assert.ok(Math.abs(a - b) > Math.PI / 2);
});

test("custom rectangles use their real width for radial spacing", () => {
  const holes = generateRadialHoles({
    shape: "Rectangle",
    w: 12,
    h: 5,
    bounds: { xMin: 0, xMax: 240, yMin: 0, yMax: 240 },
    radialGap: 3,
    circumGap: 3,
    fillMode: "Circle",
  });
  const radii = [...new Set(holes.map(hole => Math.hypot(hole.x - 120, hole.y - 120).toFixed(5)))].map(Number).sort((a, b) => a - b);
  assert.ok(radii[0] >= 15 - 1e-6);
  assert.ok(radii[1] - radii[0] >= 15 - 1e-6);
});

test("all supported radial shapes preserve their projected edge gaps", () => {
  const cases = [
    ["Circle", 5, 5],
    ["Rectangle", 12, 5],
    ["Pill", 12, 5],
    ["Hexagon", 5, 5],
    ["Diamond", 10, 6],
    ["Triangle", 10, 8.66],
  ];
  for (const [shape, w, h] of cases) {
    const config = { shape, w, h, diamondOrient: "Point up" };
    const holes = generateRadialHoles({
      ...config,
      bounds: { xMin: 0, xMax: 120, yMin: 0, yMax: 120 },
      radialGap: 3,
      circumGap: 3,
      fillMode: "Circle",
    });
    let minimum = Infinity;
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        minimum = Math.min(minimum, projectedShapeGap(holes[i], holes[j], config));
      }
    }
    assert.ok(minimum >= 3 - 1e-3, `${shape} minimum projected gap was ${minimum}`);
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
