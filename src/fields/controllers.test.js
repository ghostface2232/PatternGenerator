import test from "node:test";
import assert from "node:assert/strict";
import {
  CHANNEL_INFO,
  MAX_POLYLINE_POINTS,
  channelBase,
  compileControllers,
  compiledHasChannel,
  createController,
  defaultGeometry,
  evaluateChannel,
  evaluateCompiled,
  falloffWeight,
  flattenCubic,
  newControllerId,
  polylineDistance,
  polylineSide,
  resolveSyncedGeometry,
} from "./controllers.js";
import { createImageMap } from "./image-map.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const AREA = { x: 0, y: 0, w: 200, h: 200 };

// A controller with everything but the fields the test cares about defaulted.
const ctrl = (patch = {}) => ({
  id: "c1",
  channel: "size",
  kind: "point",
  enabled: true,
  geometry: { points: [{ x: 0, y: 0 }] },
  target: 2,
  radius: 10,
  falloff: "smooth",
  oneSided: 0,
  strength: 1,
  syncWith: null,
  image: null,
  ...patch,
});

test("every falloff runs from 1 at the geometry to 0 at the rim", () => {
  for (const kind of ["smooth", "linear", "hard"]) {
    near(falloffWeight(kind, 0), 1);
    near(falloffWeight(kind, 1), 0);
    near(falloffWeight(kind, 2), 0); // past the rim, and clamped rather than negative
    near(falloffWeight(kind, -1), 1);
  }
  // hard is a step: full weight right up to the rim.
  near(falloffWeight("hard", 0.999), 1);
  near(falloffWeight("linear", 0.25), 0.75);
  // smooth is the same at the ends but eases; it never rises.
  let previous = Infinity;
  for (let i = 0; i <= 20; i++) {
    const w = falloffWeight("smooth", i / 20);
    assert.ok(w <= previous + 1e-12, `smooth falloff must not rise (${i / 20})`);
    previous = w;
  }
  near(falloffWeight("smooth", 0.5), 0.5);
});

test("distance to a point, a segment and a polyline", () => {
  near(polylineDistance([{ x: 3, y: 4 }], 0, 0), 5);
  const segment = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  near(polylineDistance(segment, 5, 3), 3); // perpendicular foot inside the segment
  near(polylineDistance(segment, -4, 3), 5); // past the end → distance to the endpoint
  near(polylineDistance(segment, 14, 0), 4);
  const bend = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  near(polylineDistance(bend, 13, 5), 3); // nearest on the second leg, not the first
  assert.equal(polylineDistance([], 0, 0), Infinity);
});

test("a cubic with collinear controls flattens onto its own chord", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  const flat = flattenCubic(points, 8);
  assert.equal(flat.length, 9);
  near(flat[0].x, 0);
  near(flat[8].x, 30);
  for (const p of flat) near(p.y, 0);
  // A real curve leaves the chord, and both endpoints are still interpolated.
  const arc = flattenCubic(
    [
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 0 },
    ],
    12
  );
  near(arc[0].x, 0);
  near(arc[12].x, 30);
  assert.ok(arc[6].y > 10, "the middle of the curve must bulge toward the control points");
});

test("polylineSide reads the side of the nearest segment, not of the chord", () => {
  const bend = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];
  assert.equal(polylineSide(bend, 5, 4), 1); // below the first leg (y down)
  assert.equal(polylineSide(bend, 5, -4), -1);
  assert.equal(polylineSide(bend, 14, 5), -1); // right of the second leg
  assert.equal(polylineSide([{ x: 0, y: 0 }], 1, 1), 0); // a point has no sides
});

test("a lone controller reaches its target at the geometry and the base at the rim", () => {
  const controllers = [ctrl({ target: 2, radius: 10 })];
  near(evaluateChannel(controllers, "size", 0, 0), 2);
  near(evaluateChannel(controllers, "size", 10, 0), 1); // exactly the rim → base
  near(evaluateChannel(controllers, "size", 40, 0), 1); // well outside
  near(evaluateChannel(controllers, "size", 5, 0), 1.5); // smoothstep is 0.5 at half reach
  // Another channel is untouched by a size controller.
  near(evaluateChannel(controllers, "angle", 0, 0), 0);
  // Strength scales the weight, not the target.
  near(evaluateChannel([ctrl({ strength: 0.5 })], "size", 0, 0), 1.5);
});

test("the base value is whatever the caller passes, which is how shape morphs", () => {
  // The shape channel blends against the document's own mix, not against a
  // constant — a controller pulls the holes near it away from the base shape.
  const controllers = [ctrl({ channel: "shape", target: 1, radius: 10 })];
  const compiled = compileControllers(controllers);
  near(evaluateCompiled(compiled, "shape", 0, 0, 0.2), 1);
  near(evaluateCompiled(compiled, "shape", 40, 0, 0.2), 0.2);
  near(evaluateCompiled(compiled, "shape", 5, 0, 0.2), 0.6);
  assert.equal(channelBase("size"), 1);
  assert.equal(channelBase("angle"), 0);
});

test("overlapping controllers blend by weight, and the order they are listed does not matter", () => {
  const a = ctrl({ id: "a", target: 2, radius: 10, falloff: "linear", geometry: { points: [{ x: 0, y: 0 }] } });
  const b = ctrl({ id: "b", target: 4, radius: 10, falloff: "linear", geometry: { points: [{ x: 10, y: 0 }] } });
  // Midway: both weigh 0.5, so the total is exactly 1 and the base drops out.
  near(evaluateChannel([a, b], "size", 5, 0), 3);
  near(evaluateChannel([b, a], "size", 5, 0), 3);
  // Off to one side: only `a` reaches, and the base keeps the rest of the share.
  near(evaluateChannel([a, b], "size", -5, 0), 1.5);
  near(evaluateChannel([b, a], "size", -5, 0), 1.5);
  // Saturated: both at full weight (W = 2) → the plain average of the targets,
  // and continuous with the W = 1 case above rather than jumping at the seam.
  const at = (ax, bx, x) =>
    evaluateChannel(
      [
        { ...a, geometry: { points: [{ x: ax, y: 0 }] } },
        { ...b, geometry: { points: [{ x: bx, y: 0 }] } },
      ],
      "size",
      x,
      0
    );
  near(at(0, 0, 0), 3);
  for (const gap of [0.4, 0.2, 0.1, 0.01]) {
    // As the two converge the answer approaches 3 from the W ≤ 1 side without a step.
    assert.ok(Math.abs(at(-gap * 5, gap * 5, 0) - 3) < 0.35, `discontinuity near W = 1 at gap ${gap}`);
  }
});

test("a one-sided controller only reaches the side it is aimed at", () => {
  const line = ctrl({
    kind: "line",
    target: 2,
    radius: 10,
    falloff: "hard",
    geometry: {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
    },
  });
  near(evaluateChannel([line], "size", 10, 5), 2);
  near(evaluateChannel([line], "size", 10, -5), 2);
  near(evaluateChannel([{ ...line, oneSided: 1 }], "size", 10, 5), 2);
  near(evaluateChannel([{ ...line, oneSided: 1 }], "size", 10, -5), 1);
  near(evaluateChannel([{ ...line, oneSided: -1 }], "size", 10, 5), 1);
  near(evaluateChannel([{ ...line, oneSided: -1 }], "size", 10, -5), 2);
  // A point has no sides, so the flag is ignored rather than silencing it.
  near(evaluateChannel([ctrl({ oneSided: 1, falloff: "hard" })], "size", 0, 5), 2);
});

test("disabled, zero-strength and empty controllers compile away", () => {
  assert.equal(compileControllers([ctrl({ enabled: false })]).length, 0);
  assert.equal(compileControllers([ctrl({ strength: 0 })]).length, 0);
  assert.equal(compileControllers([ctrl({ geometry: { points: [] } })]).length, 0);
  assert.equal(compileControllers([]).length, 1 - 1);
  assert.equal(compileControllers(null).length, 0);
  assert.equal(compiledHasChannel(compileControllers([ctrl()]), "size"), true);
  assert.equal(compiledHasChannel(compileControllers([ctrl()]), "angle"), false);
});

test("syncWith borrows another controller's geometry, and a cycle falls back", () => {
  const source = ctrl({ id: "src", channel: "size", geometry: { points: [{ x: 50, y: 50 }] } });
  const follower = ctrl({
    id: "follow",
    channel: "angle",
    target: 90,
    syncWith: "src",
    geometry: { points: [{ x: 0, y: 0 }] },
  });
  // The follower measures from the source's point, not from its own.
  near(evaluateChannel([source, follower], "angle", 50, 50), 90);
  near(evaluateChannel([source, follower], "angle", 0, 0), 0);
  // A missing target leaves it on its own geometry rather than compiling away.
  near(evaluateChannel([{ ...follower, syncWith: "ghost" }], "angle", 0, 0), 90);

  const byId = new Map([
    ["a", { id: "a", syncWith: "b", geometry: { points: [{ x: 1, y: 1 }] } }],
    ["b", { id: "b", syncWith: "a", geometry: { points: [{ x: 2, y: 2 }] } }],
  ]);
  // Two controllers pointing at each other resolve to one of them and stop.
  const resolved = resolveSyncedGeometry(byId.get("a"), byId);
  assert.equal(resolved.id, "b");
  assert.equal(resolveSyncedGeometry(byId.get("b"), byId).id, "a");
});

test("an image controller maps brightness to the channel inside its rectangle", () => {
  // A 2×1 map: black on the left, white on the right.
  const map = createImageMap(2, 1, Float32Array.from([0, 1]));
  const controller = ctrl({
    kind: "image",
    channel: "size",
    target: 3,
    image: {
      assetId: "img",
      invert: false,
      gamma: 1,
      min: 0,
      max: 1,
      placement: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    },
  });
  const ctx = { imageMaps: { img: map } };
  near(evaluateChannel([controller], "size", 0, 50, ctx), 1); // black → the base
  near(evaluateChannel([controller], "size", 100, 50, ctx), 3); // white → the target
  near(evaluateChannel([controller], "size", 50, 50, ctx), 2); // midtone → halfway
  near(evaluateChannel([controller], "size", 150, 50, ctx), 1); // outside the rectangle
  // Inverting swaps the ends without touching the geometry.
  const inverted = { ...controller, image: { ...controller.image, invert: true } };
  near(evaluateChannel([inverted], "size", 0, 50, ctx), 3);
  // No decoded map (a share link, or a decode still in flight) → inert, not black.
  assert.equal(compileControllers([controller], {}).length, 0);
  near(evaluateChannel([controller], "size", 0, 50, {}), 1);
});

test("new controllers land inside the area they are given, with usable defaults", () => {
  for (const kind of ["point", "line", "curve", "polyline"]) {
    const controller = createController({ channel: "size", kind, area: AREA });
    assert.equal(controller.kind, kind);
    assert.equal(controller.target, CHANNEL_INFO.size.defaultTarget);
    assert.ok(controller.radius > 0);
    for (const p of controller.geometry.points) {
      assert.ok(p.x >= AREA.x && p.x <= AREA.x + AREA.w, `${kind} point escapes the area`);
      assert.ok(p.y >= AREA.y && p.y <= AREA.y + AREA.h, `${kind} point escapes the area`);
    }
    // Every fresh controller does something: sampled at its own geometry it
    // must read the target, or the user drops one and sees nothing happen.
    const [first] = controller.geometry.points;
    near(evaluateChannel([controller], "size", first.x, first.y), CHANNEL_INFO.size.defaultTarget);
  }
  const image = createController({ channel: "size", kind: "image", area: AREA });
  assert.equal(image.geometry.points.length, 0);
  assert.ok(image.image.placement.w > 0 && image.image.placement.h > 0);
  assert.equal(defaultGeometry("polyline", AREA).points.length, 3);
  assert.ok(defaultGeometry("polyline", AREA).points.length <= MAX_POLYLINE_POINTS);
});

test("ids are unique against the controllers already there", () => {
  assert.equal(newControllerId([]), "ctrl-1");
  assert.equal(newControllerId([{ id: "ctrl-1" }]), "ctrl-2");
  assert.equal(newControllerId([{ id: "ctrl-2" }]), "ctrl-1");
  assert.equal(newControllerId([{ id: "ctrl-1" }, { id: "ctrl-2" }, { id: "ctrl-3" }]), "ctrl-4");
});
