import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VARIATION,
  DEFAULT_VARIATION_LAYER,
  evaluateVariationField,
  evaluateVariationLayer,
  randomizeVariationLayer,
  variationScaleAt,
} from "./variation-engine.js";

const variationWith = layer => ({
  ...DEFAULT_VARIATION,
  enabled: true,
  minScale: 0.2,
  maxScale: 1.4,
  layers: [{ ...DEFAULT_VARIATION_LAYER, ...layer }],
});

test("disabled variation preserves the base size", () => {
  assert.equal(variationScaleAt(0.2, 0.8, DEFAULT_VARIATION, 1), 1);
});

test("linear ramp is monotonic along its direction", () => {
  const config = variationWith({ space: "Linear", profile: "Ramp", angle: 0, exponent: 1 });
  const left = evaluateVariationField(0, 0.5, config, 1);
  const middle = evaluateVariationField(0.5, 0.5, config, 2);
  const right = evaluateVariationField(1, 0.5, config, 3);
  assert.ok(left < middle && middle < right);
});

test("reach length stretches a linear gradient", () => {
  const tight = variationWith({ space: "Linear", profile: "Ramp", angle: 0, exponent: 1, radius: 0.5 });
  const wide = variationWith({ space: "Linear", profile: "Ramp", angle: 0, exponent: 1, radius: 1.6 });
  // Off-center sample: a larger reach length keeps values closer to the 0.5 midpoint.
  const tightValue = evaluateVariationField(0.75, 0.5, tight, 1);
  const wideValue = evaluateVariationField(0.75, 0.5, wide, 2);
  assert.ok(Math.abs(tightValue - 0.5) > Math.abs(wideValue - 0.5));
});

test("default reach length preserves the original linear field", () => {
  const config = variationWith({ space: "Linear", profile: "Ramp", angle: 0, exponent: 1, radius: 1 });
  // radius=1 is the neutral default; the panel edges still map to the full 0..1 range.
  assert.ok(Math.abs(evaluateVariationField(0, 0.5, config, 1) - 0) < 1e-9);
  assert.ok(Math.abs(evaluateVariationField(1, 0.5, config, 2) - 1) < 1e-9);
});

test("inverted radial ramp creates a center bloom", () => {
  const config = variationWith({ space: "Radial", profile: "Ramp", radius: 1, invert: true, exponent: 1.5 });
  assert.ok(evaluateVariationField(0.5, 0.5, config, 1) > evaluateVariationField(1, 0.5, config, 2));
});

test("wave profile repeats across the field", () => {
  const layer = { ...DEFAULT_VARIATION_LAYER, profile: "Wave", frequency: 2, phase: 0, exponent: 1 };
  assert.ok(Math.abs(evaluateVariationLayer(0, 0.5, layer) - evaluateVariationLayer(0.5, 0.5, layer)) < 1e-9);
});

test("noise remains deterministic for a seed", () => {
  const layer = { ...DEFAULT_VARIATION_LAYER, profile: "Noise", seed: 90210, detail: 4, frequency: 3.4 };
  assert.equal(evaluateVariationLayer(0.234, 0.678, layer), evaluateVariationLayer(0.234, 0.678, layer));
});

test("quantize constrains the output to the requested levels", () => {
  const config = { ...variationWith({ profile: "Noise", seed: 55 }), quantize: 4 };
  for (let i = 0; i < 25; i++) {
    const value = evaluateVariationField(i / 24, 0.37, config, i);
    assert.ok([0, 1 / 3, 2 / 3, 1].some(level => Math.abs(level - value) < 1e-9));
  }
});

test("zero opacity is neutral for the first field layer", () => {
  const config = variationWith({ profile: "Ramp", angle: 0, opacity: 0 });
  assert.equal(evaluateVariationField(0, 0.5, config, 1), 1);
});

test("locked layers are stable under randomization", () => {
  const layer = { ...DEFAULT_VARIATION_LAYER, locked: true };
  assert.equal(randomizeVariationLayer(layer), layer);
});
