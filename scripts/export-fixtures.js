// node scripts/export-fixtures.js /tmp/pattern-export-fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDocument, patchIn } from "../src/core/document.js";
import { computePattern } from "../src/core/pipeline.js";
import { HOLE_SHAPES, PATTERN_TYPES } from "../src/core/constants.js";
import { generateDXFParts } from "../src/export/dxf.js";
import { generateSVGParts } from "../src/export/svg.js";
const directory = process.argv[2];
if (!directory) throw new Error("Provide an output directory");
mkdirSync(directory, { recursive: true });
const cases = [
  ...HOLE_SHAPES.map(shape => ({ name: `shape-${shape}`, patch: { "hole.shape": shape } })),
  ...PATTERN_TYPES.map(type => ({ name: `layout-${type}`, patch: { "layout.type": type } })),
  ...["Top larger", "Bottom larger"].map(direction => ({
    name: `taper-${direction}`,
    patch: {
      "hole.shape": "Rectangle",
      "hole.cornerRadius": 1,
      "taper.enabled": true,
      "taper.thickness": 2,
      "taper.angle": 10,
      "taper.direction": direction,
    },
  })),
  {
    name: "custom-counter",
    patch: {
      "hole.shape": "Custom",
      "hole.custom.kind": "svg",
      "hole.custom.rings": [
        [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
        ],
        [
          [-0.2, -0.2],
          [-0.2, 0.2],
          [0.2, 0.2],
          [0.2, -0.2],
        ],
      ],
    },
  },
  {
    name: "grille",
    patch: {
      "boundary.shape": "Ellipse",
      "boundary.trim": true,
      "boundary.cutouts": [{ id: "bore", shape: "Circle", x: 40, y: 40, w: 20, h: 20, radius: 10 }],
    },
  },
];
let count = 0;
for (const c of cases) {
  const doc = patchIn(createDocument(), { "sheet.w": 80, "sheet.h": 80, ...c.patch });
  const p = computePattern(doc);
  for (const units of ["mm", "inch"]) {
    const options = { units, mode: "cut", trim: doc.boundary.trim };
    const name = c.name.replace(/[^a-zA-Z0-9-]/g, "_") + "-" + units;
    writeFileSync(
      join(directory, name + ".dxf"),
      generateDXFParts(p.activeHoles, p.params, p.region, options).join("")
    );
    writeFileSync(
      join(directory, name + ".svg"),
      generateSVGParts(p.activeHoles, p.params, p.region, options).join("")
    );
    count++;
  }
}
// Known dimensions, not derived from the production geometry pipeline.
for (const units of ["mm", "inch"]) {
  const params = { sheetW: 25.4, sheetH: 50.8, holeShape: "Circle" };
  const holes = [{ x: 12.7, y: 10, w: 5.08, h: 5.08 }];
  writeFileSync(join(directory, `calibration-${units}.dxf`), generateDXFParts(holes, params, null, { units }).join(""));
  writeFileSync(
    join(directory, `calibration-${units}.svg`),
    generateSVGParts(holes, params, null, { units, mode: "cut" }).join("")
  );
}

// Outward compensation beyond a sheet edge exercises the exported page/extents.
for (const units of ["mm", "inch"]) {
  const params = { sheetW: 20, sheetH: 20, holeShape: "Circle" },
    holes = [{ x: 0, y: 10, w: 4, h: 4 }];
  const options = { units, mode: "cut", kerf: 1, kerfDirection: "outward" };
  writeFileSync(join(directory, `edge-kerf-${units}.dxf`), generateDXFParts(holes, params, null, options).join(""));
  writeFileSync(join(directory, `edge-kerf-${units}.svg`), generateSVGParts(holes, params, null, options).join(""));
}
console.log(`Wrote ${count + 4} SVG/DXF fixture pairs to ${directory}`);
