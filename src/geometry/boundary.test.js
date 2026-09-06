import test from "node:test";
import assert from "node:assert/strict";
import { compileBoundary, createCutout, estimateVisibleHoleArea, regionFromParams } from "./boundary.js";
import { isInsidePoly } from "./polygon.js";
import { ringsArea } from "./rings.js";
import { createDocument, patchIn } from "../core/document.js";
import { buildParams, deriveGeometry } from "../core/pipeline.js";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sheet = { w: 200, h: 100 };
const block = (patch = {}) => ({
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  marginLinked: true,
  cornerRadius: 0,
  shape: "Rectangle",
  rings: [],
  cutouts: [],
  trim: false,
  ...patch,
});
// Counted area on a lattice, for checking a region's own figure against its
// containment test.
function counted(region, n = 400) {
  let inside = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (region.contains(((i + 0.5) * sheet.w) / n, ((j + 0.5) * sheet.h) / n)) inside++;
    }
  }
  return (inside * sheet.w * sheet.h) / (n * n);
}

test("the rectangle region is the rectangle every document had", () => {
  const plain = compileBoundary(sheet, block());
  assert.equal(plain.kind, "rect");
  assert.equal(plain.isPlainRect, true);
  assert.equal(plain.clips, false);
  assert.equal(plain.simple, true);
  near(plain.area, 20000);
  assert.deepEqual(plain.frame, { xMin: 0, xMax: 200, yMin: 0, yMax: 100 });
  assert.equal(plain.contains(1, 1), true);
  assert.equal(plain.contains(-1, 1), false);
  assert.equal(plain.svg(), '<rect x="0.000" y="0.000" width="200.000" height="100.000" rx="0.000" ry="0.000" />');

  const inset = compileBoundary(sheet, block({ margins: { top: 5, bottom: 5, left: 10, right: 10 }, cornerRadius: 8 }));
  assert.equal(inset.clips, true);
  assert.equal(inset.isPlainRect, true, "margins and a corner radius are still the plain rectangle");
  near(inset.area, 180 * 90 - (4 - Math.PI) * 64);
  assert.equal(inset.contains(10.5, 5.5), false, "a rounded corner is metal");
  assert.equal(inset.contains(20, 20), true);
  // The legacy entry point builds the same region from a params record.
  const d = patchIn(createDocument(), { "boundary.margins.top": 5, "boundary.cornerRadius": 8 });
  const legacy = regionFromParams(buildParams(d, deriveGeometry(d)));
  near(legacy.area, deriveGeometry(d).region.area);
  assert.equal(legacy.svg(), deriveGeometry(d).region.svg());
});

test("the ellipse is inscribed in the margin rectangle, with an exact area", () => {
  const region = compileBoundary(
    sheet,
    block({ shape: "Ellipse", margins: { top: 10, bottom: 10, left: 0, right: 0 } })
  );
  assert.equal(region.kind, "ellipse");
  assert.equal(region.isPlainRect, false);
  assert.equal(region.clips, true);
  near(region.area, (Math.PI * 200 * 80) / 4);
  assert.equal(region.contains(100, 50), true);
  assert.equal(region.contains(2, 12), false, "the corner of the rectangle is outside the ellipse");
  assert.equal(region.contains(199, 50), true);
  assert.ok(Math.abs(counted(region) - region.area) < region.area * 0.01);
  assert.match(region.svg(), /^<ellipse cx="100.000" cy="50.000" rx="100.000" ry="40.000" \/>$/);
  // The polygon form follows the curve closely enough for a clip path.
  near(ringsArea(region.rings), region.area, region.area * 0.001);
  assert.equal(region.classifyBox(90, 45, 110, 55), "inside");
  assert.equal(region.classifyBox(0, 10, 10, 20), "outside");
  assert.equal(region.classifyBox(0, 45, 10, 55), "mixed");
});

test("a polygon boundary reads its rings by the even-odd rule and ends at the sheet", () => {
  // An L that runs off the right of the sheet, plus a square counter inside it.
  const L = [[20, 20], [260, 20], [260, 60], [120, 60], [120, 90], [20, 90]]; // prettier-ignore
  const counter = [[40, 30], [60, 30], [60, 50], [40, 50]]; // prettier-ignore
  const region = compileBoundary(sheet, block({ shape: "Polygon", rings: [L, counter] }));
  assert.equal(region.kind, "polygon");
  assert.equal(region.isPlainRect, false);
  assert.deepEqual(region.frame, { xMin: 20, xMax: 200, yMin: 20, yMax: 90 });
  assert.equal(region.contains(30, 70), true);
  assert.equal(region.contains(150, 70), false, "the notch");
  assert.equal(region.contains(50, 40), false, "the counter");
  assert.equal(region.contains(230, 40), false, "off the sheet");
  assert.equal(region.contains(190, 40), true);
  // The indexed containment is the plain even-odd test, everywhere.
  for (let x = 0; x <= 200; x += 7) {
    for (let y = 0; y <= 100; y += 3) {
      const expected = x <= 200 && isInsidePoly(x, y, L) !== isInsidePoly(x, y, counter);
      assert.equal(region.contains(x, y), expected, `(${x}, ${y})`);
    }
  }
  // Area: the L clipped to the sheet, less the counter.
  near(region.area, 180 * 40 + 100 * 30 - 400);
  assert.match(region.svg(), /fill-rule="evenodd"/);
  // A polygon with nothing drawn is the rectangle, so the shape switch alone
  // does not empty the sheet.
  const bare = compileBoundary(sheet, block({ shape: "Polygon" }));
  assert.equal(bare.kind, "rect");
  assert.equal(bare.isPlainRect, true);
  // A figure of eight whose lobes cancel is still an outline — two triangles
  // under the even-odd rule — not a reason to fall back to the rectangle.
  const bowTie = compileBoundary(sheet, block({ shape: "Polygon", rings: [[[10, 10], [90, 90], [90, 10], [10, 90]]] })); // prettier-ignore
  assert.equal(bowTie.kind, "polygon");
  assert.equal(bowTie.contains(30, 50), true, "in the left lobe");
  assert.equal(bowTie.contains(50, 30), false, "in the pinch");
  near(bowTie.area, 3200, 1);
});

test("cutouts are taken out of the region, and the area says so", () => {
  const cutouts = [createCutout("Circle", 100, 50, 20), createCutout("Rectangle", 40, 50, 10, [createCutout("Circle", 0, 0, 1)])]; // prettier-ignore
  cutouts[1].h = 30;
  cutouts[1].rotation = 90;
  assert.notEqual(cutouts[0].id, cutouts[1].id);
  const region = compileBoundary(sheet, block({ shape: "Ellipse", cutouts }));
  assert.equal(region.isPlainRect, false);
  assert.equal(region.simple, false);
  assert.equal(region.contains(100, 50), false, "inside the round cutout");
  assert.equal(region.contains(100, 61), true, "just past its rim");
  assert.equal(region.contains(50, 50), false, "inside the turned rectangle");
  assert.equal(region.contains(40, 57), true, "the rectangle is 10 tall after its quarter turn");
  assert.equal(region.contains(48, 53), false, "and 30 wide");
  near(region.area, (Math.PI * 200 * 100) / 4 - Math.PI * 100 - 300, 5); // flattened at 0.02 mm
  assert.ok(Math.abs(counted(region) - region.area) < region.area * 0.01);
  // Clearance: the flow-lines question, answered against the cutout's edge.
  assert.equal(region.containsWithClearance(100, 63, 2), true);
  assert.equal(region.containsWithClearance(100, 62, 3), false);
  assert.equal(region.containsWithClearance(100, 2, 3), false, "and against the outline");
  // The box classifier sees a cutout: a box across its rim is mixed.
  assert.equal(region.classifyBox(95, 45, 105, 55), "outside");
  assert.equal(region.classifyBox(105, 45, 115, 55), "mixed");
  assert.equal(region.classifyBox(140, 45, 150, 55), "inside");
  assert.match(region.svg(), /clip-rule="evenodd"/);
  assert.equal(region.svgCutouts().length, 2);
  // A polygon cutout works the same way, and the signature sees every cutout.
  const withPolygon = compileBoundary(sheet, block({ cutouts: [createCutout("Polygon", 150, 50, 20)] }));
  assert.equal(withPolygon.contains(150, 50), false);
  assert.equal(withPolygon.contains(150, 62), true);
  assert.notEqual(withPolygon.signature, region.signature);
  assert.notEqual(compileBoundary(sheet, block()).signature, compileBoundary(sheet, block({ shape: "Ellipse" })).signature); // prettier-ignore
});

test("Radial's circle fill inscribes a circle in whichever outline is on", () => {
  const rect = compileBoundary(sheet, block(), true);
  near(rect.area, Math.PI * 50 * 50);
  assert.equal(rect.contains(100, 2), true);
  assert.equal(rect.contains(2, 50), false);
  assert.match(rect.svg(), /^<circle /);
  const ellipse = compileBoundary(sheet, block({ shape: "Ellipse" }), true);
  near(ellipse.area, Math.PI * 50 * 50);
  const cut = compileBoundary(sheet, block({ cutouts: [createCutout("Circle", 100, 50, 10)] }), true);
  near(cut.area, Math.PI * 50 * 50 - Math.PI * 25, 5);
});

test("a hole's visible area is what lies inside the region", () => {
  const region = compileBoundary(sheet, block({ cutouts: [createCutout("Circle", 100, 50, 20)] }));
  const hole = (x, y) => ({ x, y, w: 4, h: 4, area: Math.PI * 4, exitW: 4, exitH: 4, exitArea: Math.PI * 4, holeRadius: 0 }); // prettier-ignore
  near(estimateVisibleHoleArea(hole(50, 50), "Circle", region), Math.PI * 4);
  assert.equal(estimateVisibleHoleArea(hole(100, 50), "Circle", region), 0);
  // Astride the cutout's rim: about half.
  const half = estimateVisibleHoleArea(hole(110, 50), "Circle", region);
  assert.ok(half > Math.PI * 4 * 0.35 && half < Math.PI * 4 * 0.65, `${half}`);
  // And astride the sheet's own edge, where the plain rectangle used to be the
  // only boundary there was.
  const edge = estimateVisibleHoleArea(hole(0, 50), "Circle", compileBoundary(sheet, block()));
  near(edge, Math.PI * 2, 0.5);
});
