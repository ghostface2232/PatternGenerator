import test from "node:test";
import assert from "node:assert/strict";
import { composeLayers, createShapeLayer, designExtent, layerRings, layersToUnitShape } from "./custom-shape.js";
import { ringsArea, ringsBBox, ringsContains } from "./rings.js";
import { calcHoleArea, isPointInsideHole } from "./shapes.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("layers are basic shapes placed in design millimetres", () => {
  const circle = createShapeLayer("Circle");
  assert.equal(circle.id, "layer-1");
  assert.equal(createShapeLayer("Star", [circle]).id, "layer-2");
  near(ringsArea(layerRings(circle)), Math.PI * 25, Math.PI * 25 * 0.002);
  const bar = { ...createShapeLayer("Rectangle"), x: 5, y: 0, w: 20, h: 4, rotation: 90, ratio: 0 };
  const box = ringsBBox(layerRings(bar));
  near(box.left, 3);
  near(box.right, 7);
  near(box.top, -10);
  near(box.bottom, 10);
  // A rounded rectangle loses its corners; a stadium at full rounding.
  near(ringsArea(layerRings({ ...bar, ratio: 1 })), 4 * 16 + Math.PI * 4, 0.05);
  assert.equal(layerRings({ ...createShapeLayer("Polygon"), points: [[0, 0]] }).length, 0);
  near(ringsArea(layerRings(createShapeLayer("Polygon"))), 45);
});

test("union adds, subtract takes away, and the result is one outline", () => {
  const disc = { ...createShapeLayer("Circle"), w: 20, h: 20 };
  const bore = { ...createShapeLayer("Circle", [disc]), w: 8, h: 8, role: "subtract" };
  const tab = { ...createShapeLayer("Rectangle", [disc, bore]), x: 12, y: 0, w: 10, h: 4, ratio: 0 };
  const washer = composeLayers([disc, bore, tab]);
  assert.equal(washer.length, 1, "one piece");
  assert.equal(washer[0].length, 2, "with a bore");
  near(ringsArea(washer[0]), Math.PI * 100 - Math.PI * 16 + 10 * 4 - 3 * 4, 0.5); // the tab overlaps the disc by 3 mm
  // Subtracting everything leaves nothing; a stack of cuts alone is nothing.
  assert.deepEqual(composeLayers([disc, { ...disc, id: "big", role: "subtract", w: 30, h: 30 }]), []);
  assert.deepEqual(composeLayers([bore]), []);
  const { box, area } = designExtent([disc, bore, tab]);
  near(box.right, 17);
  near(area, ringsArea(washer[0]));
});

test("the composed stack becomes a Custom hole that the registry draws and measures", () => {
  const disc = { ...createShapeLayer("Circle"), w: 20, h: 10 };
  const slot = { ...createShapeLayer("Rectangle", [disc]), w: 12, h: 2, role: "subtract", ratio: 0 };
  const custom = layersToUnitShape([disc, slot], "button");
  assert.equal(custom.kind, "layers");
  assert.equal(custom.name, "button");
  near(custom.aspect, 0.5);
  assert.deepEqual(ringsBBox(custom.rings), { left: -0.5, right: 0.5, top: -0.5, bottom: 0.5 });
  assert.equal(custom.layers.length, 2);
  // The slot is the disc's middle: metal now.
  assert.equal(ringsContains(custom.rings, 0, 0), false);
  assert.equal(ringsContains(custom.rings, 0, 0.3), true);
  // As a 20 × 10 hole its area is the ellipse less the slot.
  near(calcHoleArea("Custom", 20, 10, 0, custom.rings), Math.PI * 50 - 24, Math.PI * 50 * 0.003);
  assert.equal(isPointInsideHole(50, 50, { x: 50, y: 50, w: 20, h: 10, rings: custom.rings, holeRadius: 0 }, "Custom"), false); // prettier-ignore
  assert.equal(isPointInsideHole(50, 53, { x: 50, y: 50, w: 20, h: 10, rings: custom.rings, holeRadius: 0 }, "Custom"), true); // prettier-ignore
  assert.equal(layersToUnitShape([]).rings.length, 0);
});
