import test from "node:test";
import assert from "node:assert/strict";
import { createDocument, patchIn } from "../core/document.js";
import { computePattern } from "../core/pipeline.js";
import { generateSVGParts, generateSVGString } from "./svg.js";

const render = patch => {
  const { activeHoles, params } = computePattern(patchIn(createDocument(), patch));
  return { parts: generateSVGParts(activeHoles, params), holes: activeHoles.length };
};

test("the document is emitted as chunks so a large export never builds one huge string", () => {
  const { parts, holes } = render({});
  assert.ok(Array.isArray(parts));
  // Four chunks of preamble, one per hole, one closing chunk.
  assert.equal(parts.length, holes + 8);
  assert.ok(parts.every(p => typeof p === "string"));
  // Chunk size stays bounded no matter how many holes there are: that is the
  // property that keeps a multi-million-hole export under the string limit.
  assert.ok(Math.max(...parts.map(p => p.length)) < 1000);
});

test("joining the chunks is exactly the string form", () => {
  for (const patch of [{}, { "hole.shape": "Hexagon" }, { "layout.type": "Radial" }]) {
    const { activeHoles, params } = computePattern(patchIn(createDocument(), patch));
    assert.equal(generateSVGParts(activeHoles, params).join(""), generateSVGString(activeHoles, params));
  }
});

test("taper writes an entry and an exit group, one chunk per drawn profile", () => {
  const { parts, holes } = render({ "taper.enabled": true, "taper.thickness": 2, "taper.angle": 5 });
  const text = parts.join("");
  assert.match(text, /<g id="HOLES" inkscape:label="HOLES"/);
  assert.match(text, /<g id="HOLES_EXIT" inkscape:label="HOLES_EXIT"/);
  assert.equal(parts.length, holes * 2 + 9); // both sides drawn, plus the group markers
});

test("cut SVG uses physical clipping, layer filtering and inch dimensions", () => {
  const { activeHoles, params, region } = computePattern(createDocument());
  const svg = generateSVGString(activeHoles, params, region, {
    mode: "cut",
    units: "inch",
    layers: ["HOLES"],
    kerf: 0.1,
  });
  assert.doesNotMatch(svg, /clipPath|clip-path|id="OUTLINE"/);
  assert.match(svg, /width="[^"]+in"/);
  assert.match(svg, /fill="none"/);
  assert.match(svg, /inkscape:label="HOLES"/);
});
