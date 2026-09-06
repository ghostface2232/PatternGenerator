// Reading an outline out of an SVG file: for the polygon boundary and for a
// custom hole shape. Pure — the file is parsed by regular expression rather than
// by the DOM, so node --test can cover it and so the same walk runs the same way
// in the browser.
//
// What comes out is rings (see geometry/rings.js) in the file's own user units,
// plus what the file says about how big a user unit is. Every curve is
// flattened to chords that stay within `tolerance` of it; the roadmap sets that
// at 0.05 mm, and the caller passes it in user units since only the caller
// knows the scale (a file with no physical units asks the user for one).
//
// Covered: <path> (every command, arcs included), <rect> (with rx/ry),
// <circle>, <ellipse>, <polygon>, <polyline>, the `transform` attribute on each
// of those and on every <g> and <svg> above it, and <defs>/<clipPath>/<mask>/
// <symbol>/<marker>/<pattern> subtrees, which are skipped because their content
// is not drawn. Not covered: <use>, CSS, text, and strokes — an outline is what a
// path encloses, and a stroke width is not part of it.
import { arcSegmentsFor } from "./rings.js";

// ─── Transforms (SVG's [a b c d e f]: x' = ax + cy + e, y' = bx + dy + f) ──
export const IDENTITY = [1, 0, 0, 1, 0, 0];

export function multiplyTransform(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const applyTransform = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const numbers = text => (text.match(NUMBER) || []).map(Number);

// A `transform="…"` attribute as one matrix. Functions compose left to right
// as SVG applies them (the first listed is the outermost).
export function parseTransform(text) {
  let m = IDENTITY;
  if (!text) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let found;
  while ((found = re.exec(text))) {
    const [, kind, inner] = found;
    const a = numbers(inner);
    let t = IDENTITY;
    if (kind === "matrix" && a.length >= 6) t = a.slice(0, 6);
    else if (kind === "translate") t = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (kind === "scale") t = [a[0] ?? 1, 0, 0, a.length > 1 ? a[1] : (a[0] ?? 1), 0, 0];
    else if (kind === "rotate") {
      const r = ((a[0] || 0) * Math.PI) / 180;
      const c = Math.cos(r),
        s = Math.sin(r);
      t = [c, s, -s, c, 0, 0];
      if (a.length >= 3) {
        t = multiplyTransform(multiplyTransform([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]);
      }
    } else if (kind === "skewX") t = [1, 0, Math.tan(((a[0] || 0) * Math.PI) / 180), 1, 0, 0];
    else if (kind === "skewY") t = [1, Math.tan(((a[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = multiplyTransform(m, t);
  }
  return m;
}

// ─── Flattening ───────────────────────────────────────────────────────
// A cubic is flat enough to be its own chord once both control points lie
// within `tolerance` of it; otherwise it is halved (de Casteljau) and each half
// asked again. Depth is capped so a degenerate curve cannot recurse forever.
function flattenCubic(p0, p1, p2, p3, tolerance, out, depth = 0) {
  const dx = p3[0] - p0[0],
    dy = p3[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const off = p => (len > 1e-12 ? Math.abs((p[0] - p0[0]) * dy - (p[1] - p0[1]) * dx) / len : Math.hypot(p[0] - p0[0], p[1] - p0[1])); // prettier-ignore
  if (depth >= 16 || (off(p1) <= tolerance && off(p2) <= tolerance)) {
    out.push(p3);
    return;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const p01 = mid(p0, p1),
    p12 = mid(p1, p2),
    p23 = mid(p2, p3);
  const p012 = mid(p01, p12),
    p123 = mid(p12, p23);
  const p0123 = mid(p012, p123);
  flattenCubic(p0, p01, p012, p0123, tolerance, out, depth + 1);
  flattenCubic(p0123, p123, p23, p3, tolerance, out, depth + 1);
}

// An SVG arc (endpoint form) as points along it. The centre parameterisation is
// the one in the SVG specification's appendix; a radius too small to reach the
// end point is scaled up, as the specification says it must be.
function flattenArc(from, rx, ry, rotation, large, sweep, to, tolerance, out) {
  let RX = Math.abs(rx),
    RY = Math.abs(ry);
  if (RX < 1e-12 || RY < 1e-12 || (from[0] === to[0] && from[1] === to[1])) {
    out.push(to);
    return;
  }
  const phi = (rotation * Math.PI) / 180;
  const c = Math.cos(phi),
    s = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2,
    dy = (from[1] - to[1]) / 2;
  const x1 = c * dx + s * dy,
    y1 = -s * dx + c * dy;
  const lambda = (x1 * x1) / (RX * RX) + (y1 * y1) / (RY * RY);
  if (lambda > 1) {
    RX *= Math.sqrt(lambda);
    RY *= Math.sqrt(lambda);
  }
  const num = Math.max(0, RX * RX * RY * RY - RX * RX * y1 * y1 - RY * RY * x1 * x1);
  const den = RX * RX * y1 * y1 + RY * RY * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(den > 0 ? num / den : 0);
  const cx1 = (coef * RX * y1) / RY,
    cy1 = (-coef * RY * x1) / RX;
  const cx = c * cx1 - s * cy1 + (from[0] + to[0]) / 2;
  const cy = s * cx1 + c * cy1 + (from[1] + to[1]) / 2;
  const angle = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1 - cx1) / RX, (y1 - cy1) / RY);
  let delta = angle((x1 - cx1) / RX, (y1 - cy1) / RY, (-x1 - cx1) / RX, (-y1 - cy1) / RY);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = arcSegmentsFor(Math.max(RX, RY), delta, tolerance);
  for (let i = 1; i <= segments; i++) {
    const t = theta1 + (delta * i) / segments;
    const ex = RX * Math.cos(t),
      ey = RY * Math.sin(t);
    out.push(i === segments ? to : [c * ex - s * ey + cx, s * ex + c * ey + cy]);
  }
}

// ─── Path data ────────────────────────────────────────────────────────
// Tokens: commands and numbers. Arc flags are the one place a number is a
// single digit that may be glued to the next ("a1 1 0 0110 10"), so the
// tokeniser is asked for them one character at a time.
function tokenize(d) {
  const tokens = [];
  const re = /([MmZzLlHhVvCcSsQqTtAa])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let found;
  while ((found = re.exec(d))) tokens.push(found[1] ? { cmd: found[1] } : { num: Number(found[2]), at: found.index, text: found[2] }); // prettier-ignore
  return tokens;
}

// A path's subpaths, each a list of points in user units (after `transform`)
// and whether it was closed. Curves are flattened at `tolerance`.
export function pathToPolylines(d, transform = IDENTITY, tolerance = 0.05) {
  const tokens = tokenize(String(d || ""));
  const out = [];
  let current = null;
  let x = 0,
    y = 0,
    startX = 0,
    startY = 0;
  let lastCmd = "";
  let lastControl = null; // for S / T reflection
  let i = 0;
  const point = (px, py) => applyTransform(transform, px, py);
  const begin = (px, py) => {
    current = { points: [point(px, py)], closed: false };
    out.push(current);
    x = startX = px;
    y = startY = py;
  };
  const lineTo = (px, py) => {
    // A line with no subpath open — after a Z, before any M — starts a new
    // one at the current point, which Z put back at the last subpath's start.
    if (!current) begin(x, y);
    current.points.push(point(px, py));
    x = px;
    y = py;
  };
  const cubicTo = (c1x, c1y, c2x, c2y, px, py) => {
    if (!current) begin(x, y);
    const pts = [];
    flattenCubic(point(x, y), point(c1x, c1y), point(c2x, c2y), point(px, py), tolerance, pts);
    current.points.push(...pts);
    lastControl = [c2x, c2y];
    x = px;
    y = py;
  };
  const next = () => {
    const t = tokens[i++];
    return t && "num" in t ? t.num : NaN;
  };
  // Arc flags: a token like "01" or "0110" is several flags and the start of a
  // number, so peel one digit off the front and leave the rest in place.
  const flag = () => {
    const t = tokens[i];
    if (!t || !("num" in t)) return NaN;
    const text = t.text.replace(/^[-+]/, "");
    if (text.length > 1 && (text[0] === "0" || text[0] === "1") && /^[01]/.test(text)) {
      const rest = text.slice(1);
      tokens[i] = { num: Number(rest), at: t.at + 1, text: rest };
      return Number(text[0]);
    }
    i++;
    return t.num;
  };
  let cmd = null;
  while (i < tokens.length) {
    const token = tokens[i];
    if ("cmd" in token) {
      cmd = token.cmd;
      i++;
    } else if (!cmd) {
      i++;
      continue;
    } else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
    const rel = cmd === cmd.toLowerCase() && cmd !== "z" && cmd !== "Z";
    const upper = cmd.toUpperCase();
    if (upper === "Z") {
      if (current) {
        current.closed = true;
        current = null;
      }
      x = startX;
      y = startY;
      cmd = null;
      lastCmd = "Z";
      continue;
    }
    const ox = rel ? x : 0,
      oy = rel ? y : 0;
    if (upper === "M") {
      const px = next(),
        py = next();
      if (!Number.isFinite(px) || !Number.isFinite(py)) break;
      begin(ox + px, oy + py);
    } else if (upper === "L") {
      const px = next(),
        py = next();
      if (!Number.isFinite(px) || !Number.isFinite(py)) break;
      lineTo(ox + px, oy + py);
    } else if (upper === "H") {
      const px = next();
      if (!Number.isFinite(px)) break;
      lineTo(ox + px, y);
    } else if (upper === "V") {
      const py = next();
      if (!Number.isFinite(py)) break;
      lineTo(x, oy + py);
    } else if (upper === "C") {
      const a = [next(), next(), next(), next(), next(), next()];
      if (!a.every(Number.isFinite)) break;
      cubicTo(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5]);
    } else if (upper === "S") {
      const a = [next(), next(), next(), next()];
      if (!a.every(Number.isFinite)) break;
      const reflect = /[CcSs]/.test(lastCmd) && lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y];
      cubicTo(reflect[0], reflect[1], ox + a[0], oy + a[1], ox + a[2], oy + a[3]);
    } else if (upper === "Q" || upper === "T") {
      let qx, qy, px, py;
      if (upper === "Q") {
        const a = [next(), next(), next(), next()];
        if (!a.every(Number.isFinite)) break;
        [qx, qy, px, py] = [ox + a[0], oy + a[1], ox + a[2], oy + a[3]];
      } else {
        const a = [next(), next()];
        if (!a.every(Number.isFinite)) break;
        [qx, qy] = /[QqTt]/.test(lastCmd) && lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y];
        [px, py] = [ox + a[0], oy + a[1]];
      }
      // A quadratic is the cubic with control points two thirds of the way to
      // its own.
      const c1x = x + (2 / 3) * (qx - x),
        c1y = y + (2 / 3) * (qy - y);
      const c2x = px + (2 / 3) * (qx - px),
        c2y = py + (2 / 3) * (qy - py);
      cubicTo(c1x, c1y, c2x, c2y, px, py);
      lastControl = [qx, qy];
    } else if (upper === "A") {
      const rx = next(),
        ry = next(),
        rot = next();
      const large = flag(),
        sweep = flag();
      const px = next(),
        py = next();
      if (![rx, ry, rot, large, sweep, px, py].every(Number.isFinite)) break;
      if (!current) begin(x, y);
      // Flattened in user space and transformed afterwards: an affine transform
      // does not keep an arc an arc, but it does keep a chord a chord.
      const pts = [];
      flattenArc([x, y], rx, ry, rot, large ? 1 : 0, sweep ? 1 : 0, [ox + px, oy + py], tolerance, pts);
      current.points.push(...pts.map(([qx, qy]) => point(qx, qy)));
      x = ox + px;
      y = oy + py;
    } else {
      i++;
      continue;
    }
    lastCmd = cmd;
    if (!/[CcSsQqTt]/.test(cmd)) lastControl = null;
  }
  return out;
}

// ─── Elements ─────────────────────────────────────────────────────────
const SKIPPED = new Set(["defs", "clipPath", "mask", "symbol", "marker", "pattern", "metadata", "title", "desc"]);

function attributes(text) {
  const attrs = {};
  const re = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let found;
  while ((found = re.exec(text))) attrs[found[1]] = found[2] ?? found[3] ?? "";
  return attrs;
}

const num = (value, fallback = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

// A rectangle, optionally with rounded corners, as a point list in user units.
function rectPoints(attrs, tolerance) {
  const x = num(attrs.x),
    y = num(attrs.y),
    w = num(attrs.width),
    h = num(attrs.height);
  if (!(w > 0) || !(h > 0)) return null;
  let rx = attrs.rx !== undefined ? num(attrs.rx) : attrs.ry !== undefined ? num(attrs.ry) : 0;
  let ry = attrs.ry !== undefined ? num(attrs.ry) : rx;
  rx = Math.min(Math.max(0, rx), w / 2);
  ry = Math.min(Math.max(0, ry), h / 2);
  if (!(rx > 0) || !(ry > 0)) {
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  const pts = [];
  const corner = (cx, cy, from) => {
    const n = arcSegmentsFor(Math.max(rx, ry), Math.PI / 2, tolerance);
    for (let i = 0; i <= n; i++) {
      const a = from + (Math.PI / 2) * (i / n);
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
  };
  corner(x + w - rx, y + ry, -Math.PI / 2);
  corner(x + w - rx, y + h - ry, 0);
  corner(x + rx, y + h - ry, Math.PI / 2);
  corner(x + rx, y + ry, Math.PI);
  return pts;
}

function ellipsePoints(cx, cy, rx, ry, tolerance) {
  if (!(rx > 0) || !(ry > 0)) return null;
  const n = arcSegmentsFor(Math.max(rx, ry), Math.PI * 2, tolerance);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

function pointList(text) {
  const values = numbers(text || "");
  const pts = [];
  for (let i = 0; i + 1 < values.length; i += 2) pts.push([values[i], values[i + 1]]);
  return pts;
}

// Physical size of one user unit, in millimetres, from the root's width,
// height and viewBox — or null when the file gives no physical unit (px, or
// none), which is the case the caller has to ask the user about. With a
// viewBox the default preserveAspectRatio (xMidYMid meet) fits the box
// inside the viewport, so the scale is the smaller of the two ratios.
const UNIT_MM = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, m: 1000 };
function physicalMm(text) {
  const m = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(text || "");
  if (!m) return null;
  const mm = UNIT_MM[m[2].toLowerCase()];
  return mm ? { value: Number(m[1]), mm: Number(m[1]) * mm } : null;
}
function unitScale(attrs) {
  const viewBox = numbers(attrs.viewBox || "");
  const box = viewBox.length === 4 ? viewBox : null;
  const width = physicalMm(attrs.width),
    height = physicalMm(attrs.height);
  if (!width && !height) return { scale: null, viewBox: box };
  const ratios = [];
  if (width) ratios.push(width.mm / (box && box[2] > 0 ? box[2] : width.value));
  if (height) ratios.push(height.mm / (box && box[3] > 0 ? box[3] : height.value));
  return { scale: Math.min(...ratios), viewBox: box };
}

// Every closed outline in the file, in document order, one entry per element:
// `{ tag, rings }` with the rings in user units, transforms applied. Open
// subpaths and polylines are left out — an outline is a region, and an open
// stroke encloses nothing. `scale` is millimetres per user unit or null.
export function parseSVGOutline(text, tolerance = 0.05) {
  const source = String(text || "");
  const shapes = [];
  const stack = []; // { tag, transform, skip }
  let root = null;
  const tagRe = /<(\/?)([a-zA-Z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let found;
  const closeTo = (points, closed) => {
    if (!points || points.length < 3) return null;
    const first = points[0],
      last = points[points.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9) points = points.slice(0, -1);
    else if (!closed) return null;
    return points.length >= 3 ? points : null;
  };
  while ((found = tagRe.exec(source))) {
    const [, closing, rawTag, attrText, selfClosing] = found;
    const tag = rawTag.includes(":") ? rawTag.slice(rawTag.indexOf(":") + 1) : rawTag;
    if (closing) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    const attrs = attributes(attrText);
    const parent = stack[stack.length - 1];
    const skip = (parent?.skip ?? false) || SKIPPED.has(tag);
    const transform = multiplyTransform(parent?.transform ?? IDENTITY, parseTransform(attrs.transform));
    if (tag === "svg" && !root) root = attrs;
    if (!skip) {
      let rings = null;
      if (tag === "path") {
        rings = pathToPolylines(attrs.d, transform, tolerance)
          .map(sub => closeTo(sub.points, sub.closed))
          .filter(Boolean);
      } else {
        let pts = null;
        if (tag === "rect") pts = rectPoints(attrs, tolerance);
        else if (tag === "circle")
          pts = ellipsePoints(num(attrs.cx), num(attrs.cy), num(attrs.r), num(attrs.r), tolerance); // prettier-ignore
        else if (tag === "ellipse")
          pts = ellipsePoints(num(attrs.cx), num(attrs.cy), num(attrs.rx), num(attrs.ry), tolerance); // prettier-ignore
        else if (tag === "polygon") pts = pointList(attrs.points);
        else if (tag === "polyline") pts = closeTo(pointList(attrs.points), false);
        if (pts && pts.length >= 3) rings = [pts.map(([px, py]) => applyTransform(transform, px, py))];
      }
      if (rings && rings.length) shapes.push({ tag, rings });
    }
    if (!selfClosing && !/^(path|rect|circle|ellipse|polygon|polyline|line)$/.test(tag)) {
      stack.push({ tag, transform, skip });
    }
  }
  const { scale, viewBox } = unitScale(root || {});
  return { shapes, scale, viewBox, isSVG: root !== null };
}
