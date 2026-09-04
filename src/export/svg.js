// Dimensioned SVG export (mm units). When taper is active the entry and exit
// profiles are written as two groups so CAD/laser tools can pick a side.
//
// The document is produced as an array of chunks rather than one accumulated
// string: at the top of the slider ranges a pattern runs to millions of holes,
// and concatenating that far exceeds V8's maximum string length (~536 M chars),
// which threw RangeError and left the export button doing nothing. A Blob built
// from the chunks has no such limit; generateSVGString joins them for callers
// that want the text (tests, and any small document).
import { holeSVGElement } from "../geometry/shapes.js";
import { perfBoundarySVG } from "../geometry/boundary.js";

export function generateSVGParts(holes, params) {
  const { sheetW, sheetH, thickness, taperAngle, taperDirection, holeShape } = params;
  const shape = holeShape || "Circle";
  const taperActive = thickness > 0 && taperAngle > 0;
  const bgColor = params.bgColor || "#c0c0c0";
  const holeColor = params.holeColor || "#000000";
  const holeFill = `fill="${holeColor}"`;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">\n`,
    `  <rect width="${sheetW}" height="${sheetH}" fill="${bgColor}" />\n`,
    `  <defs><clipPath id="perf-boundary">${perfBoundarySVG(params)}</clipPath></defs>\n`,
    `  <g clip-path="url(#perf-boundary)">\n`,
  ];

  if (taperActive) {
    parts.push(`  <g id="entry-side">\n`);
    holes.forEach(pt => {
      const topW = taperDirection === "Top larger" ? pt.w : pt.exitW;
      const topH = taperDirection === "Top larger" ? pt.h : pt.exitH;
      if (topW > 0 && topH > 0)
        parts.push(holeSVGElement(pt.x, pt.y, shape, topW, topH, holeFill, "", pt.angle, pt.holeRadius));
    });
    parts.push(`  </g>\n  <g id="exit-side">\n`);
    holes.forEach(pt => {
      const botW = taperDirection === "Top larger" ? pt.exitW : pt.w;
      const botH = taperDirection === "Top larger" ? pt.exitH : pt.h;
      if (botW > 0 && botH > 0)
        parts.push(
          holeSVGElement(
            pt.x,
            pt.y,
            shape,
            botW,
            botH,
            'fill="none"',
            'stroke="#666" stroke-width="0.15"',
            pt.angle,
            pt.exitHoleRadius
          )
        );
    });
    parts.push(`  </g>\n`);
  } else {
    holes.forEach(pt => {
      parts.push(holeSVGElement(pt.x, pt.y, shape, pt.w, pt.h, holeFill, "", pt.angle, pt.holeRadius));
    });
  }
  parts.push(`  </g>\n</svg>`);
  return parts;
}

export function generateSVGString(holes, params) {
  return generateSVGParts(holes, params).join("");
}
