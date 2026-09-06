import test from "node:test";
import assert from "node:assert/strict";
import { applyTransform, multiplyTransform, parseSVGOutline, parseTransform, pathToPolylines } from "./svg-path.js";
import { normalizeRings, ringsArea, ringsBBox } from "./rings.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("path commands: absolute, relative, shorthand, and closing", () => {
  const [square] = pathToPolylines("M 0 0 L 10 0 L 10 10 L 0 10 Z");
  assert.equal(square.closed, true);
  assert.deepEqual(square.points, [[0, 0], [10, 0], [10, 10], [0, 10]]); // prettier-ignore
  const [rel] = pathToPolylines("m 5 5 l 10 0 v 10 h -10 z");
  assert.deepEqual(rel.points, [[5, 5], [15, 5], [15, 15], [5, 15]]); // prettier-ignore
  // Implicit line-to after a move, and a second subpath.
  const two = pathToPolylines("M0,0 10,0 10,10Z M20,20 30,20 30,30");
  assert.equal(two.length, 2);
  assert.equal(two[0].closed, true);
  assert.equal(two[1].closed, false);
  assert.deepEqual(two[1].points, [[20, 20], [30, 20], [30, 30]]); // prettier-ignore
  // Numbers glued together, exponents and leading dots all tokenize.
  const [glued] = pathToPolylines("M0-1L.5e1 2.5-3 4Z");
  assert.deepEqual(glued.points, [[0, -1], [5, 2.5], [-3, 4]]); // prettier-ignore
  // A subpath begun by a line after Z starts where the last one started.
  const afterZ = pathToPolylines("M0 0 L10 0 L10 10 Z L0 10 L-10 0 Z");
  assert.equal(afterZ.length, 2);
  assert.deepEqual(afterZ[1].points, [[0, 0], [0, 10], [-10, 0]]); // prettier-ignore
  assert.equal(afterZ[1].closed, true);
});

test("curves are flattened within the tolerance, tighter at a finer one", () => {
  // A quarter circle as the standard cubic approximation, radius 10.
  const k = 0.5522847498;
  const d = `M 10 0 C 10 ${10 * k} ${10 * k} 10 0 10`;
  for (const tolerance of [0.5, 0.05, 0.005]) {
    const [arc] = pathToPolylines(d, undefined, tolerance);
    for (const [x, y] of arc.points) near(Math.hypot(x, y), 10, tolerance + 0.03);
    assert.deepEqual(arc.points[arc.points.length - 1], [0, 10]);
  }
  assert.ok(pathToPolylines(d, undefined, 0.005)[0].points.length > pathToPolylines(d, undefined, 0.5)[0].points.length); // prettier-ignore
  // Quadratics, and the T shorthand reflecting the last control point.
  const [quad] = pathToPolylines("M 0 0 Q 5 10 10 0 T 20 0", undefined, 0.01);
  assert.deepEqual(quad.points[quad.points.length - 1], [20, 0]);
  const peak = Math.max(...quad.points.map(p => p[1]));
  near(peak, 5, 0.05); // a quadratic through (5, 10) peaks at half the control height
  const valley = Math.min(...quad.points.map(p => p[1]));
  near(valley, -5, 0.05); // the reflected control point mirrors it below the axis
  // The S shorthand reflects the previous cubic's second control point.
  const [smooth] = pathToPolylines("M 0 0 C 0 5 5 5 5 0 S 10 -5 10 0", undefined, 0.01);
  assert.deepEqual(smooth.points[smooth.points.length - 1], [10, 0]);
});

test("arcs follow the endpoint parameterisation, flags glued or not", () => {
  // A full circle of radius 5 drawn as two half-turns.
  const circle = pathToPolylines("M 5 0 A 5 5 0 1 1 -5 0 A 5 5 0 1 1 5 0 Z", undefined, 0.01)[0];
  for (const [x, y] of circle.points) near(Math.hypot(x, y), 5, 0.02);
  near(ringsArea(normalizeRings([circle.points])), Math.PI * 25, Math.PI * 25 * 0.01);
  // The same with the flags run together, as Illustrator writes them.
  const glued = pathToPolylines("M5 0A5 5 0 11-5 0A5 5 0 115 0Z", undefined, 0.01)[0];
  assert.equal(glued.points.length, circle.points.length);
  // The sweep flag picks which way round: sweep 1 is clockwise on screen, and
  // clockwise from the left of a circle goes over the top (negative y).
  const below = pathToPolylines("M 0 0 A 5 5 0 0 0 10 0", undefined, 0.01)[0];
  const above = pathToPolylines("M 0 0 A 5 5 0 0 1 10 0", undefined, 0.01)[0];
  assert.ok(below.points.some(p => p[1] > 4));
  assert.ok(above.points.some(p => p[1] < -4));
  // A radius too small to reach is scaled up rather than producing nothing.
  const scaled = pathToPolylines("M 0 0 A 1 1 0 0 1 10 0", undefined, 0.01)[0];
  assert.deepEqual(scaled.points[scaled.points.length - 1], [10, 0]);
  assert.ok(scaled.points.length > 3);
});

test("transforms compose the way SVG applies them", () => {
  near(applyTransform(parseTransform("translate(10 5)"), 1, 1)[0], 11);
  near(applyTransform(parseTransform("scale(2)"), 1, 1)[1], 2);
  near(applyTransform(parseTransform("scale(2 3)"), 1, 1)[1], 3);
  const rotated = applyTransform(parseTransform("rotate(90)"), 1, 0);
  near(rotated[0], 0);
  near(rotated[1], 1);
  const about = applyTransform(parseTransform("rotate(90 10 10)"), 10, 0);
  near(about[0], 20);
  near(about[1], 10);
  // translate then scale: the point is scaled first, then moved — left to right.
  const both = applyTransform(parseTransform("translate(10 0) scale(2)"), 1, 0);
  near(both[0], 12);
  near(applyTransform(parseTransform("matrix(1 0 0 1 3 4)"), 0, 0)[1], 4);
  const m = multiplyTransform(parseTransform("translate(1 2)"), parseTransform("scale(3)"));
  near(applyTransform(m, 1, 1)[0], 4);
});

test("an SVG file yields its closed outlines with physical units and transforms applied", () => {
  const file = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 200 100">
  <defs><rect id="unused" x="0" y="0" width="50" height="50"/></defs>
  <g transform="translate(10 10)">
    <rect x="0" y="0" width="80" height="40"/>
    <circle cx="140" cy="20" r="10" transform="scale(1 2)"/>
    <path d="M 0 60 h 20 v 20 h -20 z M 5 65 h 10 v 10 h -10 z"/>
    <polyline points="0,0 10,10"/>
  </g>
  <ellipse cx="50" cy="90" rx="8" ry="4"/>
</svg>`;
  const { shapes, scale, viewBox, isSVG } = parseSVGOutline(file, 0.01);
  assert.equal(isSVG, true);
  near(scale, 0.5); // 100 mm over 200 user units
  assert.deepEqual(viewBox, [0, 0, 200, 100]);
  assert.deepEqual(
    shapes.map(s => s.tag),
    ["rect", "circle", "path", "ellipse"]
  );
  // The rect is translated by the group.
  assert.deepEqual(ringsBBox(shapes[0].rings), { left: 10, right: 90, top: 10, bottom: 50 });
  // The circle is stretched by its own transform, then moved by the group's.
  const circleBox = ringsBBox(shapes[1].rings);
  near(circleBox.left, 140, 0.01);
  near(circleBox.top, 30, 0.01);
  near(circleBox.bottom, 70, 0.01);
  // Both subpaths of the path close, and they nest: a square with a square hole.
  assert.equal(shapes[2].rings.length, 2);
  near(ringsArea(normalizeRings(shapes[2].rings)), 400 - 100);
  // The polyline was open and the defs rect was never drawn.
  assert.ok(!shapes.some(s => s.tag === "polyline"));
  assert.equal(shapes.length, 4);
});

test("a file with no physical unit reports no scale, and a non-SVG file reports nothing", () => {
  const px = parseSVGOutline('<svg width="100" height="100"><rect width="10" height="10"/></svg>');
  assert.equal(px.scale, null);
  assert.equal(px.shapes.length, 1);
  const pxUnit = parseSVGOutline('<svg width="100px" viewBox="0 0 50 50"><rect width="10" height="10"/></svg>');
  assert.equal(pxUnit.scale, null);
  const inches = parseSVGOutline('<svg width="2in" viewBox="0 0 100 100"><rect width="10" height="10"/></svg>');
  near(inches.scale, 0.508);
  const noBox = parseSVGOutline('<svg width="30mm"><rect width="10" height="10"/></svg>');
  near(noBox.scale, 1);
  // A viewBox taller than the viewport is fitted inside it (xMidYMid meet),
  // so the height decides; a height alone decides too.
  const tall = parseSVGOutline('<svg width="100mm" height="100mm" viewBox="0 0 50 200"><rect width="10" height="10"/></svg>'); // prettier-ignore
  near(tall.scale, 0.5);
  const heightOnly = parseSVGOutline('<svg height="4cm" viewBox="0 0 80 80"><rect width="10" height="10"/></svg>');
  near(heightOnly.scale, 0.5);
  const text = parseSVGOutline("just some text");
  assert.equal(text.isSVG, false);
  assert.equal(text.shapes.length, 0);
  // Quoting either way, and a rounded rectangle's corners are arcs.
  const single = parseSVGOutline("<svg width='10mm' viewBox='0 0 10 10'><rect x='0' y='0' width='10' height='10' rx='2'/></svg>", 0.001); // prettier-ignore
  near(ringsArea(single.shapes[0].rings), 100 - 4 * 4 + Math.PI * 4, 0.05);
});
