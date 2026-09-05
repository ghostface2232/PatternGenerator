import test from "node:test";
import assert from "node:assert/strict";
import {
  createImageMap,
  imageWeightAt,
  luminance,
  placementCorners,
  placementUV,
  sampleImageMap,
  transferBrightness,
} from "./image-map.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("a map needs whole, positive dimensions and enough data to fill them", () => {
  assert.ok(createImageMap(2, 2, new Float32Array(4)));
  assert.equal(createImageMap(2, 2, new Float32Array(3)), null);
  assert.equal(createImageMap(0, 2, new Float32Array(4)), null);
  assert.equal(createImageMap(2.5, 2, new Float32Array(8)), null);
  assert.equal(createImageMap(2, 2, null), null);
});

test("sampling is bilinear and clamps at the edges", () => {
  // 2×2: 0 1
  //      1 0
  const map = createImageMap(2, 2, Float32Array.from([0, 1, 1, 0]));
  near(sampleImageMap(map, 0, 0), 0);
  near(sampleImageMap(map, 1, 0), 1);
  near(sampleImageMap(map, 0, 1), 1);
  near(sampleImageMap(map, 1, 1), 0);
  near(sampleImageMap(map, 0.5, 0.5), 0.5);
  near(sampleImageMap(map, 0.5, 0), 0.5);
  // Outside 0..1 the edge pixel repeats rather than wrapping or reading garbage.
  near(sampleImageMap(map, -3, 0), 0);
  near(sampleImageMap(map, 4, 0), 1);
  // A single-pixel map has no gradient to interpolate along. (Float32 rounding,
  // hence the looser tolerance — the map is Float32Array by design, since a
  // 192² Float64Array per controller is 300 KB for no visible gain.)
  near(sampleImageMap(createImageMap(1, 1, Float32Array.from([0.4])), 0.7, 0.2), 0.4, 1e-7);
});

test("the placement rectangle maps sheet millimetres onto 0..1, and rejects the outside", () => {
  const placement = { x: 10, y: 20, w: 40, h: 80, rotation: 0 };
  assert.deepEqual(placementUV(placement, 10, 20), { u: 0, v: 0 });
  assert.deepEqual(placementUV(placement, 50, 100), { u: 1, v: 1 });
  assert.deepEqual(placementUV(placement, 30, 60), { u: 0.5, v: 0.5 });
  assert.equal(placementUV(placement, 9.9, 60), null);
  assert.equal(placementUV(placement, 30, 101), null);
  assert.equal(placementUV({ ...placement, w: 0 }, 30, 60), null);
  assert.equal(placementUV(null, 0, 0), null);

  // Rotation turns the frame, not the sample point: a quarter turn about the
  // centre sends the u axis down the sheet.
  const turned = { x: 0, y: 0, w: 100, h: 100, rotation: 90 };
  const uv = placementUV(turned, 50, 100);
  near(uv.u, 1);
  near(uv.v, 0.5);
  assert.equal(placementUV(turned, 50, 50).u, 0.5);
});

test("the transfer curve inverts, gammas and remaps in that order", () => {
  near(transferBrightness(0.25), 0.25);
  near(transferBrightness(0.25, { invert: true }), 0.75);
  near(transferBrightness(0.25, { gamma: 2 }), 0.0625);
  near(transferBrightness(0.25, { invert: true, gamma: 2 }), 0.5625);
  near(transferBrightness(0.5, { min: 0.2, max: 0.6 }), 0.4);
  // A reversed range is honoured rather than clamped away: it is another way to
  // spell invert, and remapping is the last step.
  near(transferBrightness(0, { min: 1, max: 0 }), 1);
  near(transferBrightness(1, { min: 1, max: 0 }), 0);
  // Junk falls back instead of producing NaN, which would poison every blend.
  near(transferBrightness(0.5, { gamma: 0 }), 0.5);
  near(transferBrightness(0.5, { gamma: NaN }), 0.5);
  near(transferBrightness(NaN), 0);
  near(transferBrightness(5), 1);
});

test("the whole chain, and the null that means outside", () => {
  const map = createImageMap(2, 1, Float32Array.from([0, 1]));
  const placement = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };
  near(imageWeightAt(map, placement, {}, 0, 50), 0);
  near(imageWeightAt(map, placement, {}, 100, 50), 1);
  near(imageWeightAt(map, placement, { invert: true }, 0, 50), 1);
  assert.equal(imageWeightAt(map, placement, {}, -1, 50), null);
});

test("luminance uses the sRGB weights", () => {
  near(luminance(255, 255, 255), 1);
  near(luminance(0, 0, 0), 0);
  near(luminance(255, 0, 0), 0.2126);
  near(luminance(0, 255, 0), 0.7152);
  near(luminance(0, 0, 255), 0.0722);
});

test("placement corners follow the rotation, in draw order", () => {
  const corners = placementCorners({ x: 0, y: 0, w: 10, h: 20, rotation: 0 });
  assert.deepEqual(
    corners.map(c => [c.x, c.y]),
    [
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
    ]
  );
  const turned = placementCorners({ x: 0, y: 0, w: 10, h: 20, rotation: 90 });
  // Still a 10×20 rectangle about the same centre, just lying the other way.
  near(Math.hypot(turned[1].x - turned[0].x, turned[1].y - turned[0].y), 10);
  near(Math.hypot(turned[2].x - turned[1].x, turned[2].y - turned[1].y), 20);
  near(turned.reduce((s, c) => s + c.x, 0) / 4, 5);
  near(turned.reduce((s, c) => s + c.y, 0) / 4, 10);
  assert.deepEqual(placementCorners(null), []);
});
