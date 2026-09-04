// Dimensioned SVG export (mm units). When taper is active the entry and exit
// profiles are written as two groups so CAD/laser tools can pick a side.
import { holeSVGElement } from "../geometry/shapes.js";
import { perfBoundarySVG } from "../geometry/boundary.js";

export function generateSVGString(holes, params) {
  const { sheetW, sheetH, thickness, taperAngle, taperDirection, holeShape } = params;
  const shape = holeShape || "Circle";
  const taperActive = thickness > 0 && taperAngle > 0;
  const bgColor = params.bgColor || "#c0c0c0";
  const holeColor = params.holeColor || "#000000";
  const holeFill = `fill="${holeColor}"`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">\n`;
  svg += `  <rect width="${sheetW}" height="${sheetH}" fill="${bgColor}" />\n`;
  svg += `  <defs><clipPath id="perf-boundary">${perfBoundarySVG(params)}</clipPath></defs>\n`;
  svg += `  <g clip-path="url(#perf-boundary)">\n`;

  if (taperActive) {
    svg += `  <g id="entry-side">\n`;
    holes.forEach(pt => {
      const topW = taperDirection === "Top larger" ? pt.w : pt.exitW;
      const topH = taperDirection === "Top larger" ? pt.h : pt.exitH;
      if (topW > 0 && topH > 0)
        svg += holeSVGElement(pt.x, pt.y, shape, topW, topH, holeFill, "", pt.angle, pt.holeRadius);
    });
    svg += `  </g>\n  <g id="exit-side">\n`;
    holes.forEach(pt => {
      const botW = taperDirection === "Top larger" ? pt.exitW : pt.w;
      const botH = taperDirection === "Top larger" ? pt.exitH : pt.h;
      if (botW > 0 && botH > 0)
        svg += holeSVGElement(
          pt.x,
          pt.y,
          shape,
          botW,
          botH,
          'fill="none"',
          'stroke="#666" stroke-width="0.15"',
          pt.angle,
          pt.exitHoleRadius
        );
    });
    svg += `  </g>\n`;
  } else {
    holes.forEach(pt => {
      svg += holeSVGElement(pt.x, pt.y, shape, pt.w, pt.h, holeFill, "", pt.angle, pt.holeRadius);
    });
  }
  return svg + `  </g>\n</svg>`;
}
