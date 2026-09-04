import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, getIn, patchIn, setIn } from "./document.js";
import { computePattern } from "./pipeline.js";
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
