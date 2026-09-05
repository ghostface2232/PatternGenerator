import test from "node:test";
import assert from "node:assert/strict";
import { PATTERN_TYPES } from "../core/constants.js";
import { createDocument, patchIn } from "../core/document.js";
import { buildParams, compilePlacement, compileSpacing, computePattern, deriveGeometry } from "../core/pipeline.js";
import { validateDocument } from "../core/persistence.js";
import { generateSVGString } from "../export/svg.js";
import { LAYOUTS, generateHoles, layoutReadsSpacing, tilingFlags } from "./index.js";
import { MIN_CROSS_SIN } from "./crosshatch.js";
import { MAX_SCATTER_HOLES } from "./scatter.js";
import { generateSpiralHoles } from "./spiral.js";
import { generateFibonacciHoles } from "./fibonacci.js";
import { holeVertices } from "../geometry/shapes.js";
import { compileControllers } from "../fields/controllers.js";
import { DOC_LIMITS, MAX_PATHS, MAX_PATH_POINTS } from "../core/constants.js";
import { patternSignature } from "../core/pipeline.js";
import { addPathVertex, hitTestPath, movePathVertex, newPath, removePathVertex } from "./path-gizmo.js";

const doc = (patch = {}) => patchIn(createDocument(), patch);
const place = d => generateHoles(buildParams(d, deriveGeometry(d)), compilePlacement(d));
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

test("the registry and the document's vocabulary describe the same eleven modes", () => {
  // The document may hold any name from PATTERN_TYPES and the registry decides
  // what each one means, so a mode in one and not the other is either a type the
  // dropdown offers and nothing can generate, or a generator nothing can reach.
  assert.deepEqual(Object.keys(LAYOUTS), PATTERN_TYPES);
  assert.equal(PATTERN_TYPES.length, 11);
  for (const type of PATTERN_TYPES) {
    assert.ok(["grid", "radial", "crosshatch", "free", "path", "voronoi"].includes(LAYOUTS[type].family), type);
    assert.ok(["grid", "radial", "free"].includes(LAYOUTS[type].spacingModel), type);
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
    // Path strings its holes along one curve rather than filling an area, so it
    // is the one mode whose default document is counted in dozens.
    const floor = type === "Path" ? 20 : 100;
    assert.ok(activeHoles.length > floor, `${type}: only ${activeHoles.length} holes`);
    // One curve's worth of holes covers a couple of percent of the sheet, where
    // an area fill covers tens.
    assert.ok(stats.displayOAR > (type === "Path" ? 1 : 5), `${type}: OAR ${stats.displayOAR}`);
    assert.ok(stats.displayOAR < 100, `${type}: OAR ${stats.displayOAR}`);
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
    // Circles unless the mode imposes its own outline, in which case every
    // hole is a path of its own.
    const element = type === "Voronoi" ? /<path /g : /<circle /g;
    assert.equal(generateSVGString(activeHoles, params).match(element).length, activeHoles.length, type);
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
  // Radius 100 on a 200×200 sheet is a circle: nothing may survive outside it,
  // and every mode that fills the area must lose the corners it used to fill.
  // Path is the exception on the second half only — its default curve keeps well
  // inside the circle, so there is nothing there to clip — which is why the
  // containment check runs over a path that deliberately reaches the corners.
  for (const type of PATTERN_TYPES) {
    const square = computePattern(doc({ "layout.type": type })).activeHoles.length;
    const rounded = computePattern(doc({ "layout.type": type, "boundary.cornerRadius": 100 }));
    if (type !== "Path") {
      assert.ok(rounded.activeHoles.length < square, `${type}: a full-radius boundary must drop the corners`);
    }
    // Voronoi is the mode whose holes are not points: a cell is clipped to the
    // boundary as a polygon, so its SITE may well sit outside the circle while
    // every corner of the hole it draws is inside. Checking the centre would
    // pass a mode that had drawn half a cell past the edge and fail this one for
    // drawing nothing wrong at all, so the check follows the outline.
    const outside =
      type === "Voronoi"
        ? h => holeVertices(h, "Polygon").some(([x, y]) => Math.hypot(x - 100, y - 100) > 100 + 1e-6)
        : h => Math.hypot(h.x - 100, h.y - 100) > 100 + 1e-6;
    assert.ok(!rounded.activeHoles.some(outside), `${type}: a hole survived outside the circle`);
  }
  const corners = {
    "layout.type": "Path",
    "layout.path.paths": [{ points: [{ x: 2, y: 2 }, { x: 198, y: 198 }], closed: false }], // prettier-ignore
    "layout.path.smooth": false,
  };
  assert.ok(computePattern(doc({ ...corners, "boundary.cornerRadius": 100 })).activeHoles.length < computePattern(doc(corners)).activeHoles.length); // prettier-ignore
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

test("a free-form mode refuses a pattern it cannot draw rather than drawing part of one", () => {
  // All three fill outward from the middle, so stopping at a cap leaves a disc
  // of holes in a blank sheet — a pattern that reads as broken rather than as a
  // limit. The panel says why when a mode places nothing.
  const dense = extra =>
    doc({ "hole.diameter": 0.5, "layout.edgeGapX": 0, "layout.edgeGapY": 0, "sheet.w": 1000, "sheet.h": 1000, ...extra }); // prettier-ignore
  for (const type of ["Scatter", "Spiral", "Fibonacci"]) {
    assert.equal(place(dense({ "layout.type": type })).length, 0, type);
    // And what it does draw, it draws over the whole sheet: an island would
    // satisfy a count assertion but not this one.
    const ok = computePattern(doc({ "layout.type": type, "sheet.w": 400, "sheet.h": 400 })).activeHoles;
    assert.ok(ok.length > 500, `${type}: ${ok.length} holes`);
    const span = axis => Math.max(...ok.map(h => h[axis])) - Math.min(...ok.map(h => h[axis]));
    assert.ok(span("x") > 380 && span("y") > 380, `${type}: covers only ${span("x")}×${span("y")} of 400×400`);
  }
  // The cap is generous enough for a square metre at a 2.2 mm centre distance,
  // which is well past any panel a person would scatter by hand.
  assert.ok(MAX_SCATTER_HOLES >= 250_000);
});

test("cross-hatch under a spacing field fills the sheet or refuses it", () => {
  // Its two guards used to be measured against the BASE pitches, so a 0.2× field
  // under-counted the lines by twenty-five and both the line lists and the hole
  // loop were cut short — in line-A order, which put every hole it did draw in
  // one strip of an otherwise blank sheet.
  const fine = withSpacing(
    { "layout.type": "Cross-hatch", "hole.diameter": 0.5, "layout.edgeGapX": 0, "layout.edgeGapY": 0, "sheet.w": 1000, "sheet.h": 1000 }, // prettier-ignore
    { target: 0.2, radius: 2000, falloff: "hard" }
  );
  assert.equal(place(fine).length, 0);

  const drawn = computePattern(withSpacing({ "layout.type": "Cross-hatch", "sheet.w": 400, "sheet.h": 400 }, { target: 0.4, radius: 2000, falloff: "hard" })).activeHoles; // prettier-ignore
  assert.ok(drawn.length > 1000);
  const span = axis => Math.max(...drawn.map(h => h[axis])) - Math.min(...drawn.map(h => h[axis]));
  assert.ok(span("x") > 390 && span("y") > 390, `covers only ${span("x")}×${span("y")} of 400×400`);
});

test("a diamond lattice fills a large sheet of small holes", () => {
  // The rhombus lattice goes through a generic basis walk with a guard on the
  // point count. Set below what DOC_LIMITS allows, that guard turned a 1000 mm
  // panel of 0.5 mm diamonds into a blank canvas with no explanation.
  const big = doc({
    "hole.shape": "Diamond",
    "layout.type": "Staggered 60°",
    "hole.w": 0.5,
    "hole.h": 0.5,
    "layout.edgeGapX": 0,
    "layout.edgeGapY": 0,
    "sheet.w": 1000,
    "sheet.h": 1000,
  });
  assert.ok(place(big).length > 7_000_000);
});

// ─── What the earlier tests did not pin ───────────────────────────────
// Each of these was written against a mutation of the implementation that the
// rest of the suite accepted. A test that passes on the broken version is not a
// test of the thing its name claims.

test("the spacing channel is a field, not one number applied everywhere", () => {
  // Replacing the per-position read with a single sample at the middle of the
  // sheet passed every count assertion in this file: a uniform multiplier
  // thins and crowds exactly the way a field does, in total.
  // Measured as the RATIO between two bands of the sheet, before and after: a
  // uniform multiplier scales both bands alike and leaves the ratio where it
  // was, while a field that reads the controller only near the middle cannot.
  const band = (holes, lo, hi) => holes.filter(h => h.y >= lo && h.y < hi).length;
  const contrast = d => {
    const holes = computePattern(d).activeHoles;
    return band(holes, 75, 125) / Math.max(1, band(holes, 0, 50));
  };
  for (const type of ["Straight", "Staggered 60°", "Cross-hatch", "Spiral", "Fibonacci"]) {
    const flat = contrast(doc({ "layout.type": type }));
    const fielded = contrast(withSpacing({ "layout.type": type }, { target: 0.35, radius: 60 }));
    assert.ok(fielded > flat * 1.2, `${type}: middle-to-edge density ${flat.toFixed(2)} → ${fielded.toFixed(2)}`);
  }
});

test("a grid row and a cross-hatch line read the whole of themselves", () => {
  // Reading one point per row or line makes the mode blind everywhere else: the
  // grid's centre column, and — at the default 45°/−45° — cross-hatch's two
  // diagonals. A controller anywhere on the sheet has to move something.
  for (const type of ["Straight", "Cross-hatch"]) {
    const base = computePattern(doc({ "layout.type": type })).activeHoles.length;
    for (const [x, y] of [
      [30, 100],
      [170, 100],
      [100, 30],
      [100, 170],
    ]) {
      const off = withSpacing({ "layout.type": type }, { target: 2.5, radius: 55, geometry: { points: [{ x, y }] } });
      assert.notEqual(
        computePattern(off).activeHoles.length,
        base,
        `${type}: a controller at ${x},${y} changed nothing`
      );
    }
  }
});

test("a scatter's floor is min(rᵢ, rⱼ), not max", () => {
  // The guarantee test asserts `>= min`, which `max` also satisfies — so it
  // cannot tell the two apart, and `max` is the choice that opens a seam along
  // every density boundary. Under `min` some pair must be closer than the
  // sparser of its two radii; under `max` none can be.
  const d = withSpacing({ "layout.type": "Scatter" }, { target: 2.5, radius: 55 });
  const { activeHoles, geometry } = computePattern(d);
  const field = compileSpacing(d.fields);
  const radius = h => geometry.freeSpacingX * field.sample(h.x, h.y);
  let below = 0;
  for (let i = 0; i < activeHoles.length; i++) {
    for (let j = i + 1; j < activeHoles.length; j++) {
      const a = activeHoles[i],
        b = activeHoles[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < Math.max(radius(a), radius(b))) below++;
    }
  }
  assert.ok(below > 0, "no pair sits inside the larger of its two radii, so this is the max() rule");
});

test("a spacing controller resolves the geometry it borrows", () => {
  // `syncWith` may point across channels, so compileSpacing compiles the whole
  // controller list and filters afterwards. Filtering first — which passed the
  // entire suite — silently falls back to the follower's own geometry.
  const source = spacingController({ id: "src", channel: "size", geometry: { points: [{ x: 30, y: 30 }] } });
  const follower = spacingController({ id: "spc", syncWith: "src", target: 2.5 });
  const synced = doc({ "layout.type": "Straight", "fields.enabled": true, "fields.controllers": [source, follower] });
  // Through the signature, which is the compiled entries the layouts will read.
  assert.deepEqual(JSON.parse(compileSpacing(synced.fields).signature)[0].points, [{ x: 30, y: 30 }]);

  // And moving the SOURCE moves holes, so the signature has to see it.
  const moved = doc({
    "layout.type": "Straight",
    "fields.enabled": true,
    "fields.controllers": [{ ...source, geometry: { points: [{ x: 170, y: 170 }] } }, follower],
  });
  assert.notEqual(positions(moved), positions(synced));
});

test("the ligament search still finds the closest pair when the field spreads it out", () => {
  // The search grid is sized from the hole extents and the layout's nominal
  // pitch, neither of which knows what a spacing controller did. Without the
  // holes' own spread in that maximum, a thinned pattern reported no ligament at
  // all rather than a wide one.
  const spread = withSpacing({ "layout.type": "Scatter", "hole.diameter": 1 }, { target: 4, radius: 400 });
  const { stats } = computePattern(spread);
  assert.ok(stats.minLigament !== null && stats.minLigament > 0, `ligament ${stats.minLigament}`);
  // And a nearly-collinear pair, where the bounding box has no area to speak of.
  const thin = computePattern(
    doc({ "layout.type": "Spiral", "hole.shape": "Rectangle", "hole.w": 10, "hole.h": 10, "layout.edgeGapX": 20, "layout.edgeGapY": 20, "sheet.w": 200, "sheet.h": 15 }) // prettier-ignore
  );
  assert.ok(thin.activeHoles.length >= 2);
  assert.ok(thin.stats.minLigament !== null, "two holes on one line reported no ligament");
});

test("Custom Angle keeps its angle when the spacing field moves the rows", () => {
  // The stagger offset is a slope: shear = rise × tan(angle). Taking the rise
  // from the nominal pitch while the field moved it turned 30° into 55°.
  // Columns repeat every pitch, so the shear is only ever known modulo it, and
  // its sign alternates row to row: the assertion is
  // shear ≡ ±rise·tan(angle) (mod pitch), which pins the slope without pinning
  // which column the row happens to start on.
  const distanceToMultiple = (value, period) => {
    const wrapped = ((value % period) + period) % period;
    return Math.min(wrapped, period - wrapped);
  };
  const checkSlope = (d, what) => {
    const holes = place(d).filter(h => h.x > 20 && h.x < 180);
    const byRow = new Map();
    for (const h of holes) byRow.set(h.y, [...(byRow.get(h.y) || []), h.x]);
    const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).slice(3, 9);
    const tan = Math.tan((30 * Math.PI) / 180);
    for (let i = 1; i < rows.length; i++) {
      const [yA, xsA] = rows[i - 1];
      const [yB, xsB] = rows[i];
      const pitch = Math.min(...xsA.slice(1).map((x, k) => x - xsA[k]));
      const shear = Math.min(...xsB) - Math.min(...xsA);
      const rise = yB - yA;
      const off = Math.min(distanceToMultiple(shear - rise * tan, pitch), distanceToMultiple(shear + rise * tan, pitch)); // prettier-ignore
      assert.ok(off < 0.02, `${what}: rows ${yA}→${yB} sheared ${shear.toFixed(3)} where ±${(rise * tan).toFixed(3)} was asked for`); // prettier-ignore
    }
  };
  const angled = { "layout.type": "Custom Angle", "layout.customAngle": 30, "hole.diameter": 4, "layout.edgeGapX": 6, "layout.edgeGapY": 6 }; // prettier-ignore
  checkSlope(doc(angled), "no field");
  checkSlope(withSpacing(angled, { target: 0.4, radius: 2000, falloff: "hard" }), "under a 0.4× field");
});

test("a spiral keeps the step it was asked for, however wide the field opens it", () => {
  // The Δθ solver saturates at half a turn, where the chord is 2r + turnGap/2.
  // The opening radius is picked so that exceeds the step — a margin a 4×
  // controller erased, silently placing the innermost holes at 20 mm where 32
  // was asked for.
  for (const target of [1, 2.5, 4]) {
    const d = target === 1 ? doc({ "layout.type": "Spiral" }) : withSpacing({ "layout.type": "Spiral" }, { target });
    const holes = place(d);
    const field = compileSpacing(d.fields);
    let worst = Infinity;
    for (let i = 1; i < holes.length; i++) {
      const asked = 8 * (field ? field.sample(holes[i - 1].x, holes[i - 1].y) : 1);
      worst = Math.min(worst, Math.hypot(holes[i].x - holes[i - 1].x, holes[i].y - holes[i - 1].y) / asked);
    }
    assert.ok(worst > 0.97, `target ${target}: closest consecutive pair is ${(worst * 100).toFixed(0)}% of the step`);
  }
});

test("a broken sampler empties a layout rather than hanging it", () => {
  // Not reachable through compileSpacing, which clamps to the slider range — but
  // every walk in the layouts guards its step, and Fibonacci's did not: a zero
  // step left its radius where it was, so neither the boundary test nor the hole
  // cap ever fired.
  const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
  for (const sample of [() => 0, () => -1, () => NaN]) {
    const broken = { sample, signature: "broken", min: 1, max: 1 };
    assert.ok(generateFibonacciHoles({ bounds, minSpacing: 5, spacing: broken }).length < 2);
    assert.ok(generateSpiralHoles({ bounds, alongStep: 5, turnGap: 5, spacing: broken }).length < 2);
  }
});

test("no two modes place the same holes", () => {
  // The dispatch is a chain of ifs. A mode added to the registry but forgotten
  // there would come out as a plausible straight grid, and every other test in
  // this file — fills the sheet, stays in bounds, exports, gets denser as the
  // gap closes — would pass on it.
  const seen = new Map();
  for (const type of PATTERN_TYPES) {
    const key = positions(doc({ "layout.type": type }));
    assert.ok(!seen.has(key), `${type} places exactly what ${seen.get(key)} places`);
    seen.set(key, type);
  }
});

// ─── Path ─────────────────────────────────────────────────────────────

const pathDoc = (patch = {}, points = null) =>
  doc({
    "layout.type": "Path",
    ...(points ? { "layout.path.paths": [{ points, closed: false }] } : {}),
    ...patch,
  });

test("a straight path spaces its holes exactly the step apart", () => {
  // Within a segment the arc IS the chord, so this is the one case where the
  // spacing the panel reports and the distance between two centres are the same
  // number — and the test that says the walk carries its remainder across
  // vertices rather than restarting at each one.
  const line = pathDoc({ "layout.path.smooth": false }, [
    { x: 20, y: 100 },
    { x: 100, y: 100 },
    { x: 180, y: 100 },
  ]);
  const holes = place(line);
  const { geometry } = computePattern(line);
  assert.ok(holes.length > 15, `${holes.length} holes`);
  for (let i = 1; i < holes.length; i++) {
    const step = Math.hypot(holes[i].x - holes[i - 1].x, holes[i].y - holes[i - 1].y);
    assert.ok(
      Math.abs(step - geometry.freeSpacingX) < 1e-9,
      `pair ${i} is ${step} apart, not ${geometry.freeSpacingX}`
    );
  }
  // And the vertex in the middle is not a seam: the holes run straight through
  // it at the same spacing, which is what carrying the remainder buys.
  assert.ok(holes.some(h => h.x > 95 && h.x < 105));
});

test("a closed path comes back to where it started", () => {
  const square = [
    { x: 50, y: 50 },
    { x: 150, y: 50 },
    { x: 150, y: 150 },
    { x: 50, y: 150 },
  ];
  const open = place(pathDoc({ "layout.path.smooth": false }, square));
  const closed = place(doc({ "layout.type": "Path", "layout.path.smooth": false, "layout.path.paths": [{ points: square, closed: true }] })); // prettier-ignore
  // The fourth side is the difference, and it is a quarter of the perimeter.
  assert.ok(closed.length > open.length, `${closed.length} against ${open.length}`);
  assert.ok(
    closed.some(h => h.x < 55 && h.y > 100),
    "the closing side should carry holes"
  );
});

test("holes turn along the path only when asked to", () => {
  const diagonal = [
    { x: 40, y: 40 },
    { x: 160, y: 160 },
  ];
  const rect = { "hole.shape": "Rectangle", "hole.w": 8, "hole.h": 3, "layout.path.smooth": false };
  const turned = place(pathDoc(rect, diagonal));
  assert.ok(
    turned.every(h => Math.abs(h.angle - Math.PI / 4) < 1e-9),
    "every hole should lie along the diagonal"
  );
  const flat = place(pathDoc({ ...rect, "layout.path.alignToTangent": false }, diagonal));
  assert.ok(flat.every(h => !h.angle));
});

test("the default curve is what Add Path hands over", () => {
  // Pressing Add Path must not move the pattern: the layout's fallback curve and
  // the first curve the panel creates are the same one.
  const implicit = place(doc({ "layout.type": "Path" }));
  const area = { x: 0, y: 0, w: 200, h: 200 };
  const explicit = place(doc({ "layout.type": "Path", "layout.path.paths": [newPath(area)] }));
  assert.deepEqual(explicit, implicit);
  assert.ok(implicit.length > 20);
});

test("a spacing controller thins a path, and only where it reaches", () => {
  const line = [
    { x: 10, y: 100 },
    { x: 190, y: 100 },
  ];
  const base = place(pathDoc({ "layout.path.smooth": false }, line));
  const thinned = place(
    doc({
      "layout.type": "Path",
      "layout.path.smooth": false,
      "layout.path.paths": [{ points: line, closed: false }],
      "fields.enabled": true,
      "fields.controllers": [spacingController({ target: 3, radius: 45 })],
    })
  );
  assert.ok(thinned.length < base.length);
  // The left end is outside the controller's reach, so the first few holes are
  // where they always were — a global multiplier would have moved them.
  assert.ok(Math.abs(thinned[1].x - base[1].x) < 1e-9, "the far end should be untouched");
});

test("editing a path clears the removed holes, and only in Path mode", () => {
  const moved = { x: 60, y: 60 };
  const base = pathDoc({ "layout.path.smooth": false }, [{ x: 40, y: 40 }, { x: 160, y: 160 }]); // prettier-ignore
  const edited = patchIn(base, { "layout.path.paths": [{ points: [{ x: 40, y: 40 }, moved], closed: false }] });
  assert.notEqual(positions(edited), positions(base));
  assert.notEqual(patternSignature(edited), patternSignature(base));
  // The same edit under a mode that does not read the curves must leave the
  // removals alone — the block is signed only by the mode that walks it.
  const grid = patchIn(base, { "layout.type": "Straight" });
  assert.equal(
    patternSignature(patchIn(grid, { "layout.path.paths": [{ points: [{ x: 40, y: 40 }, moved], closed: false }] })),
    patternSignature(grid)
  );
});

test("the path gizmo moves, adds and drops vertices within the document's range", () => {
  const paths = [{ points: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }], closed: false }]; // prettier-ignore
  // A drag at a zoomed-out view can ask for a coordinate no document may hold;
  // clamping here is what lets the editor read back its own output.
  const far = movePathVertex(paths, 0, 1, 1e6, -1e6);
  const [lo, hi] = DOC_LIMITS["layout.path.coord"];
  assert.deepEqual(far[0].points[1], { x: hi, y: lo });
  assert.deepEqual(far[0].points[0], paths[0].points[0], "the other vertices are untouched");

  // A new vertex splits the longest span, which here is the first.
  const grown = addPathVertex(paths[0]);
  assert.equal(grown.points.length, 4);
  assert.deepEqual(grown.points[1], { x: 50, y: 10 });
  assert.equal(removePathVertex(grown).points.length, 3);
  assert.equal(removePathVertex({ points: paths[0].points.slice(0, 2) }), null, "two vertices is the floor");

  // Hit testing is in screen pixels, so the handles stay grabbable at any zoom.
  assert.deepEqual(hitTestPath(paths, 91, 11, 1, 14), { pathIndex: 0, pointIndex: 1 });
  assert.equal(hitTestPath(paths, 50, 50, 1, 14), null);
  assert.equal(hitTestPath(paths, 91, 11, 100, 14), null, "zoomed in, the same click is 1.4 mm off and misses");
});

test("a path refuses a step it cannot draw rather than covering part of a curve", () => {
  // Four full-length zigzags at the finest step the sliders and the field allow.
  // The cap is a backstop, not a budget: one ordinary curve cannot come near it.
  const zigzag = Array.from({ length: MAX_PATH_POINTS }, (_, i) => ({
    x: i % 2 ? 990 : 10,
    y: 10 + (i * 980) / MAX_PATH_POINTS,
  }));
  const fine = doc({
    "layout.type": "Path",
    "layout.path.smooth": false,
    "layout.path.paths": Array.from({ length: MAX_PATHS }, () => ({ points: zigzag, closed: false })),
    "hole.diameter": 0.5,
    "layout.edgeGapX": 0,
    "sheet.w": 1000,
    "sheet.h": 1000,
    "fields.enabled": true,
    "fields.controllers": [spacingController({ target: 0.2, radius: 2000, falloff: "hard" })],
  });
  assert.equal(place(fine).length, 0);
  // One of those curves at the same step still draws, and draws all of it.
  const single = patchIn(fine, { "layout.path.paths": [{ points: zigzag.slice(0, 8), closed: false }] });
  const holes = place(single);
  assert.ok(holes.length > 10000, `${holes.length} holes`);
  assert.ok(Math.min(...holes.map(h => h.y)) < 60 && Math.max(...holes.map(h => h.y)) > 140);
});

// ─── Voronoi ──────────────────────────────────────────────────────────

test("voronoi cells leave exactly the edge gap between any two of them", () => {
  // The one property the mode exists for: no lattice at all, and still a
  // constant ligament, because two neighbouring cells share a Voronoi edge and
  // each pulls back by half the gap from it.
  for (const gap of [1, 3, 8]) {
    const { activeHoles, stats, overlaps } = computePattern(doc({ "layout.type": "Voronoi", "layout.edgeGapX": gap }));
    assert.ok(activeHoles.length > 100, `gap ${gap}: only ${activeHoles.length} cells`);
    assert.equal(overlaps.size, 0, `gap ${gap}: cells overlap`);
    assert.ok(stats.minLigament >= gap - 1e-6, `gap ${gap}: ligament ${stats.minLigament}`);
    // And it is the gap, not merely at least it: somewhere on a sheet of
    // hundreds of cells two of them face each other across a full shared edge.
    assert.ok(stats.minLigament <= gap + 0.01, `gap ${gap}: ligament ${stats.minLigament}`);
  }
});

test("voronoi cells tile the panel, inside the boundary and without gaps of their own", () => {
  const { activeHoles, stats, params } = computePattern(
    doc({ "layout.type": "Voronoi", "layout.edgeGapX": 2, "boundary.margins.top": 10 })
  );
  const gap = 2;
  for (const cell of activeHoles) {
    for (const [x, y] of holeVertices(cell, "Polygon")) {
      assert.ok(x >= gap / 2 - 1e-6 && x <= 200 - gap / 2 + 1e-6, `cell vertex at x ${x}`);
      assert.ok(y >= 10 + gap / 2 - 1e-6 && y <= 200 - gap / 2 + 1e-6, `cell vertex at y ${y}`);
    }
  }
  // A tessellation minus its ligaments: what is left is most of the panel, and
  // the statistics have to say so rather than reporting a lattice's cell.
  assert.equal(stats.useCountedOAR, true);
  assert.ok(stats.displayOAR > 50 && stats.displayOAR < 90, `OAR ${stats.displayOAR}`);
  assert.equal(params.holeShape, "Polygon", "the layout imposes the shape");
});

test("the voronoi and scatter modes share one point set, and one seed", () => {
  const at = (type, seed) => computePattern(doc({ "layout.type": type, "layout.scatter.seed": seed }));
  const cells = at("Voronoi", 7);
  const points = at("Scatter", 7);
  // Every cell sits on a scattered hole. Not merely the same count: switching
  // between the two modes has to keep the arrangement, which is the whole reason
  // they share a seed rather than carrying one each.
  const sites = new Set(points.baseHoles.map(h => `${h.x},${h.y}`));
  assert.ok(cells.baseHoles.length > 100);
  assert.ok(
    cells.baseHoles.every(h => sites.has(`${h.x},${h.y}`)),
    "a cell was built on a site the scatter never placed"
  );
  // A different seed is a different arrangement at the same density.
  const other = at("Voronoi", 8);
  assert.notEqual(JSON.stringify(cells.baseHoles), JSON.stringify(other.baseHoles));
  assert.ok(Math.abs(cells.baseHoles.length - other.baseHoles.length) < cells.baseHoles.length * 0.15);
});

test("a voronoi document signs the gap as well as the pitch", () => {
  // freeSpacingX folds the hole size and the edge gap into one number, and the
  // two split it differently: a 6 mm hole at a 2 mm gap and a 5 mm hole at a
  // 3 mm gap sow their sites identically and cut very different cells. Signing
  // only the sum would leave `removedHoles` pointing at the wrong holes across
  // that edit — and the two patterns are genuinely different, so the signature
  // has to move.
  const wide = doc({ "layout.type": "Voronoi", "hole.diameter": 6, "layout.edgeGapX": 2 });
  const tight = doc({ "layout.type": "Voronoi", "hole.diameter": 5, "layout.edgeGapX": 3 });
  assert.equal(deriveGeometry(wide).freeSpacingX, deriveGeometry(tight).freeSpacingX, "same site spacing");
  assert.notEqual(positions(wide), positions(tight), "different cells");
  assert.notEqual(patternSignature(wide), patternSignature(tight));
});

test("a spacing field varies the size of the cells, not just where the sites fall", () => {
  const { activeHoles } = computePattern(
    withSpacing({ "layout.type": "Voronoi" }, { target: 2.5, radius: 60, falloff: "hard" })
  );
  const near = activeHoles.filter(h => Math.hypot(h.x - 100, h.y - 100) < 40);
  const far = activeHoles.filter(h => Math.hypot(h.x - 100, h.y - 100) > 90);
  assert.ok(near.length > 5 && far.length > 5);
  const mean = list => list.reduce((sum, h) => sum + h.area, 0) / list.length;
  assert.ok(mean(near) > mean(far) * 2, `${mean(near)} mm² inside vs ${mean(far)} mm² outside`);
});

test("voronoi refuses a cell count it cannot draw, and rounds its corners when asked", () => {
  // A metre square of half-millimetre cells is past the cap, and the mode places
  // nothing rather than filling a disc in the middle of a blank sheet.
  const tooFine = doc({
    "layout.type": "Voronoi",
    "hole.diameter": 0.5,
    "layout.edgeGapX": 0,
    "sheet.w": 1000,
    "sheet.h": 1000,
  });
  assert.equal(place(tooFine).length, 0);

  // The corner radius is the cell's own, clamped per cell to what its corners
  // can take, so it takes area off every one of them without closing any.
  const sharp = computePattern(doc({ "layout.type": "Voronoi" }));
  const round = computePattern(doc({ "layout.type": "Voronoi", "hole.cornerRadius": 2 }));
  assert.equal(sharp.activeHoles.length, round.activeHoles.length);
  assert.ok(round.stats.totalHoleArea < sharp.stats.totalHoleArea * 0.99);
  assert.ok(round.stats.totalHoleArea > sharp.stats.totalHoleArea * 0.7);
});

test("a voronoi cell shrinks under the size channel and erodes under the taper", () => {
  const base = computePattern(doc({ "layout.type": "Voronoi" }));
  // Half-size cells cover a quarter of the area and leave far more metal, but
  // there are exactly as many of them: the size channel redraws holes, it never
  // moves or removes them.
  const small = computePattern(
    doc({ "layout.type": "Voronoi", "variation.enabled": true, "variation.minScale": 0.5, "variation.maxScale": 0.5 })
  );
  assert.equal(small.activeHoles.length, base.activeHoles.length);
  assert.ok(Math.abs(small.stats.totalHoleArea / base.stats.totalHoleArea - 0.25) < 0.02);

  // The taper erodes the cell inward on every edge, so the exit face is smaller
  // than the entry face by more than nothing and less than everything.
  const tapered = computePattern(
    doc({ "layout.type": "Voronoi", "taper.enabled": true, "taper.thickness": 2, "taper.angle": 10 })
  );
  assert.ok(tapered.stats.totalExitHoleArea < tapered.stats.totalHoleArea);
  assert.ok(tapered.stats.totalExitHoleArea > tapered.stats.totalHoleArea * 0.4);
  assert.ok(tapered.activeHoles.every(h => h.exitW <= h.w + 1e-9 && h.exitH <= h.h + 1e-9));
});
