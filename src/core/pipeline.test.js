import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, getIn, patchIn, setIn } from "./document.js";
import { PLACEMENT_PARAMS, buildParams, computePattern, deriveGeometry, patternSignature } from "./pipeline.js";
import { validateDocument } from "./persistence.js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateHoles } from "../layouts/grid.js";
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
    // silently keeping removals across a real move. The sliders step by 0.1 but
    // their numeric fields commit raw parseFloat, and a share link or an
    // autosave carries whatever it was given, so this resolution is reachable.
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
});

test("the type tag, field position and quoting each carry their weight", () => {
  // Three ways an encoding of the same values could collapse two documents into
  // one signature. Each is paired with the placement it would wrongly preserve
  // removals across, so none of them can be satisfied by encoding alone.
  // None of the three inputs survives validateDocument — it coerces the numeric
  // string and enum-picks the two radial fields — so these are properties the
  // encoding should hold on its own, not hazards reachable from the app today.
  const base = createDocument();
  // Hashed, not compared whole: a mismatch otherwise prints both hole lists.
  const place = d => createHash("sha1").update(JSON.stringify(generateHoles(buildParams(d, deriveGeometry(d))))).digest("hex"); // prettier-ignore
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
  // portrait sheet and a landscape one alike.
  differ(
    patchIn(base, { "sheet.w": 200, "sheet.h": 300 }),
    patchIn(base, { "sheet.w": 300, "sheet.h": 200 }),
    "two fields must not be interchangeable"
  );

  // Quoting. Joining type-tagged fields on a separator let a string param carry
  // that separator and shift the fields around it. Radial, or the two fields
  // below never reach the placement arithmetic and there is nothing to preserve.
  const NUL = String.fromCharCode(0);
  const radial = patchIn(base, { "layout.type": "Radial" });
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
  const base = createDocument();
  const PRIMITIVE = new Set(["number", "string", "boolean"]);
  // Everything JSON can carry that is not a primitive, plus the shapes a
  // hand-written share link or a stale autosave could hold.
  const poisons = [{}, [], [1, 2], { toString: null }, null, "", "abc", -1e9, 1e9];
  const fields = [
    "sheet.w",
    "sheet.h",
    "hole.diameter",
    "hole.w",
    "hole.h",
    "hole.shape",
    "hole.cornerRadius",
    "hole.diamondOrient",
    "layout.type",
    "layout.customAngle",
    "layout.edgeGapX",
    "layout.edgeGapY",
    "layout.radial.edgeGap",
    "layout.radial.circumGap",
    "layout.radial.mode",
    "layout.radial.layout",
    "layout.radial.centerHole",
    "boundary.margins.top",
    "boundary.margins.left",
    "boundary.cornerRadius",
  ];
  for (const field of fields) {
    for (const poison of poisons) {
      const doc = validateDocument(patchIn(base, { [field]: poison }));
      const params = buildParams(doc, deriveGeometry(doc));
      for (const key of PLACEMENT_PARAMS) {
        assert.ok(
          PRIMITIVE.has(typeof params[key]),
          `${key} is ${typeof params[key]} after validating ${field} = ${JSON.stringify(poison)}`
        );
      }
      assert.doesNotThrow(() => patternSignature(doc), `${field} = ${JSON.stringify(poison)}`);
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
  // can cover, so pin that first. A mention in a comment inside the function
  // trips the count too, deliberately — a false alarm is one line to fix, and
  // the alternative is an AST parser.
  assert.equal(
    (source.match(/\bparams\b/g) || []).length,
    2,
    "generateHoles must mention params exactly twice: its parameter and its one destructuring"
  );
  assert.equal(source.match(/\barguments\b/), null, "generateHoles must not reach its input through arguments");

  const destructuring = source.match(/^function generateHoles\(params\) \{\s*const \{([\s\S]*?)\} = params;/);
  assert.ok(destructuring, "could not find generateHoles' destructuring");
  const names = destructuring[1]
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
  assert.deepEqual(names, PLACEMENT_PARAMS);
});

test("nothing generateHoles depends on holds mutable module state", () => {
  // The other half of the claim above PLACEMENT_PARAMS, and the half no list can
  // stand for: a value that changes underneath generateHoles is a placement
  // input arriving from outside params. Neither the sweep nor the list can see
  // one — it holds the same value in both documents being compared — so a module
  // `let` anywhere in the import closure ships the silent false negative
  // directly. Reached transitively so a new helper is covered on arrival.
  const closure = new Set();
  const walk = url => {
    if (closure.has(url.href)) return;
    closure.add(url.href);
    const src = readFileSync(url, "utf8");
    for (const found of src.matchAll(/^import[^"']*["'](\.[^"']+)["']/gm)) walk(new URL(found[1], url));
  };
  walk(new URL("../layouts/grid.js", import.meta.url));
  assert.ok(closure.size >= 5, `expected the closure to reach the geometry helpers, got ${closure.size} files`);

  for (const href of closure) {
    const name = href.slice(href.indexOf("/src/") + 1);
    const mutable = readFileSync(new URL(href), "utf8").match(/^(?:export\s+)?(?:let|var)\s+\w+/m);
    assert.equal(mutable, null, `${name} declares \`${mutable?.[0]}\` at module level`);
  }
});
