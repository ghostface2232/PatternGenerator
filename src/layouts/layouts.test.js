import test from "node:test";
import assert from "node:assert/strict";
import { PATTERN_TYPES } from "../core/constants.js";
import { createDocument, patchIn } from "../core/document.js";
import { buildParams, compileSpacing, computePattern, deriveGeometry } from "../core/pipeline.js";
import { validateDocument } from "../core/persistence.js";
import { generateSVGString } from "../export/svg.js";
import { LAYOUTS, generateHoles, layoutReadsSpacing, tilingFlags } from "./index.js";
import { MIN_CROSS_SIN } from "./crosshatch.js";
import { MAX_SCATTER_HOLES } from "./scatter.js";
import { compileControllers } from "../fields/controllers.js";

const doc = (patch = {}) => patchIn(createDocument(), patch);
const place = d => generateHoles(buildParams(d, deriveGeometry(d)), compileSpacing(d.fields));
const positions = d => JSON.stringify(place(d));
// A spacing controller at the middle of the default 200×200 sheet.
const spacingController = (patch = {}) => ({
  id: "s1",
  channel: "spacing",
  kind: "point",
  enabled: true,
  geometry: { points: [{ x: 100, y: 100 }] },
  target: 2,
  radius: 70,
  falloff: "smooth",
  oneSided: 0,
  strength: 1,
  syncWith: null,
  image: null,
  ...patch,
});
const withSpacing = (patch, controller = {}) =>
  doc({ ...patch, "fields.enabled": true, "fields.controllers": [spacingController(controller)] });

test("the registry and the document's vocabulary describe the same nine modes", () => {
  // The document may hold any name from PATTERN_TYPES and the registry decides
  // what each one means, so a mode in one and not the other is either a type the
  // dropdown offers and nothing can generate, or a generator nothing can reach.
  assert.deepEqual(Object.keys(LAYOUTS), PATTERN_TYPES);
  assert.equal(PATTERN_TYPES.length, 9);
  for (const type of PATTERN_TYPES) {
    assert.ok(["grid", "radial", "crosshatch", "free"].includes(LAYOUTS[type].family), type);
  }
  // And validation accepts every one of them rather than falling back.
  for (const type of PATTERN_TYPES) {
    assert.equal(validateDocument(doc({ "layout.type": type })).layout.type, type);
  }
});

test("every mode fills the sheet, stays inside the boundary and exports", () => {
  for (const type of PATTERN_TYPES) {
    const d = doc({ "layout.type": type });
    const { activeHoles, stats, params } = computePattern(d);
    assert.ok(activeHoles.length > 100, `${type}: only ${activeHoles.length} holes`);
    assert.ok(stats.displayOAR > 5 && stats.displayOAR < 100, `${type}: OAR ${stats.displayOAR}`);
    assert.ok(
      activeHoles.every(h => Number.isFinite(h.x) && Number.isFinite(h.y)),
      type
    );
    // Centres may overhang the perforation bounds by up to one hole radius; the
    // free-form modes do not overhang at all, but this is the bound every mode
    // has to respect or the export runs off the sheet.
    const pad = Math.max(params.holeW, params.holeH) / 2 + 1e-9;
    assert.ok(
      activeHoles.every(h => h.x >= -pad && h.x <= 200 + pad && h.y >= -pad && h.y <= 200 + pad),
      `${type}: a hole escaped the sheet`
    );
    assert.equal(generateSVGString(activeHoles, params).match(/<circle /g).length, activeHoles.length, type);
  }
});

test("every mode is a pure function of the document", () => {
  // Scatter is the one that draws random numbers, and it is exactly why the seed
  // is in the document: a share link, a reload and an export have to place the
  // same holes or `removedHoles` addresses a list that no longer exists.
  for (const type of PATTERN_TYPES) {
    const d = doc({ "layout.type": type });
    assert.equal(positions(d), positions(d), type);
    assert.equal(positions(d), positions(doc({ "layout.type": type })), `${type}: not reproducible from the document`);
  }
});

test("the scatter seed picks the pattern, and every seed keeps the minimum spacing", () => {
  const at = seed => computePattern(doc({ "layout.type": "Scatter", "layout.scatter.seed": seed }));
  const first = at(1);
  const second = at(2);
  assert.notEqual(JSON.stringify(first.baseHoles), JSON.stringify(second.baseHoles));
  // Different arrangement, same density: a seed is not a parameter.
  assert.ok(Math.abs(first.activeHoles.length - second.activeHoles.length) < first.activeHoles.length * 0.15);

  // The guarantee: with no spacing field every radius is the same, so no two
  // centres are closer than the hole diameter plus the edge gap — which is the
  // configured 3 mm ligament, and what the counted statistic must agree with.
  for (const seed of [0, 1, 7, 99999]) {
    const { activeHoles, stats, geometry } = at(seed);
    assert.ok(stats.minLigament >= 3 - 1e-9, `seed ${seed}: ligament ${stats.minLigament}`);
    let closest = Infinity;
    for (let i = 0; i < activeHoles.length; i++) {
      for (let j = i + 1; j < activeHoles.length; j++) {
        closest = Math.min(closest, Math.hypot(activeHoles[i].x - activeHoles[j].x, activeHoles[i].y - activeHoles[j].y)); // prettier-ignore
      }
    }
    assert.ok(closest >= geometry.freeSpacingX - 1e-9, `seed ${seed}: two centres ${closest} apart`);
  }
});

test("a scatter under a spacing field keeps min(rᵢ, rⱼ) between every pair", () => {
  // The weaker of the two possible guarantees, and the deliberate one: under
  // max() a sparse hole would cast a shadow no dense hole could enter and the
  // boundary between two densities would open into a seam.
  for (const target of [0.4, 2.5]) {
    const d = withSpacing({ "layout.type": "Scatter" }, { target });
    const { activeHoles, geometry } = computePattern(d);
    const field = compileSpacing(d.fields);
    const radius = h => geometry.freeSpacingX * field.sample(h.x, h.y);
    for (let i = 0; i < activeHoles.length; i++) {
      for (let j = i + 1; j < activeHoles.length; j++) {
        const a = activeHoles[i],
          b = activeHoles[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        const floor = Math.min(radius(a), radius(b));
        assert.ok(gap >= floor - 1e-9, `target ${target}: ${gap} apart where ${floor} was asked for`);
      }
    }
  }
});

test("a scatter fills the sparse side of a density gradient too", () => {
  // A candidate is thrown into the annulus of the point it grows from, so where
  // the field asks for a larger radius further out that annulus lands inside the
  // candidate's own exclusion disc and every dart is rejected. Without the
  // outward probe in the sampler the fill stalls at the foot of the gradient and
  // the sparse corner of the sheet stays empty.
  const spread = withSpacing({ "layout.type": "Scatter" }, { target: 0.3, radius: 60 });
  const { activeHoles } = computePattern(spread);
  const corner = activeHoles.filter(h => h.x > 160 && h.y > 160);
  const middle = activeHoles.filter(h => Math.hypot(h.x - 100, h.y - 100) < 40);
  assert.ok(corner.length > 5, `the sparse corner has only ${corner.length} holes`);
  assert.ok(middle.length > corner.length, "the dense middle should hold more holes than the sparse corner");
});

test("cross-hatch at right angles is the straight grid, and needs two directions", () => {
  // Family A's lines run at angleA and are spaced pitchX apart perpendicular to
  // themselves, so 90° / 0° is columns at pitchX and rows at pitchY — the
  // Straight grid, hole for hole.
  const straight = doc({ "layout.type": "Straight" });
  const cross = doc({
    "layout.type": "Cross-hatch",
    "layout.crosshatch.angleA": 90,
    "layout.crosshatch.angleB": 0,
    "layout.edgeGapX": 4,
    "layout.edgeGapY": 2,
  });
  const sorted = holes =>
    holes
      .map(h => `${h.x.toFixed(6)},${h.y.toFixed(6)}`)
      .sort()
      .join(" ");
  assert.equal(
    sorted(place(cross)),
    sorted(place(patchIn(straight, { "layout.edgeGapX": 4, "layout.edgeGapY": 2 }))),
    "a right-angled cross-hatch must reproduce the straight grid exactly"
  );

  // Two families near enough to parallel have no usable lattice: the cell is a
  // sliver, and the count runs away long before the pattern becomes interesting.
  // Rather than a slider drag that hangs, the mode empties and the panel says why.
  const apart = degrees =>
    place(doc({ "layout.type": "Cross-hatch", "layout.crosshatch.angleA": 20, "layout.crosshatch.angleB": 20 + degrees })); // prettier-ignore
  assert.equal(apart(0).length, 0);
  assert.equal(apart(1).length, 0);
  assert.ok(apart(10).length > 100);
  assert.ok(Math.sin((2 * Math.PI) / 180) >= MIN_CROSS_SIN);
});

test("closing the gap adds holes in every mode", () => {
  // Monotonic density is what makes the gap slider mean anything, and it is not
  // free: a mode that clipped, capped or rounded its way out of the extra holes
  // would still look plausible on screen.
  for (const type of PATTERN_TYPES) {
    // Radial carries its own pair of gaps; every other mode reads the edge gaps.
    const gaps =
      type === "Radial"
        ? gap => ({ "layout.radial.edgeGap": gap, "layout.radial.circumGap": gap })
        : gap => ({ "layout.edgeGapX": gap, "layout.edgeGapY": gap });
    const count = gap => computePattern(doc({ "layout.type": type, ...gaps(gap) })).activeHoles.length;
    const wide = count(8);
    const tight = count(1);
    assert.ok(tight > wide, `${type}: ${tight} holes at gap 1 but ${wide} at gap 8`);
  }
});

test("the boundary corner radius clips every mode", () => {
  for (const type of PATTERN_TYPES) {
    const square = computePattern(doc({ "layout.type": type })).activeHoles.length;
    const rounded = computePattern(doc({ "layout.type": type, "boundary.cornerRadius": 100 })).activeHoles.length;
    assert.ok(rounded < square, `${type}: a full-radius boundary must drop the corners`);
    // Radius 100 on a 200×200 sheet is a circle, so what is left is inside it.
    const holes = computePattern(doc({ "layout.type": type, "boundary.cornerRadius": 100 })).activeHoles;
    assert.ok(
      holes.every(h => Math.hypot(h.x - 100, h.y - 100) <= 100 + 1e-6),
      `${type}: a hole survived outside the circle`
    );
  }
});

// ─── The spacing channel ──────────────────────────────────────────────

test("which modes read the spacing channel, and which say so", () => {
  for (const type of PATTERN_TYPES) {
    assert.equal(layoutReadsSpacing("Circle", type), type !== "Radial", type);
  }
  // The three uniform-ligament tilings opt out whatever the mode: each is an
  // exact interlocking lattice whose whole point is a constant ligament.
  assert.equal(layoutReadsSpacing("Hexagon", "Staggered 60°"), false);
  assert.equal(layoutReadsSpacing("Diamond", "Staggered 60°"), false);
  assert.equal(layoutReadsSpacing("Triangle", "Straight"), false);
  // …but a hexagon that is not on the honeycomb, or a triangle scattered at
  // random, is tiling nothing and reads the channel like any other hole.
  assert.equal(layoutReadsSpacing("Hexagon", "Straight"), true);
  assert.equal(layoutReadsSpacing("Triangle", "Scatter"), true);
  assert.equal(tilingFlags("Triangle", "Scatter").isTriTiling, false);
  assert.equal(tilingFlags("Triangle", "Custom Angle").isTriTiling, true);
});

test("a spacing controller thins and crowds the modes that read it", () => {
  for (const type of PATTERN_TYPES) {
    const base = computePattern(doc({ "layout.type": type })).activeHoles.length;
    const spread = computePattern(withSpacing({ "layout.type": type }, { target: 2.5 })).activeHoles.length;
    const packed = computePattern(withSpacing({ "layout.type": type }, { target: 0.5 })).activeHoles.length;
    if (LAYOUTS[type].spacing) {
      assert.ok(spread < base, `${type}: ${spread} holes at 2.5× against ${base}`);
      assert.ok(packed > base, `${type}: ${packed} holes at 0.5× against ${base}`);
    } else {
      assert.equal(spread, base, `${type} does not read the spacing channel`);
      assert.equal(packed, base, `${type} does not read the spacing channel`);
    }
  }
});

test("the tilings and Radial ignore a spacing controller entirely", () => {
  for (const patch of [
    { "hole.shape": "Hexagon" },
    { "hole.shape": "Diamond" },
    { "hole.shape": "Triangle", "layout.type": "Straight" },
    { "layout.type": "Radial" },
    { "layout.type": "Radial", "layout.radial.layout": "Sunflower" },
  ]) {
    assert.equal(
      positions(withSpacing(patch, { target: 0.4 })),
      positions(doc(patch)),
      `${JSON.stringify(patch)} must place the same holes with or without a spacing controller`
    );
  }
});

test("a neutral or disabled spacing controller changes nothing at all", () => {
  const flat = doc({ "layout.type": "Straight" });
  for (const controller of [{ target: 1 }, { target: 2, enabled: false }, { target: 2, strength: 0 }]) {
    assert.equal(
      positions(withSpacing({ "layout.type": "Straight" }, controller)),
      positions(flat),
      JSON.stringify(controller)
    );
  }
  // …and neither does one on another channel.
  assert.equal(positions(withSpacing({ "layout.type": "Straight" }, { channel: "size", target: 2 })), positions(flat));
});

test("an image may not drive spacing", () => {
  // A brightness map is decoded asynchronously and left out of share links, so a
  // spacing controller reading one would make hole positions depend on state the
  // document does not carry — and removed-hole indices would drift under a
  // decode that no edit and no undo step accounts for.
  const image = {
    kind: "image",
    channel: "spacing",
    geometry: { points: [] },
    image: { assetId: "asset-1", invert: false, gamma: 1, min: 0, max: 1, placement: { x: 0, y: 0, w: 200, h: 200, rotation: 0 } }, // prettier-ignore
  };
  const d = withSpacing({ "layout.type": "Straight" }, image);
  assert.equal(compileSpacing(d.fields), null);
  assert.equal(positions(d), positions(doc({ "layout.type": "Straight" })));
  // Dropped at compile time, so not even a decoded picture brings it back — and
  // the same controller on the size channel compiles as usual, which is what
  // makes this a rule about spacing rather than about images.
  const maps = { "asset-1": { width: 2, height: 1, data: Float32Array.from([0, 1]) } };
  assert.deepEqual(compileControllers(d.fields.controllers, { imageMaps: maps }), []);
  assert.equal(compileControllers([{ ...image, channel: "size", target: 2 }], { imageMaps: maps }).length, 1);
});

test("the spacing field bounds it reports really do bound it", () => {
  // The scatter sampler sizes its search grid from `min`, and the layouts lean on
  // the clamp, so a value outside the reported range would not be a cosmetic
  // slip: it would be a neighbour search that misses.
  for (const target of [0.2, 0.5, 1.6, 4]) {
    const field = compileSpacing(withSpacing({}, { target }).fields);
    for (let x = -20; x <= 220; x += 7) {
      for (let y = -20; y <= 220; y += 7) {
        const value = field.sample(x, y);
        assert.ok(value >= field.min - 1e-12 && value <= field.max + 1e-12, `${target}: ${value} at ${x},${y}`);
        assert.ok(value > 0);
      }
    }
  }
});

test("a scatter stops at its cap instead of running away", () => {
  const dense = doc({
    "layout.type": "Scatter",
    "hole.diameter": 0.5,
    "layout.edgeGapX": 0,
    "layout.edgeGapY": 0,
    "sheet.w": 1000,
    "sheet.h": 1000,
  });
  const holes = place(dense);
  assert.equal(holes.length, MAX_SCATTER_HOLES);
});
