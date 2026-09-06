// ASCII R2000, right-handed XY plane. Reflect sheet Y about its bottom edge
// and negate bulges so exported shapes retain their orientation and handedness.
import { EXPORT_LAYERS, exportOptions, exportScale, manufacturingProfiles } from "./profiles.js";
const pair = (code, value) => `${code}\n${typeof value === "number" ? Number(value.toFixed(9)) : value}\n`;

export function roundedRectVertices(p) {
  const x = p.w / 2,
    y = p.h / 2,
    r = p.r,
    b = Math.tan(Math.PI / 8);
  const points =
    r > 0
      ? [
          [-x + r, -y, 0],
          [x - r, -y, b],
          [x, -y + r, 0],
          [x, y - r, b],
          [x - r, y, 0],
          [-x + r, y, b],
          [-x, y - r, 0],
          [-x, -y + r, b],
        ]
      : [
          [-x, -y, 0],
          [x, -y, 0],
          [x, y, 0],
          [-x, y, 0],
        ];
  // Stadiums have zero-length straight edges. Keep the arc's starting vertex.
  return points
    .filter(
      (v, i) => Math.hypot(v[0] - points[(i + 1) % points.length][0], v[1] - points[(i + 1) % points.length][1]) > 1e-12
    )
    .map(([a, c, bulge]) => [
      p.x + a * Math.cos(p.angle) - c * Math.sin(p.angle),
      p.y + a * Math.sin(p.angle) + c * Math.cos(p.angle),
      bulge,
    ]);
}

export function generateDXFParts(holes, params, region = null, input = {}) {
  const options = exportOptions(input),
    scale = exportScale(options.units);
  let handle = 256;
  const id = () => pair(5, (handle++).toString(16).toUpperCase());
  const table = (name, count) =>
    pair(0, "TABLE") + pair(2, name) + id() + pair(100, "AcDbSymbolTable") + pair(70, count);
  const parts = [
    pair(0, "SECTION") +
      pair(2, "HEADER") +
      pair(9, "$ACADVER") +
      pair(1, "AC1015") +
      pair(9, "$INSUNITS") +
      pair(70, options.units === "inch" ? 1 : 4) +
      pair(9, "$MEASUREMENT") +
      pair(70, options.units === "inch" ? 0 : 1) +
      pair(9, "$EXTMIN") +
      pair(10, 0) +
      pair(20, 0) +
      pair(30, 0) +
      pair(9, "$EXTMAX") +
      pair(10, params.sheetW * scale) +
      pair(20, params.sheetH * scale) +
      pair(30, 0) +
      pair(0, "ENDSEC"),
  ];
  parts.push(
    pair(0, "SECTION") +
      pair(2, "TABLES") +
      table("LTYPE", 1) +
      pair(0, "LTYPE") +
      id() +
      pair(100, "AcDbSymbolTableRecord") +
      pair(100, "AcDbLinetypeTableRecord") +
      pair(2, "CONTINUOUS") +
      pair(70, 0) +
      pair(3, "Solid line") +
      pair(72, 65) +
      pair(73, 0) +
      pair(40, 0) +
      pair(0, "ENDTAB")
  );
  parts.push(table("LAYER", 5));
  for (const [i, layer] of ["0", ...EXPORT_LAYERS].entries())
    parts.push(
      pair(0, "LAYER") +
        id() +
        pair(100, "AcDbSymbolTableRecord") +
        pair(100, "AcDbLayerTableRecord") +
        pair(2, layer) +
        pair(70, 0) +
        pair(62, [7, 7, 1, 3, 5][i]) +
        pair(6, "CONTINUOUS")
    );
  parts.push(pair(0, "ENDTAB") + pair(0, "ENDSEC") + pair(0, "SECTION") + pair(2, "ENTITIES"));
  const entity = (kind, layer) => pair(0, kind) + id() + pair(100, "AcDbEntity") + pair(8, layer);
  for (const p of manufacturingProfiles(holes, params, region, options)) {
    if (p.kind === "circle")
      parts.push(
        entity("CIRCLE", p.layer) +
          pair(100, "AcDbCircle") +
          pair(10, p.x * scale) +
          pair(20, (params.sheetH - p.y) * scale) +
          pair(30, 0) +
          pair(40, p.r * scale)
      );
    else
      for (const ring of p.kind === "rect" ? [roundedRectVertices(p)] : p.rings) {
        if (ring.length < 3) continue;
        let text = entity("LWPOLYLINE", p.layer) + pair(100, "AcDbPolyline") + pair(90, ring.length) + pair(70, 1);
        for (const [x, y, b = 0] of ring)
          text += pair(10, x * scale) + pair(20, (params.sheetH - y) * scale) + (b ? pair(42, -b) : "");
        parts.push(text);
      }
  }
  parts.push(pair(0, "ENDSEC") + pair(0, "EOF"));
  return parts;
}
export const generateDXFString = (...args) => generateDXFParts(...args).join("");
