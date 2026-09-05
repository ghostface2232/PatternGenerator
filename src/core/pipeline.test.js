import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, getIn, patchIn, setIn } from "./document.js";
import {
  PLACEMENT_PARAMS,
  buildParams,
  compilePlacement,
  computePattern,
  deriveGeometry,
  patternSignature,
} from "./pipeline.js";
import { validateDocument } from "./persistence.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateHoles } from "../layouts/index.js";
import { generateSVGString } from "../export/svg.js";

// These numbers mirror e2e/smoke.spec.js so a geometry regression is caught
// without a browser.
const doc = (patch = {}) => patchIn(createDocument(), patch);
const fixed = (n, d = 1) => Number(n.toFixed(d));

test("default document: 739 holes, 35.4% OAR, 3.00 mm ligament", () => {
  const { stats, activeHoles } = computePattern(createDocument());
  assert.equal(activeHoles.length, 739);
  assert.equal(fixed(stats.displayOAR), 35.4);
  assert.equal(fixed(stats.minLigament, 2), 3);
  assert.equal(stats.useCountedOAR, false);
  assert.equal(stats.hasOverlap, false);
});

test("min ligament follows the edge gap", () => {
  const { stats } = computePattern(doc({ "layout.edgeGapX": 4.5, "layout.edgeGapY": 4.5, "hole.diameter": 3 }));
  assert.equal(fixed(stats.minLigament, 2), 4.5);
});

test("seamless tilings reach 100% open area at gap 0 and report the gap as ligament", () => {
  const cases = [
    { "hole.shape": "Hexagon", "layout.type": "Staggered 60°" },
    { "hole.shape": "Diamond", "layout.type": "Staggered 60°" },
    { "hole.shape": "Triangle", "layout.type": "Straight" },
  ];
  for (const c of cases) {
    const zero = computePattern(doc({ ...c, "layout.edgeGapX": 0, "layout.edgeGapY": 0 }));
    assert.equal(fixed(zero.stats.displayOAR), 100, JSON.stringify(c));
    assert.equal(fixed(zero.stats.minLigament, 2), 0, JSON.stringify(c));
    const gapped = computePattern(doc({ ...c, "layout.edgeGapX": 1.5, "layout.edgeGapY": 1.5 }));
    assert.equal(fixed(gapped.stats.minLigament, 2), 1.5, JSON.stringify(c));
    assert.equal(gapped.stats.hasOverlap, false);
  }
});

test("DIN Rv 3-5 gives the textbook 32.6% open area", () => {
  const { stats } = computePattern(
    doc({ "hole.diameter": 3, "layout.edgeGapX": 2, "layout.edgeGapY": 1.33, "layout.type": "Staggered 60°" })
  );
  assert.equal(fixed(stats.displayOAR), 32.6);
});

test("margins and corner radius switch to counted OAR", () => {
  const { stats } = computePattern(doc({ "boundary.margins.top": 10, "boundary.cornerRadius": 20 }));
  assert.equal(stats.useCountedOAR, true);
  assert.ok(stats.displayOAR > 30 && stats.displayOAR < 40);
});

test("removed holes are excluded from the count and OAR", () => {
  const base = computePattern(createDocument());
  const removed = computePattern(doc({ removedHoles: [0, 1, 2] }));
  assert.equal(removed.activeHoles.length, base.activeHoles.length - 3);
  assert.equal(removed.stats.useCountedOAR, true);
});

test("taper shrinks the exit side and can close holes", () => {
  const open = computePattern(doc({ "taper.enabled": true, "taper.thickness": 2, "taper.angle": 10 }));
  assert.ok(open.stats.effectiveOAR < open.stats.nominalOAR);
  assert.equal(open.stats.hasClosedHoles, false);
  const closed = computePattern(doc({ "taper.enabled": true, "taper.thickness": 10, "taper.angle": 15 }));
  assert.equal(closed.stats.holeClosed, true);
  // taper.enabled=false ignores thickness/angle entirely
  const off = computePattern(doc({ "taper.thickness": 10, "taper.angle": 15 }));
  assert.equal(off.geometry.taperActive, false);
});

test("radial patterns always use counted OAR", () => {
  const { stats, activeHoles } = computePattern(doc({ "layout.type": "Radial" }));
  assert.ok(activeHoles.length > 0);
  assert.equal(stats.useCountedOAR, true);
});

test("size variation scales holes and can cull below the floor", () => {
  const varied = computePattern(
    doc({ "variation.enabled": true, "variation.minScale": 0.2, "variation.maxScale": 1, "variation.cullBelow": 1.5 })
  );
  assert.ok(varied.stats.culledHoleCount > 0);
  assert.ok(varied.activeHoles.every(h => h.w >= 1.5));
});

test("SVG export is dimensioned in mm and has one element per active hole", () => {
  const { activeHoles, params } = computePattern(createDocument());
  const svg = generateSVGString(activeHoles, params);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="200mm" height="200mm"/);
  assert.equal(svg.match(/<circle /g).length, 739);
});

test("setIn / patchIn are structural-sharing immutable updates", () => {
  const d = createDocument();
  const d2 = setIn(d, "hole.diameter", 6);
  assert.equal(getIn(d2, "hole.diameter"), 6);
  assert.equal(getIn(d, "hole.diameter"), 5);
  assert.equal(d2.layout, d.layout); // untouched branch shared
  assert.notEqual(d2.hole, d.hole);
  assert.equal(setIn(d, "hole.diameter", 5), d); // same value → same object
});

test("patternSignature ignores everything that does not move a hole", () => {
  const base = createDocument();
  const same = [
    { "layout.gapLinked": false },
    { "layout.radial.linked": false },
    { "boundary.marginLinked": false },
    { "appearance.holeColor": "#ff0000" },
    { name: "Renamed" },
    { removedHoles: [1, 2, 3] },
    { presetIndex: 4 },
    { "variation.enabled": true, "variation.minScale": 0.3 },
    // Drawn differently, placed identically: the hole corner radius and the
    // whole taper block are absent from the signature.
    { "hole.cornerRadius": 1 },
    { "taper.thickness": 3 },
    { "taper.enabled": true, "taper.thickness": 3, "taper.angle": 5 },
    { "taper.enabled": true, "taper.thickness": 3, "taper.angle": 5, "taper.direction": "Bottom larger" },
  ];
  for (const patch of same) {
    assert.equal(patternSignature(doc(patch)), patternSignature(base), JSON.stringify(patch));
  }
  const different = [
    { "hole.diameter": 6 },
    { "hole.shape": "Hexagon" },
    { "layout.edgeGapX": 4 },
    { "layout.type": "Straight" },
    { "sheet.w": 300 },
    { "boundary.margins.top": 5 },
    { "boundary.cornerRadius": 10 },
  ];
  for (const patch of different) {
    assert.notEqual(patternSignature(doc(patch)), patternSignature(base), JSON.stringify(patch));
  }
});

// The contract the removed-hole rule rests on: an edit that moves, adds or drops
// a hole MUST change the signature. The reverse is allowed to be conservative
// (a shape swap that happens to keep every centre still resets), but never this
// direction — a miss would leave stale indices pointing at the wrong holes.
test("every edit that changes hole placement changes the signature", () => {
  const positions = d => JSON.stringify(generateHoles(buildParams(d, deriveGeometry(d))));
  const bases = [
    {},
    { "hole.shape": "Rectangle", "hole.w": 6, "hole.h": 3 },
    { "hole.shape": "Hexagon" },
    { "hole.shape": "Triangle" },
    { "hole.shape": "Diamond", "layout.type": "Staggered 60°" },
    { "layout.type": "Straight" },
    { "layout.type": "Staggered 45°" },
    { "layout.type": "Custom Angle" },
    { "layout.type": "Radial" },
    { "layout.type": "Radial", "layout.radial.layout": "Sunflower" },
    { "layout.type": "Radial", "layout.radial.layout": "6k Rosette", "layout.radial.mode": "Circle" },
    { "boundary.margins.top": 8, "boundary.cornerRadius": 15 },
    { "hole.shape": "Rectangle", "hole.w": 6, "hole.h": 3, "layout.type": "Straight" },
    { "layout.type": "Cross-hatch" },
    { "layout.type": "Scatter" },
    { "layout.type": "Spiral" },
    { "layout.type": "Fibonacci" },
  ];
  const edits = [
    { "hole.diameter": 7 },
    { "hole.w": 9 },
    { "hole.h": 2 },
    { "hole.shape": "Pill" },
    { "hole.shape": "Circle" },
    { "hole.cornerRadius": 1 },
    { "hole.diamondOrient": "Flat up" },
    { "hole.triEquilateral": false },
    { "layout.type": "Straight" },
    { "layout.type": "Staggered 60°" },
    { "layout.edgeGapX": 7 },
    { "layout.edgeGapY": 7 },
    { "layout.gapLinked": false },
    { "layout.customAngle": 55 },
    { "layout.radial.edgeGap": 9 },
    { "layout.radial.circumGap": 9 },
    { "layout.radial.linked": false },
    { "layout.radial.mode": "Circle" },
    { "layout.radial.layout": "Sunflower" },
    { "layout.radial.centerHole": true },
    { "layout.crosshatch.angleA": 10 },
    { "layout.crosshatch.angleB": 80 },
    { "layout.scatter.seed": 4242 },
    { "sheet.w": 260 },
    { "sheet.h": 260 },
    { "boundary.margins.top": 12 },
    { "boundary.margins.bottom": 12 },
    { "boundary.margins.left": 12 },
    { "boundary.margins.right": 12 },
    { "boundary.marginLinked": false },
    { "boundary.cornerRadius": 25 },
    { "taper.enabled": true, "taper.thickness": 2, "taper.angle": 6 },
    { "taper.direction": "Bottom larger" },
    { "variation.enabled": true },
    { presetIndex: 3 },
    { name: "x" },
    { "appearance.bgColor": "#123456" },
    // Sub-step edits. Every other edit here is coarse, so a signature that
    // rounded its numbers — to 2dp, say — would pass the whole sweep while
    // silently keeping removals across a real move. The sliders step by 0.1 to
    // 1, but their numeric fields commit raw parseFloat and nothing downstream
    // rounds: validateDocument clamps to a range and no more, so a share link
    // round-trips whatever it was given, to the last bit.
    { "hole.diameter": 5.001 },
    { "sheet.w": 200.001 },
    { "layout.edgeGapX": 3.001 },
    { "boundary.margins.left": 0.001 },
    // Compensating pairs: the pitch is unchanged, only the hole extent moves.
    // Single-field edits alone cannot separate hole size from pitch.
    { "hole.w": 1, "layout.edgeGapX": 8 },
    { "hole.h": 5, "layout.edgeGapY": 1 },
    { "hole.diameter": 1, "layout.edgeGapX": 7, "layout.edgeGapY": 7 },
    { "hole.diameter": 8, "layout.radial.edgeGap": 2, "layout.radial.circumGap": 2 },
  ];
  let moved = 0;
  for (const basePatch of bases) {
    const base = doc(basePatch);
    for (const edit of edits) {
      const next = patchIn(base, edit);
      if (positions(next) === positions(base)) continue;
      moved++;
      assert.notEqual(
        patternSignature(next),
        patternSignature(base),
        `placement changed but signature did not: ${JSON.stringify(basePatch)} + ${JSON.stringify(edit)}`
      );
    }
  }
  assert.ok(moved > 100, `expected the sweep to move holes often, got ${moved}`);

  // Asserted again outside the loop, because the loop cannot protect it: an
  // edit whose placement stops moving is silently skipped, and the floor above
  // has enough slack to absorb all four sub-step edits going inert at once.
  // The last value is the next representable double after 200 — it survives a
  // share-link round trip exactly, so no rounding at any number of decimals is
  // a sound signature, and this is the assertion that says so.
  const flat = doc({});
  for (const value of [200.001, 200.0001, 200 * (1 + Number.EPSILON)]) {
    const fine = doc({ "sheet.w": value });
    assert.notEqual(positions(fine), positions(flat), `sheet.w ${value} must move a hole`);
    assert.notEqual(patternSignature(fine), patternSignature(flat), `sheet.w ${value} must change the signature`);
  }
});

test("triEquilateral only changes the signature when it changes the height", () => {
  const tri = doc({ "hole.shape": "Triangle", "hole.w": 6, "hole.h": (6 * Math.sqrt(3)) / 2 });
  // h already equals the equilateral height, so unlocking it leaves the pattern alone
  assert.equal(patternSignature(patchIn(tri, { "hole.triEquilateral": false })), patternSignature(tri));
  const other = patchIn(tri, { "hole.h": 10 });
  assert.notEqual(patternSignature(patchIn(other, { "hole.triEquilateral": false })), patternSignature(other));
});

test("a dense pattern computes its statistics without overflowing the stack", () => {
  // 200 mm panel of 0.5 mm holes at zero gap — reachable from the sliders alone.
  // The exit-size extremes used to be spread into Math.min/Math.max, which throws
  // RangeError past roughly 125k arguments.
  const dense = doc({ "hole.diameter": 0.5, "layout.edgeGapX": 0, "layout.edgeGapY": 0 });
  const { stats, activeHoles } = computePattern(dense);
  assert.ok(activeHoles.length > 150000, `only ${activeHoles.length} holes`);
  assert.equal(stats.perfMode, true);
  assert.equal(stats.minLigament, null); // skipped above the performance-mode limit
  assert.equal(fixed(stats.minExit, 3), 0.5);
  assert.equal(fixed(stats.maxExit, 3), 0.5);
  assert.equal(stats.hasClosedHoles, false);

  // With taper on, the extremes are the tapered exit size, still in one pass.
  const tapered = computePattern(
    doc({
      "hole.diameter": 0.5,
      "layout.edgeGapX": 0,
      "layout.edgeGapY": 0,
      "taper.enabled": true,
      "taper.thickness": 1,
      "taper.angle": 5,
    })
  );
  assert.ok(tapered.stats.minExit > 0 && tapered.stats.minExit < 0.5);
  assert.equal(fixed(tapered.stats.minExit, 6), fixed(tapered.stats.maxExit, 6));
  assert.equal(fixed(tapered.stats.dExit, 6), fixed(tapered.stats.minExit, 6));
});

test("exit statistics are empty rather than infinite when every hole is closed", () => {
  const closed = computePattern(doc({ "taper.enabled": true, "taper.thickness": 10, "taper.angle": 15 }));
  assert.equal(closed.stats.holeClosed, true);
  assert.equal(closed.stats.minExit, 0);
  assert.equal(closed.stats.maxExit, 0);
  assert.equal(closed.stats.dExit, 0);
});

test("removals recorded against a different pattern do not count as removed", () => {
  const stale = computePattern(doc({ removedHoles: [999999, 1000000] }));
  assert.equal(stale.stats.removedHoleCount, 0);
  assert.equal(stale.stats.hasRemovedHoles, false);
  assert.equal(stale.stats.useCountedOAR, false); // and do not force the counted path
  assert.equal(stale.activeHoles.length, 739);

  const real = computePattern(doc({ removedHoles: [0, 1, 999999] }));
  assert.equal(real.stats.removedHoleCount, 2);
  assert.equal(real.stats.hasRemovedHoles, true);
  assert.equal(real.activeHoles.length, 737);
});

test("a partly closed pattern reports the open holes' extremes, not the closed ones", () => {
  // Variation makes the holes range from 20% to 100% of 5 mm; the taper inset
  // closes only the smallest of them, which is the case where the exit loop has
  // to skip closed holes without letting them seed the extremes.
  const mixed = computePattern(
    doc({
      "variation.enabled": true,
      "variation.minScale": 0.2,
      "variation.maxScale": 1,
      "taper.enabled": true,
      "taper.thickness": 3,
      "taper.angle": 15,
    })
  );
  const { stats, activeHoles } = mixed;
  assert.ok(stats.closedHoleCount > 0, "expected some holes to close");
  assert.ok(stats.closedHoleCount < activeHoles.length, "expected some holes to stay open");
  assert.equal(stats.holeClosed, false);
  assert.equal(stats.hasClosedHoles, true);
  assert.ok(stats.minExit > 0, `minExit ${stats.minExit} should ignore the closed holes`);
  assert.ok(stats.minExit <= stats.dExit && stats.dExit <= stats.maxExit);

  // Cross-check against a direct computation over the open holes only.
  const open = activeHoles.filter(h => !h.isClosed).map(h => Math.min(h.exitW, h.exitH));
  assert.equal(open.length, activeHoles.length - stats.closedHoleCount);
  assert.equal(
    stats.minExit,
    open.reduce((m, v) => Math.min(m, v), Infinity)
  );
  assert.equal(
    stats.maxExit,
    open.reduce((m, v) => Math.max(m, v), -Infinity)
  );
  assert.equal(stats.dExit, open.reduce((s, v) => s + v, 0) / open.length);
});

test("culled holes are not counted as removed ones", () => {
  // The `- culledHoleCount` term: without it a document with culling and no
  // removals at all would report every culled hole as removed by hand.
  const culling = {
    "variation.enabled": true,
    "variation.minScale": 0.2,
    "variation.maxScale": 1,
    "variation.cullBelow": 1.5,
  };
  const culledOnly = computePattern(doc(culling));
  assert.ok(culledOnly.stats.culledHoleCount > 0, "expected the size floor to cull something");
  assert.equal(culledOnly.stats.removedHoleCount, 0);
  assert.equal(culledOnly.stats.hasRemovedHoles, false);

  const withRemoval = computePattern(doc({ ...culling, removedHoles: [51] }));
  assert.equal(withRemoval.stats.removedHoleCount, 1);
  assert.equal(withRemoval.stats.activeHoleCount, culledOnly.stats.activeHoleCount - 1);

  // A hole that is both removed and culled counts once, as a removal.
  const culledIndex = culledOnly.holes.findIndex(h => h.culled);
  assert.ok(culledIndex >= 0);
  const both = computePattern(doc({ ...culling, removedHoles: [culledIndex] }));
  assert.equal(both.stats.removedHoleCount, 1);
  assert.equal(both.stats.culledHoleCount, culledOnly.stats.culledHoleCount - 1);
  assert.equal(both.stats.activeHoleCount, culledOnly.stats.activeHoleCount);
});

test("null, undefined and NaN encode differently in the signature", () => {
  // JSON.stringify writes undefined, null and NaN identically in array position.
  // Validation keeps those out of a document, but the encoding must not depend
  // on that: null coerces to 0 in the placement arithmetic while undefined
  // poisons it to NaN and empties the pattern.
  const base = createDocument();
  const withNull = patchIn(base, { "boundary.margins.left": null });
  const withUndefined = patchIn(base, { "boundary.margins.left": undefined });
  const withNaN = patchIn(base, { "boundary.margins.left": NaN });
  const signatures = [withNull, withUndefined, withNaN].map(patternSignature);
  assert.equal(new Set(signatures).size, 3, "null, undefined and NaN must encode differently");
  assert.notEqual(generateHoles(buildParams(withNull, deriveGeometry(withNull))).length, 0);
  assert.equal(generateHoles(buildParams(withUndefined, deriveGeometry(withUndefined))).length, 0);

  // Same hazard one step out, and the reason the value goes through String()
  // rather than JSON.stringify: JSON writes NaN and Infinity both as null,
  // wherever they sit. They place differently — 739 holes against 571.
  const nan = patchIn(base, { "boundary.cornerRadius": NaN });
  const inf = patchIn(base, { "boundary.cornerRadius": Infinity });
  assert.notEqual(
    generateHoles(buildParams(nan, deriveGeometry(nan))).length,
    generateHoles(buildParams(inf, deriveGeometry(inf))).length
  );
  assert.notEqual(patternSignature(nan), patternSignature(inf), "NaN and Infinity must encode differently");
});

test("the type tag, field position and quoting each carry their weight", () => {
  // Ways an encoding of the same values could collapse two documents into one
  // signature. Each is paired with the placement it would wrongly preserve
  // removals across, so none can be satisfied by encoding alone.
  // Only the sheet swap is reachable from the app — two slider drags. The other
  // three are stopped by validateDocument, which coerces the numeric string and
  // enum-picks the radial fields; they are properties the encoding should hold
  // on its own rather than hazards standing open today.
  const base = createDocument();
  // Hashed, not compared whole: a mismatch otherwise prints two 30 KB hole lists.
  const place = d =>
    createHash("sha1")
      .update(JSON.stringify(generateHoles(buildParams(d, deriveGeometry(d)))))
      .digest("hex");
  const differ = (a, b, what) => {
    assert.notEqual(place(a), place(b), `${what}: placement must differ for this to be worth signing`);
    assert.notEqual(patternSignature(a), patternSignature(b), what);
  };

  // The typeof tag. grid.js adds margins to coordinates, so a numeric string
  // concatenates where a number would add: every centre moves, the count does
  // not, and String() alone writes both as 7.
  differ(
    patchIn(base, { "boundary.margins.left": 7 }),
    patchIn(base, { "boundary.margins.left": "7" }),
    "a numeric string must not sign as its number"
  );

  // Field position. An encoding that sorted or pooled the fields would sign a
  // portrait sheet and a landscape one alike. Both swaps are needed: these two
  // are numbers, so pooling only the string fields would slip past them.
  const radial = patchIn(base, { "layout.type": "Radial" });
  differ(
    patchIn(base, { "sheet.w": 200, "sheet.h": 300 }),
    patchIn(base, { "sheet.w": 300, "sheet.h": 200 }),
    "two numeric fields must not be interchangeable"
  );
  differ(
    patchIn(radial, { "layout.radial.mode": "Full", "layout.radial.layout": "Concentric" }),
    patchIn(radial, { "layout.radial.mode": "Concentric", "layout.radial.layout": "Full" }),
    "two string fields must not be interchangeable"
  );

  // Quoting. Joining type-tagged fields on a separator let a string param carry
  // that separator and shift the fields around it. Radial again: otherwise the
  // two fields below never reach the placement arithmetic and both documents
  // generate the same 739 holes, leaving nothing for a signature to preserve.
  const NUL = String.fromCharCode(0);
  differ(
    patchIn(radial, { "layout.radial.mode": "Full", "layout.radial.layout": `Concentric${NUL}string:Sunflower` }),
    patchIn(radial, { "layout.radial.mode": `Full${NUL}string:Concentric`, "layout.radial.layout": "Sunflower" }),
    "a value must not shift the fields around it"
  );
});

test("validation leaves every placement param a primitive", () => {
  // patternSignature calls String() on each param and does not catch, so a value
  // with no primitive form would throw inside the reducer and take down the
  // render. What stops that is validateDocument, not the signature: this is the
  // invariant the comment above the encoding leans on, asserted.
  const PRIMITIVE = new Set(["number", "string", "boolean"]);
  // Everything JSON can carry that is not a primitive, plus the shapes a
  // hand-written share link or a stale autosave could hold. { toString: null }
  // stands in for Object.create(null), which JSON cannot express: both make
  // String() throw, and only the first survives a round trip.
  const poisons = [{}, [], [1, 2], { toString: null }, null, "", "abc", -1e9, 1e9];

  // Every leaf of the document, walked rather than listed. A hand-written list
  // silently rots: it named hole.cornerRadius, which is not a placement param at
  // all, and omitted boundary.margins.bottom and .right, which are — and passing
  // those two through unvalidated survives the whole suite.
  const leaves = (node, prefix = "") =>
    Object.entries(node).flatMap(([key, value]) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? leaves(value, `${prefix}${key}.`)
        : [`${prefix}${key}`]
    );

  // Twice over, because a field can hide behind a shape: deriveGeometry reads
  // hole.diameter for a Circle and hole.w / hole.h for the custom-size shapes,
  // so a poisoned hole.w never reaches a param under the default document.
  for (const shape of ["Circle", "Rectangle"]) {
    const base = patchIn(createDocument(), { "hole.shape": shape });
    for (const field of leaves(base)) {
      for (const poison of poisons) {
        const doc = validateDocument(patchIn(base, { [field]: poison }));
        // A throw here is the same failure by another route — deriveGeometry
        // reaches most of these values before the signature does.
        const params = buildParams(doc, deriveGeometry(doc));
        for (const key of PLACEMENT_PARAMS) {
          assert.ok(
            PRIMITIVE.has(typeof params[key]),
            `${key} is ${typeof params[key]} after validating ${field} = ${JSON.stringify(poison)} on a ${shape}`
          );
        }
      }
    }
  }
});

test("PLACEMENT_PARAMS is exactly what generateHoles reads", () => {
  // The sweep may not see a param ADDED to generateHoles and forgotten here, and
  // that would be a silent false negative. This is the guarantee in prose above
  // PLACEMENT_PARAMS, asserted.
  // The function's own text, not the file's: a second function in grid.js that
  // happened to take a params would otherwise fail this and send whoever reads
  // the message hunting in the wrong place.
  const source = generateHoles.toString();

  // The list below only stands for everything generateHoles reads while the one
  // destructuring is the only way it touches its argument. A second `= params;`,
  // a direct `params.foo`, or an `arguments[0].foo` would read an input no list
  // can cover, so pin that first. A mention of either word in a comment inside
  // the function trips these too, deliberately — a false alarm is one line to
  // fix, and the alternative is an AST parser.
  assert.equal(
    (source.match(/\bparams\b/g) || []).length,
    2,
    "generateHoles must mention params exactly twice: its parameter and its one destructuring"
  );
  assert.equal(source.match(/\barguments\b/), null, "generateHoles must not reach its input through arguments");

  // generateHoles' second input is deliberately not a param: it holds a sampler
  // and a nested list, and PLACEMENT_PARAMS is primitives. patternSignature
  // signs it separately, from the same compilePlacement call the layouts read,
  // and the tests below exercise that half.
  assert.match(source, /^function generateHoles\(params, placement = null\) \{/);
  const destructuring = source.match(/^function generateHoles\(params, placement = null\) \{\s*const \{([\s\S]*?)\} = params;/); // prettier-ignore
  assert.ok(destructuring, "could not find generateHoles' destructuring");
  const names = destructuring[1]
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  assert.deepEqual(names, PLACEMENT_PARAMS);
});

test("no module let, var or ambient global in generateHoles' import closure", () => {
  // The other half of the claim above PLACEMENT_PARAMS: a value that changes
  // underneath generateHoles is a placement input arriving from outside params,
  // and neither the sweep nor the list can see one — it holds the same value in
  // both documents being compared.
  //
  // Read the test's name literally. It scans for two spellings of that mistake,
  // and a scan cannot prove purity: `const cfg = {}` mutated through an exported
  // setter, a pushed-to array, a class static, an IIFE closure, all defeat it
  // while moving holes. There is no assertion that catches those — a channel a
  // future edit merely *could* use produces identical output today, so nothing
  // behavioural sees it either. What this buys is that the two forms a
  // maintainer reaches for first fail loudly, and that the closure it scans is
  // the real one. Treat a failure as a design question, not a lint to satisfy by
  // rewriting the `let` as a const object — that spelling is the hole.
  //
  // One false alarm is known and deliberate: a pure module-level memo
  // (`let cache = new Map()`) trips it.
  //
  // Comments are stripped first, both kinds. Not to be tidy: the scan below
  // matches the bare words `document`, `window` and `process`, and prose about
  // what a document holds is on nearly every file here. A `//` inside a string
  // literal would be mangled by the second strip, and none of these files has
  // one — the same assumption the block-comment strip has always made.
  const source = url =>
    readFileSync(url, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
  const closure = new Map();
  const walk = url => {
    if (closure.has(url.href)) return;
    const src = source(url);
    closure.set(url.href, src);
    // `export ... from` as well as `import`: src/ui/controls/index.js is a
    // barrel built entirely of re-exports, so the idiom is already in the repo
    // and would otherwise route a helper past this walk unseen. Block comments
    // are stripped above for the same reason — one before an import hides it.
    for (const found of src.matchAll(/^\s*(?:import|export)[^"']*["'](\.[^"']+)["']/gm)) walk(new URL(found[1], url));
  };
  walk(new URL("../layouts/index.js", import.meta.url));

  // The exact list, not a count: in both escapes above the closure stayed at
  // five files while the true dependency set was six, so a floor said nothing.
  const root = new URL("../../", import.meta.url).href;
  const files = [...closure.keys()].map(href => href.slice(root.length)).sort();
  assert.deepEqual(files, [
    "src/core/math.js",
    "src/core/rng.js",
    "src/geometry/polygon.js",
    "src/geometry/rounded-rect.js",
    "src/geometry/spatial-hash.js",
    "src/layouts/crosshatch.js",
    "src/layouts/fibonacci.js",
    "src/layouts/field-sampling.js",
    "src/layouts/grid.js",
    "src/layouts/index.js",
    "src/layouts/lattice.js",
    "src/layouts/path.js",
    "src/layouts/radial-engine.js",
    "src/layouts/scatter.js",
    "src/layouts/spiral.js",
    "src/layouts/voronoi.js",
  ]);

  for (const [href, src] of closure) {
    const name = href.slice(root.length);
    const mutable = src.match(/^(?:export\s+)?(?:let|var)\s+\w+/m);
    assert.equal(mutable, null, `${name} declares \`${mutable?.[0]}\` at module level`);
    // Ambient state reaches generateHoles without passing through any module
    // binding at all, so the scan above cannot see it. Math and the rest of the
    // deterministic globals are fine; these are not.
    const ambient = src.match(/\b(?:globalThis|window|document|process|self|Math\.random|Date\.now|performance)\b/);
    assert.equal(ambient, null, `${name} reads \`${ambient?.[0]}\`, which no document controls`);
  }
});

// ─── Phase 2: field controllers ───────────────────────────────────────

const controller = (patch = {}) => ({
  id: "c1",
  channel: "size",
  kind: "point",
  enabled: true,
  geometry: { points: [{ x: 100, y: 100 }] }, // the centre of the default 200×200 sheet
  target: 1.6,
  radius: 60,
  falloff: "smooth",
  oneSided: 0,
  strength: 1,
  syncWith: null,
  image: null,
  ...patch,
});
const withField = (controllers, patch = {}) =>
  doc({ "fields.enabled": true, "fields.controllers": controllers, ...patch });

test("a disabled fields block leaves the pattern exactly where it was", () => {
  const off = computePattern(doc({ "fields.controllers": [controller()] })); // enabled defaults to false
  const base = computePattern(createDocument());
  assert.equal(off.activeHoles.length, base.activeHoles.length);
  assert.equal(fixed(off.stats.displayOAR), fixed(base.stats.displayOAR));
  assert.equal(off.stats.useCountedOAR, false);
  // And so does an enabled block with nothing in it.
  const empty = computePattern(doc({ "fields.enabled": true }));
  assert.equal(empty.stats.useCountedOAR, false);
  assert.equal(fixed(empty.stats.displayOAR), fixed(base.stats.displayOAR));
});

test("a size controller grows the holes it reaches and lifts the open area", () => {
  const base = computePattern(createDocument());
  const { holes, stats } = computePattern(withField([controller({ target: 1.6, radius: 60 })]));
  assert.equal(holes.length, base.holes.length, "size never adds or drops a hole");
  const at = (x, y) => holes.reduce((best, h) => (Math.hypot(h.x - x, h.y - y) < Math.hypot(best.x - x, best.y - y) ? h : best)); // prettier-ignore
  const middle = at(100, 100);
  const corner = at(5, 5);
  assert.ok(middle.w > 7.9 && middle.w < 8.01, `centre hole should be ~1.6× of 5 mm, got ${middle.w}`);
  assert.ok(Math.abs(corner.w - 5) < 1e-9, `a hole outside the reach must keep its size, got ${corner.w}`);
  assert.ok(middle.area > corner.area * 2.5);
  // The unit-cell shortcut is off, and the counted area went up.
  assert.equal(stats.useCountedOAR, true);
  assert.ok(stats.displayOAR > base.stats.displayOAR, `${stats.displayOAR} should exceed ${base.stats.displayOAR}`);
});

test("an angle controller turns the holes it reaches, and only shapes that can turn", () => {
  const rect = { "hole.shape": "Rectangle", "hole.w": 8, "hole.h": 3, "layout.type": "Straight" };
  const { holes } = computePattern(withField([controller({ channel: "angle", target: 90, radius: 60 })], rect));
  const at = (x, y) => holes.reduce((best, h) => (Math.hypot(h.x - x, h.y - y) < Math.hypot(best.x - x, best.y - y) ? h : best)); // prettier-ignore
  assert.ok(Math.abs(at(100, 100).angle - Math.PI / 2) < 1e-9, "the centre rectangle should stand on end");
  assert.ok(!at(5, 5).angle, "a rectangle outside the reach keeps its own rotation");
  // A circle cannot show a rotation, so it is not given one — an angle it cannot
  // draw would still widen the box estimateVisibleHoleArea samples over.
  const circles = computePattern(withField([controller({ channel: "angle", target: 90, radius: 60 })]));
  assert.ok(circles.holes.every(h => !h.angle));
});

test("a shape controller morphs the superellipse and leaves the fixed shapes alone", () => {
  const superDoc = { "hole.shape": "Superellipse", "hole.shapeMix": 0.5 };
  const { holes, stats } = computePattern(
    withField([controller({ channel: "shape", target: 1, radius: 60 })], superDoc)
  );
  const at = (x, y) => holes.reduce((best, h) => (Math.hypot(h.x - x, h.y - y) < Math.hypot(best.x - x, best.y - y) ? h : best)); // prettier-ignore
  assert.ok(Math.abs(at(100, 100).superN - 8) < 1e-9, "the centre hole should reach the near-square end");
  assert.ok(Math.abs(at(5, 5).superN - 2) < 1e-9, "a hole outside the reach keeps the document's own mix");
  // Squarer holes of the same width cover more area.
  assert.ok(at(100, 100).area > at(5, 5).area);
  assert.equal(stats.useCountedOAR, true);
  // The same controller over Circles does nothing: only Superellipse morphs.
  const circles = computePattern(withField([controller({ channel: "shape", target: 1, radius: 60 })]));
  assert.ok(circles.holes.every(h => h.superN === undefined));
  assert.equal(fixed(circles.stats.displayOAR), fixed(computePattern(createDocument()).stats.displayOAR));
});

test("the superellipse document computes and exports like any other shape", () => {
  for (const mix of [0, 0.5, 1]) {
    const { stats, activeHoles, params } = computePattern(doc({ "hole.shape": "Superellipse", "hole.shapeMix": mix }));
    assert.ok(activeHoles.length > 0);
    assert.ok(stats.displayOAR > 0 && stats.displayOAR <= 100, `mix ${mix}: OAR ${stats.displayOAR}`);
    assert.ok(stats.minLigament >= 0);
    assert.ok(activeHoles.every(h => Number.isFinite(h.area) && h.area > 0));
    const svg = generateSVGString(activeHoles, params);
    assert.equal(svg.match(/<polygon /g).length, activeHoles.length);
  }
  // The mix moves the area monotonically, which is what makes it a usable slider.
  const area = mix => computePattern(doc({ "hole.shape": "Superellipse", "hole.shapeMix": mix })).stats.singleHoleArea;
  assert.ok(area(0) < area(0.5) && area(0.5) < area(1));
});

test("the size, angle and shape channels never invalidate the removed-hole indices", () => {
  // None of the three moves a centre, so the removals a user made survive
  // adding, editing and enabling one. This is the property that keeps `fields`
  // out of PLACEMENT_PARAMS — and the spacing channel is exactly the one that
  // does not have it, which the next test is about.
  const base = doc({ removedHoles: [4, 9] });
  for (const patch of [
    { "fields.enabled": true },
    { "fields.controllers": [controller()] },
    { "fields.enabled": true, "fields.controllers": [controller({ channel: "angle", target: 90 })] },
    { "hole.shapeMix": 0.9 },
    { assets: { a: { name: "x", dataURL: "data:image/png;base64,AAAA", width: 1, height: 1 } } },
  ]) {
    assert.equal(patternSignature(patchIn(base, patch)), patternSignature(base), JSON.stringify(patch));
  }
  // But the morph shape itself is a shape swap, and that does move holes.
  assert.notEqual(patternSignature(doc({ "hole.shape": "Superellipse" })), patternSignature(createDocument()));
});

// ─── Phase 3: the spacing channel ─────────────────────────────────────

const spacing = (patch = {}) => controller({ id: "s1", channel: "spacing", target: 2, radius: 70, ...patch });
const withSpacing = (base, controllers) => patchIn(base, { "fields.enabled": true, "fields.controllers": controllers });

test("every spacing edit that moves a hole changes the signature", () => {
  // The same contract the placement params carry, for the input that is not one.
  // generateHoles takes (params, spacing), so a signature over params alone would
  // hold removals across a controller drag that moved every hole under them —
  // and there would be no undo step pointing back at the arrangement they meant.
  const positions = d => JSON.stringify(generateHoles(buildParams(d, deriveGeometry(d)), compilePlacement(d)));
  const bases = [
    { "layout.type": "Straight" },
    { "layout.type": "Staggered 60°" },
    { "layout.type": "Cross-hatch" },
    { "layout.type": "Scatter" },
    { "layout.type": "Spiral" },
    { "layout.type": "Fibonacci" },
  ];
  const fields = [
    [],
    [spacing()],
    [spacing({ target: 0.5 })],
    [spacing({ target: 2.0001 })],
    [spacing({ radius: 71 })],
    [spacing({ strength: 0.5 })],
    [spacing({ falloff: "linear" })],
    [spacing({ geometry: { points: [{ x: 101, y: 100 }] } })],
    [spacing({ kind: "line", geometry: { points: [{ x: 40, y: 40 }, { x: 160, y: 160 }] } })], // prettier-ignore
    [spacing({ kind: "line", geometry: { points: [{ x: 40, y: 40 }, { x: 160, y: 160 }] }, oneSided: 1 })], // prettier-ignore
    [spacing(), spacing({ id: "s2", geometry: { points: [{ x: 40, y: 40 }] } })],
    // A spacing controller borrowing a size controller's geometry: editing the
    // SIZE controller now moves holes, and the signature has to see it.
    [controller({ id: "c1", channel: "size", geometry: { points: [{ x: 60, y: 60 }] } }), spacing({ id: "s2", syncWith: "c1" })], // prettier-ignore
    [controller({ id: "c1", channel: "size", geometry: { points: [{ x: 150, y: 150 }] } }), spacing({ id: "s2", syncWith: "c1" })], // prettier-ignore
  ];
  let moved = 0;
  for (const basePatch of bases) {
    const documents = fields.map(controllers => withSpacing(doc(basePatch), controllers));
    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        if (positions(documents[i]) === positions(documents[j])) continue;
        moved++;
        assert.notEqual(
          patternSignature(documents[i]),
          patternSignature(documents[j]),
          `${JSON.stringify(basePatch)}: fields ${i} and ${j} place different holes but sign the same`
        );
      }
    }
  }
  assert.ok(moved > 200, `expected the sweep to move holes often, got ${moved}`);
});

test("a spacing controller a mode ignores does not move the readout either", () => {
  // The counted and theoretical open-area figures disagree slightly on identical
  // geometry, so a controller that changes nothing must not flip the path — the
  // headline number would move without a hole moving. Radial and the three
  // uniform-ligament tilings all ignore the channel.
  for (const patch of [
    { "layout.type": "Radial" },
    { "hole.shape": "Hexagon" },
    { "hole.shape": "Diamond" },
    { "hole.shape": "Triangle", "layout.type": "Straight" },
  ]) {
    const bare = computePattern(doc(patch));
    const field = computePattern(withSpacing(doc(patch), [spacing({ target: 0.4 })]));
    assert.equal(field.activeHoles.length, bare.activeHoles.length, JSON.stringify(patch));
    assert.equal(field.stats.useCountedOAR, bare.stats.useCountedOAR, JSON.stringify(patch));
    assert.equal(fixed(field.stats.displayOAR), fixed(bare.stats.displayOAR), JSON.stringify(patch));
  }
  // And a mode that DOES read it goes onto the counted path, because a stretched
  // lattice has no unit cell left to divide by.
  const straight = computePattern(doc({ "layout.type": "Straight" }));
  const stretched = computePattern(withSpacing(doc({ "layout.type": "Straight" }), [spacing({ target: 2 })]));
  assert.equal(straight.stats.useCountedOAR, false);
  assert.equal(stretched.stats.useCountedOAR, true);
  assert.ok(stretched.activeHoles.length < straight.activeHoles.length);
});

test("the new layout modes report an honest open area", () => {
  // Cross-hatch has a unit cell — a parallelogram, not pitch × pitch — so it may
  // use the theoretical figure; Scatter, Spiral and Fibonacci have no lattice at
  // all and must count.
  const cross = computePattern(doc({ "layout.type": "Cross-hatch" }));
  assert.equal(cross.stats.useCountedOAR, false);
  // Right-angled families give the straight grid's rectangular cell back.
  const right = computePattern(
    doc({ "layout.type": "Cross-hatch", "layout.crosshatch.angleA": 90, "layout.crosshatch.angleB": 0 })
  );
  assert.equal(fixed(right.stats.displayOAR), fixed(computePattern(doc({ "layout.type": "Straight" })).stats.displayOAR)); // prettier-ignore
  // A 60° crossing spreads the same lines over a larger cell, so the open area
  // falls — the ratio is exactly sin 60°, which is what the cell area divides by.
  const sixty = computePattern(
    doc({ "layout.type": "Cross-hatch", "layout.crosshatch.angleA": 90, "layout.crosshatch.angleB": 30 })
  );
  assert.ok(Math.abs(sixty.stats.theoreticalOAR / right.stats.theoreticalOAR - Math.sin(Math.PI / 3)) < 1e-9);

  for (const type of ["Scatter", "Spiral", "Fibonacci"]) {
    assert.equal(computePattern(doc({ "layout.type": type })).stats.useCountedOAR, true, type);
  }
});

test("the staggered unit cell is the lattice that was actually drawn", () => {
  // The staggered modes push their rows apart far enough that the DIAGONAL
  // clearance is the gap that was asked for, which for a hole that is not square
  // lifts the row pitch well above the nominal one. The theoretical open-area
  // ratio used to divide by the nominal cell anyway: a 3 × 8 mm rectangle on
  // Staggered 60° at a 3 mm gap read 77.0% open, and — being a clean infinite
  // pattern — took the theoretical path and put that in the readout. It is
  // 38.0% open.
  //
  // Pinned against the counted figure rather than against a constant, because
  // the counted figure is arrived at completely differently (sampling the holes
  // that are actually there) and the two agreeing IS the property.
  for (const patch of [
    { "hole.shape": "Rectangle", "hole.w": 3, "hole.h": 8, "layout.type": "Staggered 60°" },
    { "hole.shape": "Rectangle", "hole.w": 8, "hole.h": 3, "layout.type": "Staggered 45°" },
    { "hole.shape": "Pill", "hole.w": 9, "hole.h": 3, "layout.type": "Staggered 60°" },
    { "hole.diameter": 5, "layout.type": "Staggered 60°" },
    { "hole.diameter": 4, "layout.type": "Staggered 45°" },
    { "hole.shape": "Hexagon", "layout.type": "Staggered 60°" },
    { "layout.type": "Straight" },
    { "layout.type": "Custom Angle" },
  ]) {
    const { stats } = computePattern(doc(patch));
    assert.ok(
      Math.abs(stats.theoreticalOAR - stats.countedOAR) < 1,
      `${JSON.stringify(patch)}: theoretical ${stats.theoreticalOAR.toFixed(2)} against counted ${stats.countedOAR.toFixed(2)}` // prettier-ignore
    );
  }
});

test("the panel and the generator agree on the lattice", () => {
  // deriveGeometry reports the row pitch the panel prints; generateHoles walks
  // it. They were two independent derivations, and disagreed for Staggered 45°.
  for (const patch of [
    {},
    { "layout.type": "Staggered 45°" },
    { "layout.type": "Straight" },
    { "layout.type": "Custom Angle" },
    { "hole.shape": "Hexagon" },
    { "hole.shape": "Rectangle", "hole.w": 9, "hole.h": 3, "layout.type": "Staggered 45°" },
  ]) {
    const d = doc(patch);
    const g = deriveGeometry(d);
    const holes = generateHoles(buildParams(d, g));
    const rows = [...new Set(holes.map(h => h.y))].sort((a, b) => a - b);
    const drawn = rows[1] - rows[0];
    assert.ok(Math.abs(drawn - g.effPitchY) < 1e-9, `${JSON.stringify(patch)}: drew ${drawn}, reported ${g.effPitchY}`);
    const columns = [...new Set(holes.filter(h => h.y === rows[0]).map(h => h.x))].sort((a, b) => a - b);
    assert.ok(Math.abs(columns[1] - columns[0] - g.inRowPitchX) < 1e-9, JSON.stringify(patch));
  }
});
