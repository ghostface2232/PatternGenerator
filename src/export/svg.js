// Dimensioned SVG export (mm units). When taper is active the entry and exit
// profiles are written as two groups so CAD/laser tools can pick a side.
//
// The document is produced as an array of chunks rather than one accumulated
// string: at the top of the slider ranges a pattern runs to millions of holes,
// and concatenating that far exceeds V8's maximum string length (~536 M chars),
// which threw RangeError and left the export button doing nothing. A Blob built
// from the chunks has no such limit; generateSVGString joins them for callers
// that want the text (tests, and any small document).
import { holeExitOutline, holeOutline, holeSVGElement } from "../geometry/shapes.js";
import { exportOptions, exportScale, extendExportBounds, manufacturingProfiles, profileSVG } from "./profiles.js";
import { regionFromParams } from "../geometry/boundary.js";

// `region` is the compiled boundary (geometry/boundary.js); absent, the params'
// own rectangle stands in, which is what every document before Phase 4 had.
// `options.trim` writes the region as the material — the background becomes
// its outline and an `outline` group carries the cut path — and cutouts go out
// as a `keepout` group of stroked outlines either way.
export function generateSVGParts(holes, params, region = null, options = {}) {
  options = exportOptions(options);
  if (options.mode === "cut" || options.kerf > 0) return manufacturingSVGParts(holes, params, region, options);
  const enabled = name => options.layers.includes(name);
  const scale = exportScale(options.units);
  const unit = options.units === "inch" ? "in" : "mm";
  const { sheetW, sheetH, thickness, taperAngle, taperDirection, holeShape } = params;
  const shape = holeShape || "Circle";
  const taperActive = thickness > 0 && taperAngle > 0;
  const bgColor = params.bgColor || "#c0c0c0";
  const holeColor = params.holeColor || "#000000";
  const holeFill = `fill="${holeColor}"`;
  const bounds = region ?? regionFromParams(params);
  const trim = options.trim === true;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${sheetW * scale}${unit}" height="${sheetH * scale}${unit}" viewBox="0 0 ${sheetW * scale} ${sheetH * scale}">\n`,
    `<g transform="scale(${scale})">\n`,
    trim
      ? `  ${bounds.svg(`fill="${bgColor}"`)}\n`
      : `  <rect width="${sheetW}" height="${sheetH}" fill="${bgColor}" />\n`,
    `  <defs><clipPath id="perf-boundary">${bounds.svg()}</clipPath></defs>\n`,
    `  <g clip-path="url(#perf-boundary)">\n`,
  ];

  if (taperActive) {
    parts.push(`  <g id="HOLES" inkscape:label="HOLES" inkscape:groupmode="layer">\n`);
    holes.forEach(pt => {
      const topW = taperDirection === "Top larger" ? pt.w : pt.exitW;
      const topH = taperDirection === "Top larger" ? pt.h : pt.exitH;
      if (enabled("HOLES") && topW > 0 && topH > 0)
        parts.push(
          holeSVGElement(
            pt.x,
            pt.y,
            shape,
            topW,
            topH,
            holeFill,
            "",
            pt.angle,
            taperDirection === "Top larger" ? pt.holeRadius : pt.exitHoleRadius,
            topW === pt.w ? holeOutline(pt) : holeExitOutline(pt)
          )
        );
    });
    parts.push(`  </g>\n  <g id="HOLES_EXIT" inkscape:label="HOLES_EXIT" inkscape:groupmode="layer">\n`);
    holes.forEach(pt => {
      const botW = taperDirection === "Top larger" ? pt.exitW : pt.w;
      const botH = taperDirection === "Top larger" ? pt.exitH : pt.h;
      if (enabled("HOLES_EXIT") && botW > 0 && botH > 0)
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
            taperDirection === "Top larger" ? pt.exitHoleRadius : pt.holeRadius,
            botW === pt.w ? holeOutline(pt) : holeExitOutline(pt)
          )
        );
    });
    parts.push(`  </g>\n`);
  } else {
    parts.push(`<g id="HOLES" inkscape:label="HOLES" inkscape:groupmode="layer">\n`);
    if (enabled("HOLES"))
      holes.forEach(pt => {
        parts.push(
          holeSVGElement(pt.x, pt.y, shape, pt.w, pt.h, holeFill, "", pt.angle, pt.holeRadius, holeOutline(pt))
        );
      });
  }
  if (!taperActive) parts.push(`</g>\n`);
  // One closing chunk, whatever it carries: the cut outline of a trimmed
  // sheet and the keep-outs are a few paths, not a pattern's worth.
  let tail = `  </g>\n`;
  if (trim && enabled("OUTLINE"))
    tail += `  <g id="OUTLINE" inkscape:label="OUTLINE" inkscape:groupmode="layer">${bounds.svg('fill="none" stroke="#666" stroke-width="0.15"')}</g>\n`;
  const keepouts = bounds.svgCutouts();
  if (keepouts.length && enabled("KEEPOUT")) {
    tail += `  <g id="KEEPOUT" inkscape:label="KEEPOUT" inkscape:groupmode="layer" fill="none" stroke="#666" stroke-width="0.15" stroke-dasharray="1 1">\n`;
    for (const d of keepouts) tail += `    <path d="${d}" />\n`;
    tail += `  </g>\n`;
  }
  if (!trim && enabled("OUTLINE"))
    tail += `<g id="OUTLINE" inkscape:label="OUTLINE" inkscape:groupmode="layer"><rect width="${sheetW}" height="${sheetH}" fill="none" stroke="#666" stroke-width="0.15"/></g>\n`;
  parts.push(`${tail}</g></svg>`);
  return parts;
}

export function generateSVGString(holes, params, region = null, options = {}) {
  return generateSVGParts(holes, params, region, options).join("");
}

function manufacturingSVGParts(holes, params, region, options) {
  const scale = exportScale(options.units),
    unit = options.units === "inch" ? "in" : "mm";
  const frame = { left: 0, top: 0, right: params.sheetW, bottom: params.sheetH };
  const parts = [""];
  const cut = options.mode === "cut";
  if (!cut)
    parts.push(
      options.trim
        ? (region ?? regionFromParams(params)).svg(`fill="${params.bgColor || "#c0c0c0"}"`)
        : `<rect width="${params.sheetW}" height="${params.sheetH}" fill="${params.bgColor || "#c0c0c0"}"/>`
    );
  let layer = null;
  for (const profile of manufacturingProfiles(holes, params, region, options)) {
    if (profile.layer !== layer) {
      if (layer) parts.push(`</g>\n`);
      layer = profile.layer;
      const filled = !cut && layer === "HOLES";
      parts.push(
        `<g id="${layer}" inkscape:label="${layer}" inkscape:groupmode="layer" fill="${filled ? params.holeColor || "#000000" : "none"}" stroke="${filled ? "none" : "#666"}" stroke-width="0.15" stroke-linejoin="round">\n`
      );
    }
    extendExportBounds(frame, profile, cut || profile.layer !== "HOLES" ? 0.075 : 0);
    parts.push(profileSVG(profile) + "\n");
  }
  if (layer) parts.push(`</g>\n`);
  parts.push(`</g></svg>`);
  const w = (frame.right - frame.left) * scale,
    h = (frame.bottom - frame.top) * scale;
  parts[0] = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w}${unit}" height="${h}${unit}" viewBox="${frame.left * scale} ${frame.top * scale} ${w} ${h}">\n<g transform="scale(${scale})">\n`;
  return parts;
}
