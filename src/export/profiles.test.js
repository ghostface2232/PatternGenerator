import test from "node:test";
import assert from "node:assert/strict";
import { manufacturingProfiles, offsetPolygons } from "./profiles.js";
import { ringsArea, ringsBBox } from "../geometry/rings.js";
const params = {
  sheetW: 20,
  sheetH: 20,
  holeShape: "Circle",
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
};
const circle = { x: 10, y: 10, w: 4, h: 4 };
const holes = (h, opts = {}, p = params) => [
  ...manufacturingProfiles([h], p, null, { layers: ["HOLES", "HOLES_EXIT"], ...opts }),
];
test("uncut circles preserve analytic radius; kerf changes radius by half the width", () => {
  assert.equal(holes(circle)[0].r, 2);
  assert.equal(holes(circle, { kerf: 1, kerfDirection: "outward" })[0].r, 2.5);
  assert.equal(holes(circle, { kerf: 1 })[0].r, 1.5);
  assert.equal(holes({ ...circle, w: 1, h: 1 }, { kerf: 2 }).length, 0);
});
test("boundary crossing holes become closed, physically clipped rings", () => {
  const p = holes({ ...circle, x: 0 })[0];
  assert.equal(p.kind, "rings");
  assert.equal(ringsBBox(p.rings).left, 0);
  assert.ok(Math.abs(ringsArea(p.rings) - 2 * Math.PI) < 0.15);
});
test("bottom larger swaps both dimensions and radii, closed top omits only top", () => {
  const p = { ...params, holeShape: "Rectangle", thickness: 2, taperAngle: 5, taperDirection: "Bottom larger" };
  const h = { ...circle, holeRadius: 1, exitW: 2, exitH: 2, exitHoleRadius: 0.4 };
  const out = holes(h, {}, p);
  assert.equal(out[0].r, 0.4);
  assert.equal(out[1].r, 1);
  const closed = holes({ ...h, exitW: 0, exitH: 0 }, {}, p);
  assert.deepEqual(
    closed.map(x => x.layer),
    ["HOLES_EXIT"]
  );
});
test("signed offsets preserve counters and shrink them when expanding holes", () => {
  const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    bore = [
      [3, 3],
      [3, 7],
      [7, 7],
      [7, 3],
    ];
  const out = offsetPolygons([[square, bore]], 1);
  assert.equal(out[0].length, 2);
  assert.ok(ringsArea(out[0]) > 130);
  const inward = offsetPolygons([[square, bore]], -1);
  assert.ok(ringsArea(inward[0]) < 35);
});
test("invalid kerf fails explicitly", () => {
  assert.throws(() => holes(circle, { kerf: NaN }), /Kerf/);
});

test("large kerf offsets remain stable at coincident capsule tangencies", async () => {
  const { createDocument, patchIn } = await import("../core/document.js");
  const { computePattern } = await import("../core/pipeline.js");
  for (const shape of ["Diamond", "Plus", "Cross", "Teardrop"]) {
    const p = computePattern(patchIn(createDocument(), { "sheet.w": 40, "sheet.h": 40, "hole.shape": shape }));
    for (const direction of ["inward", "outward"]) {
      const out = [
        ...manufacturingProfiles(p.activeHoles, p.params, p.region, {
          layers: ["HOLES"],
          kerf: 5,
          kerfDirection: direction,
        }),
      ];
      if (direction === "inward") assert.equal(out.length, 0, shape + " collapses");
      else {
        assert.equal(out.length, p.activeHoles.length, shape);
        assert.ok(out.every(profile => ringsArea(profile.rings) > 0));
      }
    }
  }
});
