import test from "node:test";
import assert from "node:assert/strict";
import {
  RADIUS_MIN_MM,
  addPolylinePoint,
  controllerBodyDistance,
  controllerHandles,
  controllerPolyline,
  hitTestController,
  insertPolylinePointAt,
  moveControllerHandle,
  reachAnchor,
  removePolylinePoint,
  removePolylinePointAt,
  translateController,
} from "./controller-gizmo.js";
import { MAX_POLYLINE_POINTS, createController } from "./controllers.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const AREA = { x: 0, y: 0, w: 200, h: 200 };
const line = (patch = {}) => ({
  id: "c1",
  channel: "size",
  kind: "line",
  geometry: {
    points: [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ],
  },
  target: 2,
  radius: 10,
  ...patch,
});

test("a controller shows one handle per point plus its reach", () => {
  const handles = controllerHandles(line());
  assert.deepEqual(
    handles.map(h => h.id),
    ["p0", "p1", "radius"]
  );
  // The reach handle leaves the path at a right angle, at exactly `radius`.
  const reach = handles[2];
  near(Math.hypot(reach.x - 10, reach.y - 0), 10);
  near(reach.x, 10);
  // A point controller has nowhere to be perpendicular to, so it reaches along x.
  const point = controllerHandles({ ...line(), kind: "point", geometry: { points: [{ x: 5, y: 5 }] } });
  assert.deepEqual(
    point.map(h => h.id),
    ["p0", "radius"]
  );
  near(point[1].x, 15);
  near(point[1].y, 5);
  // No geometry → no handles, rather than a handle at NaN.
  assert.deepEqual(controllerHandles({ ...line(), geometry: { points: [] } }), []);
  assert.equal(reachAnchor({ ...line(), geometry: { points: [] } }), null);
});

test("a curve's handles stay on its control points while it measures along the flattening", () => {
  const curve = createController({ channel: "size", kind: "curve", area: AREA });
  assert.deepEqual(
    controllerHandles(curve).map(h => h.id),
    ["p0", "p1", "p2", "p3", "radius"]
  );
  // The path it measures against is the flattened curve, which is longer than
  // the four control points and starts and ends on the curve's own endpoints.
  const path = controllerPolyline(curve);
  assert.ok(path.length > 4);
  near(path[0].x, curve.geometry.points[0].x);
  near(path[path.length - 1].x, curve.geometry.points[3].x);
});

test("hit testing is in screen pixels, so it does not change with the zoom", () => {
  const controller = line();
  // 4 mm away: a hit at 4 px/mm (16 px), a miss at 1 px/mm (4 px is inside 14 too)…
  assert.equal(hitTestController(controller, 4, 0, 1), "p0");
  // …and a miss once 4 mm is more than 14 screen pixels away.
  assert.equal(hitTestController(controller, 4, 0, 10), null);
  assert.equal(hitTestController(controller, 20.5, 0, 4), "p1");
  assert.equal(hitTestController(controller, 100, 100, 4), null);
});

test("dragging a handle moves exactly the thing it stands for", () => {
  const controller = line();
  const moved = moveControllerHandle(controller, "p1", 30, 5);
  assert.deepEqual(moved.geometry.points, [
    { x: 0, y: 0 },
    { x: 30, y: 5 },
  ]);
  assert.equal(moved.radius, undefined, "moving a point must not touch the reach");
  assert.equal(controller.geometry.points[1].x, 20, "the original must not be mutated");

  const reached = moveControllerHandle(controller, "radius", 10, 25);
  near(reached.radius, 25);
  assert.equal(reached.geometry, undefined, "dragging the reach must not touch the geometry");
  // Never zero: a reach of 0 makes the controller a point of measure-zero effect
  // that cannot be dragged back open.
  near(moveControllerHandle(controller, "radius", 10, 0).radius, RADIUS_MIN_MM);

  // Shift locks a vertex to 45° from its neighbour at a whole number of
  // millimetres, and the reach to its own step. From p1 at (20, 0), a cursor at
  // (3.4, −2.6) is 9° off level, 16.8 mm away: the segment comes out level.
  assert.deepEqual(moveControllerHandle(controller, "p0", 3.4, -2.6, true).geometry.points[0], { x: 3, y: 0 });
  // Straight down from p0 at (0, 0): the line stands square.
  const square = moveControllerHandle(controller, "p1", 1.2, 14.7, true).geometry.points[1];
  near(square.x, 0);
  near(square.y, 15);
  // A lone point has no neighbour, so Shift simply lands it on the grid.
  const lone = { ...controller, kind: "point", geometry: { points: [{ x: 5, y: 5 }] } };
  assert.deepEqual(moveControllerHandle(lone, "p0", 3.4, -2.6, true).geometry.points[0], { x: 3, y: -3 });
  near(moveControllerHandle(controller, "radius", 10, 7.4, true).radius, 7.5);

  // A handle from another controller is a no-op, not a corruption.
  assert.equal(moveControllerHandle(controller, "p9", 0, 0), null);
  assert.equal(moveControllerHandle(controller, "img-move", 0, 0), null);
  assert.equal(moveControllerHandle(controller, "nonsense", 0, 0), null);
});

test("an image controller moves, resizes and rotates about its own centre", () => {
  const controller = createController({ channel: "size", kind: "image", area: AREA });
  const { w, h } = controller.image.placement;
  assert.deepEqual(
    controllerHandles(controller).map(h => h.id),
    ["img-move", "img-size", "img-rot"]
  );

  const moved = moveControllerHandle(controller, "img-move", 20, 30);
  near(moved.image.placement.x + moved.image.placement.w / 2, 20);
  near(moved.image.placement.y + moved.image.placement.h / 2, 30);
  near(moved.image.placement.w, w);
  near(moved.image.placement.h, h);

  const centre = { x: controller.image.placement.x + w / 2, y: controller.image.placement.y + h / 2 };
  const sized = moveControllerHandle(controller, "img-size", centre.x + 30, centre.y + 20);
  near(sized.image.placement.w, 60);
  near(sized.image.placement.h, 40);
  near(sized.image.placement.x + 30, centre.x, 1e-9); // centre held
  assert.ok(moveControllerHandle(controller, "img-size", centre.x, centre.y).image.placement.w >= 1);

  const turned = moveControllerHandle(controller, "img-rot", centre.x + 10, centre.y);
  assert.equal(turned.image.placement.rotation, 90);
  assert.equal(moveControllerHandle(controller, "img-rot", centre.x + 10, centre.y - 1, true).image.placement.rotation, 90); // prettier-ignore
  // Rotation stays in −180..180 rather than winding up over repeated drags.
  for (const [dx, dy] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [0, -1],
  ]) {
    const r = moveControllerHandle(controller, "img-rot", centre.x + dx, centre.y + dy).image.placement.rotation;
    assert.ok(r >= -180 && r <= 180, `rotation ${r} escaped the range`);
  }
  assert.equal(moveControllerHandle(controller, "p0", 0, 0), null);
});

test("clicking near a controller finds it; clicking away from it does not", () => {
  near(controllerBodyDistance(line(), 10, 6), 6);
  near(controllerBodyDistance(line(), -4, 3), 5);
  const point = { ...line(), kind: "point", geometry: { points: [{ x: 0, y: 0 }] } };
  near(controllerBodyDistance(point, 3, 4), 5);
  assert.equal(controllerBodyDistance({ ...line(), geometry: { points: [] } }, 0, 0), Infinity);

  // An image controller's body is its rectangle: zero inside, edge distance out.
  const image = createController({ channel: "size", kind: "image", area: AREA });
  const p = image.image.placement;
  near(controllerBodyDistance(image, p.x + p.w / 2, p.y + p.h / 2), 0);
  near(controllerBodyDistance(image, p.x - 5, p.y + p.h / 2), 5);
  near(controllerBodyDistance(image, p.x - 3, p.y - 4), 5); // outside a corner
});

test("polyline vertices are added on the longest span and removed from the end", () => {
  const controller = {
    ...line(),
    kind: "polyline",
    geometry: {
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 45, y: 0 },
      ],
    },
  };
  const added = addPolylinePoint(controller);
  assert.equal(added.geometry.points.length, 4);
  assert.deepEqual(added.geometry.points[2], { x: 25, y: 0 }); // the 40 mm span, not the 5 mm one
  assert.deepEqual(added.geometry.points[0], controller.geometry.points[0]);

  assert.equal(removePolylinePoint(controller).geometry.points.length, 2);
  assert.equal(removePolylinePoint({ ...controller, geometry: { points: controller.geometry.points.slice(0, 2) } }), null); // prettier-ignore
  assert.equal(addPolylinePoint(line()), null); // not a polyline
  assert.equal(removePolylinePoint(line()), null);

  // The cap holds: adding past it is refused rather than growing without end.
  let long = { ...controller, geometry: { points: controller.geometry.points } };
  for (let i = 0; i < MAX_POLYLINE_POINTS + 5; i++) {
    const next = addPolylinePoint(long);
    if (!next) break;
    long = { ...long, geometry: next.geometry };
  }
  assert.equal(long.geometry.points.length, MAX_POLYLINE_POINTS);
  assert.equal(addPolylinePoint(long), null);

  // A double-click on the line puts a vertex where the pointer is, on that span.
  const onSpan = insertPolylinePointAt(controller, 30, 2, 5);
  assert.equal(onSpan.geometry.points.length, 4);
  assert.deepEqual(onSpan.geometry.points[2], { x: 30, y: 0 });
  assert.equal(insertPolylinePointAt(controller, 30, 20, 5), null, "too far from the line");
  assert.equal(insertPolylinePointAt(line(), 10, 0), null, "not a polyline");
  // …and on a vertex takes that one away, never the last two.
  assert.deepEqual(removePolylinePointAt(controller, 1).geometry.points, [
    { x: 0, y: 0 },
    { x: 45, y: 0 },
  ]);
  assert.equal(removePolylinePointAt({ ...controller, geometry: { points: controller.geometry.points.slice(0, 2) } }, 0), null); // prettier-ignore
});

test("a controller is dragged by its body as one piece", () => {
  const moved = translateController(line(), 5, -3);
  assert.deepEqual(moved.geometry.points, [
    { x: 5, y: -3 },
    { x: 25, y: -3 },
  ]);
  assert.equal(moved.radius, undefined);
  // Shift constrains the move to the axes and diagonals.
  const level = translateController(line(), 10, 1, true);
  near(level.geometry.points[0].x, Math.hypot(10, 1), 1e-6);
  near(level.geometry.points[0].y, 0);
  // An image moves its rectangle; a synced controller has nothing of its own to move.
  const image = createController({ channel: "size", kind: "image", area: AREA });
  const shifted = translateController(image, 7, 8);
  near(shifted.image.placement.x, image.image.placement.x + 7);
  near(shifted.image.placement.y, image.image.placement.y + 8);
  assert.equal(translateController(line({ syncWith: "other" }), 1, 1), null);
});
