import test from "node:test";
import assert from "node:assert/strict";
import {
  composeLayers,
  createShapeLayer,
  designExtent,
  duplicateLayer,
  hitTestLayerHandles,
  hitTestLayers,
  insertLayerVertexAt,
  layerHandles,
  layerRings,
  layersToUnitShape,
  moveLayerHandle,
  removeLayerVertexAt,
  translateLayer,
} from "./custom-shape.js";
import { ringsArea, ringsBBox, ringsContains } from "./rings.js";
import { createDocument } from "../core/document.js";
import { validateDocument } from "../core/persistence.js";
import { MAX_CUSTOM_POINTS } from "../core/constants.js";
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

test("reordering a cut and a later addition changes the restored solid", () => {
  const base = { ...createShapeLayer("Rectangle"), ratio: 0 };
  const cut = { ...base, id: "cut", role: "subtract", w: 6, h: 6 };
  const restore = { ...base, id: "restore", w: 2, h: 2 };
  const restored = composeLayers([base, cut, restore]).flat();
  near(ringsArea(restored), 100 - 36 + 4);
  assert.equal(ringsContains(restored, 0, 0), true);
  assert.equal(ringsContains(restored, 2, 0), false);
  const cutLast = composeLayers([base, restore, cut]).flat();
  near(ringsArea(cutLast), 100 - 36);
  assert.equal(ringsContains(cutLast, 0, 0), false);
  near(ringsArea(composeLayers([cut, base]).flat()), 100);
});

test("a complex composed outline survives save validation without losing its far end", () => {
  const layers = Array.from({ length: 12 }, (_, i) => ({
    ...createShapeLayer("Circle"),
    id: `layer-${i}`,
    x: i * 9,
  }));
  const rawArea = ringsArea(composeLayers(layers).flat());
  const custom = layersToUnitShape(layers);
  assert.ok(custom.rings.every(ring => ring.length <= MAX_CUSTOM_POINTS));
  const doc = createDocument();
  doc.hole.shape = "Custom";
  doc.hole.custom = custom;
  const restored = validateDocument(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(restored.hole.custom, custom);
  assert.equal(ringsContains(custom.rings, 0.49, 0), true);
  const fittedArea = ringsArea(custom.rings) * 109 * 10;
  assert.ok(Math.abs(fittedArea - rawArea) / rawArea < 0.003);
});

test("intersect keeps the overlap and exclude keeps everything but it", () => {
  const a = { ...createShapeLayer("Rectangle"), ratio: 0, w: 10, h: 10, x: 0 };
  const b = { ...createShapeLayer("Rectangle", [a]), ratio: 0, w: 10, h: 10, x: 5 };
  near(ringsArea(composeLayers([a, { ...b, role: "intersect" }]).flat()), 50);
  const excluded = composeLayers([a, { ...b, role: "exclude" }]).flat();
  near(ringsArea(excluded), 100);
  assert.equal(ringsContains(excluded, 2.5, 0), false, "the overlap is gone");
  assert.equal(ringsContains(excluded, -2.5, 0), true);
  assert.equal(ringsContains(excluded, 7.5, 0), true);
  // A cut with nothing yet to cut from is skipped rather than emptying the stack.
  near(ringsArea(composeLayers([{ ...a, role: "subtract" }, b]).flat()), 100);
  // Intersecting with nothing below is the shape itself.
  near(ringsArea(composeLayers([{ ...a, role: "intersect" }]).flat()), 100);
});

test("layers are dragged, resized, turned and picked on the editor's canvas", () => {
  const layer = { ...createShapeLayer("Rectangle"), ratio: 0, w: 20, h: 10 };
  const handles = layerHandles(layer, 3);
  assert.deepEqual(
    handles.map(h => h.id),
    ["nw", "ne", "se", "sw", "rotate"]
  );
  near(handles[2].x, 10);
  near(handles[2].y, 5);
  near(handles[4].y, -8);
  assert.equal(hitTestLayerHandles(layer, 10.2, 5.1, 1, 3).id, "se");
  assert.equal(hitTestLayerHandles(layer, 0, 0, 1, 3), null);

  const moved = translateLayer(layer, 3, 4);
  assert.deepEqual([moved.x, moved.y], [3, 4]);
  near(translateLayer(layer, 10, 0.4, true).y, 0);

  // A corner resizes about the centre; Shift keeps 2:1.
  const sized = moveLayerHandle(layer, handles[2], 15, 5);
  near(sized.w, 30);
  near(sized.h, 10);
  const kept = moveLayerHandle(layer, handles[2], 15, 5, true);
  near(kept.w, 30);
  near(kept.h, 15);
  // The knob turns it; Shift in 15° steps.
  assert.equal(moveLayerHandle(layer, handles[4], 10, 0).rotation, 90);
  assert.equal(moveLayerHandle(layer, handles[4], 10, -1, true).rotation, 90);

  // Picking: the topmost layer under the point, or near its outline.
  const other = { ...createShapeLayer("Circle", [layer]), x: 30, w: 10, h: 10 };
  assert.equal(hitTestLayers([layer, other], 0, 0).id, layer.id);
  assert.equal(hitTestLayers([layer, other], 30, 0).id, other.id);
  assert.equal(hitTestLayers([layer, other], 50, 50), null);
  assert.equal(hitTestLayers([layer, other], 10.5, 0, 1).id, layer.id);

  // Polygon vertices move, lock to 45° with Shift, and are added and removed.
  const poly = createShapeLayer("Polygon");
  const vertex = layerHandles(poly)[1];
  assert.equal(vertex.role, "vertex");
  assert.deepEqual(moveLayerHandle(poly, vertex, 6, 6).points[1], [6, 6]);
  assert.deepEqual(moveLayerHandle(poly, vertex, 0.3, 7, true).points[1], [0, 7]); // straight below vertex 0
  const grown = insertLayerVertexAt(poly, 5, 0, 5);
  assert.equal(grown.points.length, 4);
  assert.equal(insertLayerVertexAt(poly, 50, 50, 1), null);
  assert.equal(removeLayerVertexAt(grown, 1).points.length, 3);
  assert.equal(removeLayerVertexAt(poly, 0), null, "three is the floor");

  const twin = duplicateLayer(layer, [layer, other]);
  assert.notEqual(twin.id, layer.id);
  assert.ok(twin.x > layer.x);
  assert.equal(twin.w, layer.w);
});

test("the editor rejects proportions that would change after a reload", () => {
  assert.throws(
    () => layersToUnitShape([{ ...createShapeLayer("Rectangle"), w: 200, h: 0.1 }]),
    /height-to-width ratio/
  );
});
