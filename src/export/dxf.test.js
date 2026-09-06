import test from "node:test";
import assert from "node:assert/strict";
import { generateDXFString, roundedRectVertices } from "./dxf.js";
import { createDocument, patchIn } from "../core/document.js";
import { computePattern } from "../core/pipeline.js";
import { HOLE_SHAPES, PATTERN_TYPES } from "../core/constants.js";
export function entities(text) {
  const lines = text.trim().split(/\r?\n/),
    result = [];
  let current = null,
    inside = false;
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i]),
      value = lines[i + 1];
    if (code === 2 && value === "ENTITIES") {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (code === 0) {
      if (current) result.push(current);
      if (value === "ENDSEC") break;
      current = { type: value, tags: [] };
    } else current?.tags.push([code, value]);
  }
  return result;
}
const value = (e, c) => e.tags.find(t => t[0] === c)?.[1];
const params = { sheetW: 25.4, sheetH: 50.8, holeShape: "Circle" };
const hole = { x: 12.7, y: 10, w: 5.08, h: 5.08 };
test("R2000 header, inch scaling, layers, reflected Y and analytic circles", () => {
  const text = generateDXFString([hole], params, null, { units: "inch" });
  assert.match(text, /\$ACADVER\n1\nAC1015/);
  assert.match(text, /\$INSUNITS\n70\n1/);
  const all = entities(text);
  assert.equal(all.length, 2);
  const c = all.find(e => e.type === "CIRCLE");
  assert.equal(value(c, 8), "HOLES");
  assert.equal(Number(value(c, 40)), 0.1);
  assert.equal(Number(value(c, 10)), 0.5);
  assert.ok(Math.abs(Number(value(c, 20)) - (50.8 - 10) / 25.4) < 1e-9);
  for (const layer of ["OUTLINE", "HOLES", "HOLES_EXIT", "KEEPOUT"]) assert.ok(text.includes(`2\n${layer}\n`));
});
test("rounded rectangles and rotated stadiums carry correct arc bulges", () => {
  for (const [w, h] of [
    [10, 4],
    [4, 10],
    [4, 4],
  ]) {
    const p = { x: 20, y: 30, w, h, r: Math.min(w, h) / 2, angle: 0.7 };
    const vertices = roundedRectVertices(p);
    assert.equal(vertices.filter(v => v[2] > 0).length, 4);
    const text = generateDXFString([{ ...p, holeRadius: 1 }], { sheetW: 100, sheetH: 100, holeShape: "Pill" }, null, {
      layers: ["HOLES"],
    });
    const e = entities(text)[0];
    assert.equal(e.type, "LWPOLYLINE");
    assert.equal(value(e, 70), "1");
    assert.equal(e.tags.filter(t => t[0] === 42).length, 4);
    assert.ok(e.tags.filter(t => t[0] === 42).every(t => Number(t[1]) < 0));
  }
});
test("layer filters and taper preserve only requested side", () => {
  const text = generateDXFString(
    [{ ...hole, exitW: 2, exitH: 2 }],
    { ...params, thickness: 2, taperAngle: 5, taperDirection: "Bottom larger" },
    null,
    { layers: ["HOLES_EXIT"] }
  );
  const es = entities(text);
  assert.equal(es.length, 1);
  assert.equal(value(es[0], 8), "HOLES_EXIT");
  assert.equal(Number(value(es[0], 40)), hole.w / 2);
});
test("every supported shape and layout produces finite closed CAD entities", () => {
  for (const patch of [
    ...HOLE_SHAPES.map(shape => ({ "hole.shape": shape })),
    ...PATTERN_TYPES.map(type => ({ "layout.type": type })),
  ]) {
    const p = computePattern(patchIn(createDocument(), { "sheet.w": 40, "sheet.h": 40, ...patch }));
    const text = generateDXFString(p.activeHoles, p.params, p.region);
    assert.doesNotMatch(text, /NaN|Infinity/);
    const es = entities(text);
    assert.ok(es.length > 0);
    for (const e of es) if (e.type === "LWPOLYLINE") assert.equal(value(e, 70), "1");
  }
});
