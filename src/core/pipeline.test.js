import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, getIn, patchIn, setIn } from "./document.js";
import { buildParams, computePattern, deriveGeometry, patternSignature } from "./pipeline.js";
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
