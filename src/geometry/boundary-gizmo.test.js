import test from "node:test";
import assert from "node:assert/strict";
import {
  boundaryHandles,
  cutoutBodyDistance,
  defaultBoundaryRings,
  hitTestBoundary,
  insertBoundaryVertex,
  moveBoundaryHandle,
  nearestBoundaryEdge,
  removeBoundaryVertex,
} from "./boundary-gizmo.js";
import { createCutout } from "./boundary.js";
import { fitRings, inspectSVG, svgToRings } from "./svg-import.js";
import { circleRing, ringsArea, ringsBBox } from "./rings.js";
import { DOC_LIMITS, MAX_BOUNDARY_POINTS, MAX_BOUNDARY_RINGS } from "../core/constants.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const square = [[20, 20], [180, 20], [180, 180], [20, 180]]; // prettier-ignore
const boundary = (patch = {}) => ({ shape: "Polygon", rings: [square], cutouts: [], ...patch });

test("the default polygon is an octagon touching the frame", () => {
  const [ring] = defaultBoundaryRings({ xMin: 0, xMax: 200, yMin: 0, yMax: 100 });
  assert.equal(ring.length, 8);
  const box = ringsBBox([ring]);
  near(box.left, 0, 1e-9);
  near(box.right, 200, 1e-9);
  near(box.top, 0, 1e-9);
  near(box.bottom, 100, 1e-9);
});

test("polygon vertices and cutouts have handles that hit, move and snap", () => {
  const cut = createCutout("Circle", 100, 100, 20);
  const b = boundary({ cutouts: [cut] });
  const handles = boundaryHandles(b);
  assert.equal(handles.length, 4 + 2);
  assert.equal(hitTestBoundary(b, 20.3, 20.2, 10).id, "r0v0");
  assert.equal(hitTestBoundary(b, 100, 100, 10).role, "move");
  assert.equal(hitTestBoundary(b, 110, 100, 10).role, "size");
  assert.equal(hitTestBoundary(b, 60, 60, 10), null);

  const moved = moveBoundaryHandle(b, handles[0], 25.4, 21.6, true);
  assert.deepEqual(moved.rings[0][0], [25, 22], "shift snaps to the millimetre grid");
  assert.deepEqual(moved.rings[0][1], [180, 20]);
  const far = moveBoundaryHandle(b, handles[0], 99999, -99999);
  assert.deepEqual(far.rings[0][0], [DOC_LIMITS["boundary.coord"][1], DOC_LIMITS["boundary.coord"][0]]);

  const dragged = moveBoundaryHandle(b, handles[4], 50, 60);
  assert.deepEqual([dragged.cutouts[0].x, dragged.cutouts[0].y], [50, 60]);
  const sized = moveBoundaryHandle(b, handles[5], 130, 100);
  near(sized.cutouts[0].w, 60);
  near(sized.cutouts[0].h, 60, 1e-9);
  assert.equal(moveBoundaryHandle(b, { role: "move", cutout: "ghost" }, 0, 0), null);
});

test("a rectangle cutout's rim handle follows its rotation and only its width", () => {
  const cut = { ...createCutout("Rectangle", 100, 100, 20), h: 8, rotation: 90 };
  const b = boundary({ cutouts: [cut] });
  const size = boundaryHandles(b).find(h => h.role === "size");
  near(size.x, 100, 1e-9);
  near(size.y, 110, 1e-9);
  const sized = moveBoundaryHandle(b, size, 100, 120);
  near(sized.cutouts[0].w, 40);
  assert.equal(sized.cutouts[0].h, 8);
});

test("a double-click on an edge inserts a vertex, and on a vertex removes it", () => {
  const b = boundary();
  const edge = nearestBoundaryEdge(b, 100, 22);
  assert.equal(edge.ring, 0);
  assert.equal(edge.index, 0);
  near(edge.distance, 2);
  const inserted = insertBoundaryVertex(b, edge, 100, 22);
  assert.equal(inserted.rings[0].length, 5);
  assert.deepEqual(inserted.rings[0][1], [100, 22]);
  const removed = removeBoundaryVertex({ ...b, ...inserted }, { role: "vertex", ring: 0, index: 1 });
  assert.deepEqual(removed.rings[0], square);
  // A triangle keeps its three.
  assert.equal(removeBoundaryVertex(boundary({ rings: [square.slice(0, 3)] }), { role: "vertex", ring: 0, index: 0 }), null); // prettier-ignore
  // A full ring takes no more.
  const full = boundary({ rings: [circleRing(100, 100, 50, MAX_BOUNDARY_POINTS)] });
  assert.equal(insertBoundaryVertex(full, { ring: 0, index: 0 }, 100, 50), null);
  // Polygon cutouts edit the same way.
  const poly = createCutout("Polygon", 100, 100, 20);
  const withPoly = boundary({ cutouts: [poly] });
  const cutEdge = nearestBoundaryEdge(withPoly, 105, 95);
  assert.equal(cutEdge.cutout, poly.id);
  assert.equal(insertBoundaryVertex(withPoly, cutEdge, 105, 95).cutouts[0].points.length, 5);
  assert.equal(removeBoundaryVertex(withPoly, { role: "vertex", cutout: poly.id, index: 0 }).cutouts[0].points.length, 3); // prettier-ignore
  // Click-to-select measures to the outline.
  near(cutoutBodyDistance(createCutout("Circle", 100, 100, 20), 115, 100), 5);
  near(cutoutBodyDistance({ ...createCutout("Rectangle", 100, 100, 20), h: 10 }, 100, 100), 5);
  near(cutoutBodyDistance(poly, 100, 90), 0);
});

test("an SVG file becomes rings in millimetres, simplified and within the caps", () => {
  const file = `<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="40mm" viewBox="0 0 400 400">
    <circle cx="200" cy="200" r="150"/><rect x="180" y="180" width="40" height="40"/></svg>`;
  const info = inspectSVG(file);
  assert.equal(info.isSVG, true);
  assert.equal(info.hasOutline, true);
  near(info.scale, 0.1);
  near(info.width, 300);
  const rings = svgToRings(file, { scale: info.scale, centre: { x: 100, y: 100 } });
  assert.equal(rings.length, 2);
  const box = ringsBBox(rings);
  near((box.left + box.right) / 2, 100, 1e-9);
  near(box.right - box.left, 30, 0.1); // simplified at 0.05 mm
  // The square is a counter: even-odd takes it out of the circle.
  near(ringsArea(rings), Math.PI * 225 - 16, Math.PI * 225 * 0.01);
  // Simplified: a 15 mm circle at 0.05 mm needs a few dozen chords, not the
  // hundreds the parser drew at its finer tolerance.
  assert.ok(rings[0].length < 120 && rings[0].length > 20, `${rings[0].length} vertices`);
  // No units: the caller's scale is what counts.
  const unitless = svgToRings('<svg width="400"><circle cx="200" cy="200" r="150"/></svg>', { scale: 0.05 });
  near(ringsBBox(unitless).right - ringsBBox(unitless).left, 15, 1e-9);
  // The caps: too many rings keeps the largest, too fine a ring is coarsened.
  const many = fitRings(
    Array.from({ length: MAX_BOUNDARY_RINGS + 5 }, (_, i) => circleRing(i * 30, 0, i === 3 ? 20 : 5, 12))
  );
  assert.equal(many.length, MAX_BOUNDARY_RINGS);
  assert.ok(
    many.some(ring => ringsBBox([ring]).right - ringsBBox([ring]).left > 39),
    "the big one survives"
  );
  const fine = fitRings([circleRing(0, 0, 500, 5000)], { maxPoints: 100 });
  assert.ok(fine[0].length <= 100 && fine[0].length > 30, `${fine[0].length}`);
});
