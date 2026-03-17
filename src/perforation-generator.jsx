import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const PATTERN_TYPES = ["Straight", "Staggered 60°", "Staggered 45°", "Radial", "Custom Angle"];
const HOLE_SHAPES = ["Circle", "Rectangle", "Pill", "Hexagon"];
const DIN_PRESETS = [
  { name: "Custom", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
  { name: "Rv 2-4 (60° staggered)", d: 2, pitchX: 4, pitchY: 3.46, pattern: "Staggered 60°" },
  { name: "Rv 3-5 (60° staggered)", d: 3, pitchX: 5, pitchY: 4.33, pattern: "Staggered 60°" },
  { name: "Rv 5-8 (60° staggered)", d: 5, pitchX: 8, pitchY: 6.93, pattern: "Staggered 60°" },
  { name: "Rv 6-9 (60° staggered)", d: 6, pitchX: 9, pitchY: 7.79, pattern: "Staggered 60°" },
  { name: "Rv 8-12 (60° staggered)", d: 8, pitchX: 12, pitchY: 10.39, pattern: "Staggered 60°" },
  { name: "Rv 10-15 (60° staggered)", d: 10, pitchX: 15, pitchY: 12.99, pattern: "Staggered 60°" },
  { name: "Rg 5-8 (straight)", d: 5, pitchX: 8, pitchY: 8, pattern: "Straight" },
  { name: "Rg 3-5 (straight)", d: 3, pitchX: 5, pitchY: 5, pattern: "Straight" },
  { name: "Rg 10-14 (straight)", d: 10, pitchX: 14, pitchY: 14, pattern: "Straight" },
  { name: "Rv 4-6 (45° staggered)", d: 4, pitchX: 6, pitchY: 6, pattern: "Staggered 45°" },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function calcExitDiameter(d, thickness, taperAngleDeg) {
  if (thickness <= 0 || taperAngleDeg <= 0) return d;
  return d - 2 * thickness * Math.tan((taperAngleDeg * Math.PI) / 180);
}

// ─── Hole shape helpers (w = horizontal extent, h = vertical extent) ──
function calcHoleArea(shape, w, h, holeRadius) {
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    return r > 0 ? w * h - 4 * r * r + Math.PI * r * r : w * h;
  }
  if (shape === "Pill") {
    // Stadium: short side = min(w,h), long side = max(w,h)
    const s = Math.min(w, h), l = Math.max(w, h);
    const r = s / 2;
    return Math.PI * r * r + s * (l - s);
  }
  if (shape === "Hexagon") { const r = w / 2; return (3 * Math.sqrt(3) / 2) * r * r; }
  // Circle
  return Math.PI * (w / 2) ** 2;
}

function traceHolePath(ctx, x, y, shape, w, h, angle, holeRadius) {
  const hw = w / 2, hh = h / 2;
  // For rotated rectangles/pills, use transform
  const needsRotation = angle && (shape === "Rectangle" || shape === "Pill");
  if (needsRotation) {
    ctx.translate(x, y);
    ctx.rotate(angle);
  }
  const cx = needsRotation ? 0 : x, cy = needsRotation ? 0 : y;
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    if (r > 0) { ctx.roundRect(cx - hw, cy - hh, w, h, r); }
    else { ctx.rect(cx - hw, cy - hh, w, h); }
  } else if (shape === "Hexagon") {
    const R = hw / (Math.sqrt(3) / 2);
    ctx.moveTo(cx + R, cy);
    for (let i = 1; i <= 6; i++) { const a = (Math.PI / 3) * i; ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); }
    ctx.closePath();
  } else if (shape === "Pill") {
    if (w >= h) {
      const s = hw - hh;
      ctx.moveTo(cx - s, cy - hh);
      ctx.lineTo(cx + s, cy - hh);
      ctx.arc(cx + s, cy, hh, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx - s, cy + hh);
      ctx.arc(cx - s, cy, hh, Math.PI / 2, -Math.PI / 2);
    } else {
      const s = hh - hw;
      ctx.moveTo(cx + hw, cy - s);
      ctx.lineTo(cx + hw, cy + s);
      ctx.arc(cx, cy + s, hw, 0, Math.PI);
      ctx.lineTo(cx - hw, cy - s);
      ctx.arc(cx, cy - s, hw, Math.PI, 0);
    }
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, hw, 0, Math.PI * 2);
  }
  if (needsRotation) {
    ctx.rotate(-angle);
    ctx.translate(-x, -y);
  }
}

function holeSVGElement(x, y, shape, w, h, fill, extra, angle, holeRadius) {
  const hw = w / 2, hh = h / 2;
  const attrs = extra || '';
  const rotAttr = angle && (shape === "Rectangle" || shape === "Pill") ? ` transform="rotate(${(angle * 180 / Math.PI).toFixed(2)} ${x.toFixed(3)} ${y.toFixed(3)})"` : '';
  if (shape === "Rectangle") {
    const r = Math.min(holeRadius || 0, w / 2, h / 2);
    const rxAttr = r > 0 ? ` rx="${r.toFixed(3)}" ry="${r.toFixed(3)}"` : '';
    return `    <rect x="${(x - hw).toFixed(3)}" y="${(y - hh).toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}"${rxAttr} ${fill} ${attrs}${rotAttr}/>\n`;
  }
  if (shape === "Hexagon") {
    const R = hw / (Math.sqrt(3) / 2);
    const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${(x + R * Math.cos(a)).toFixed(3)},${(y + R * Math.sin(a)).toFixed(3)}`; }).join(" ");
    return `    <polygon points="${pts}" ${fill} ${attrs}/>\n`;
  }
  if (shape === "Pill") {
    if (w >= h) {
      const s = hw - hh, r = hh;
      return `    <path d="M ${(x - s).toFixed(3)} ${(y - r).toFixed(3)} L ${(x + s).toFixed(3)} ${(y - r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + s).toFixed(3)} ${(y + r).toFixed(3)} L ${(x - s).toFixed(3)} ${(y + r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x - s).toFixed(3)} ${(y - r).toFixed(3)} Z" ${fill} ${attrs}${rotAttr}/>\n`;
    } else {
      const s = hh - hw, r = hw;
      return `    <path d="M ${(x + r).toFixed(3)} ${(y - s).toFixed(3)} L ${(x + r).toFixed(3)} ${(y + s).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x - r).toFixed(3)} ${(y + s).toFixed(3)} L ${(x - r).toFixed(3)} ${(y - s).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 0 1 ${(x + r).toFixed(3)} ${(y - s).toFixed(3)} Z" ${fill} ${attrs}${rotAttr}/>\n`;
    }
  }
  return `    <circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${hw.toFixed(3)}" ${fill} ${attrs}/>\n`;
}

// Check if a point is inside a rounded rectangle
function isInsideRoundedRect(px, py, x1, y1, x2, y2, cr) {
  if (cr <= 0) return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  // Clamp corner radius
  const maxR = Math.min((x2 - x1) / 2, (y2 - y1) / 2);
  const r = Math.min(cr, maxR);
  // Check main cross regions first
  if (px >= x1 + r && px <= x2 - r && py >= y1 && py <= y2) return true;
  if (px >= x1 && px <= x2 && py >= y1 + r && py <= y2 - r) return true;
  // Check four corners
  const corners = [[x1 + r, y1 + r], [x2 - r, y1 + r], [x1 + r, y2 - r], [x2 - r, y2 - r]];
  for (const [cx, cy] of corners) {
    if (Math.hypot(px - cx, py - cy) <= r) return true;
  }
  return false;
}

// Area of a rounded rectangle
function roundedRectArea(w, h, cr) {
  if (cr <= 0) return w * h;
  const maxR = Math.min(w / 2, h / 2);
  const r = Math.min(cr, maxR);
  // Rectangle area minus 4 square corners plus 4 quarter-circle corners
  return w * h - 4 * r * r + Math.PI * r * r;
}

function generateHoles(params) {
  const { diameter, holeW, holeH, patternType, pitchX, pitchY, sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, cornerRadius, customAngle, ringSpacing, circumSpacing, radialMode, centerHole } = params;
  const hw = (holeW || diameter) / 2, hh = (holeH || diameter) / 2;
  const r = Math.max(hw, hh);
  const holes = [];
  const xMin = marginLeft, xMax = sheetW - marginRight;
  const yMin = marginTop, yMax = sheetH - marginBottom;
  if (xMin >= xMax || yMin >= yMax) return holes;

  if (patternType === "Radial") {
    const cx = sheetW / 2, cy = sheetH / 2;
    const perfW = xMax - xMin, perfH = yMax - yMin;
    // Max radius for ring generation
    const maxRadiusFull = Math.hypot(perfW, perfH) / 2 + ringSpacing;
    const maxRadiusCircle = Math.min(perfW, perfH) / 2;
    const maxR = (radialMode === "Circle") ? maxRadiusCircle : maxRadiusFull;
    const numRingsAuto = Math.max(0, Math.floor(maxR / ringSpacing));

    if (centerHole) holes.push({ x: cx, y: cy, angle: 0 });
    for (let ring = 1; ring <= numRingsAuto; ring++) {
      const ringR = ring * ringSpacing;
      const count = Math.max(1, Math.floor((2 * Math.PI * ringR) / circumSpacing));
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const hx = cx + ringR * Math.cos(angle), hy = cy + ringR * Math.sin(angle);
        if (radialMode === "Circle") {
          // Only include if the hole center is within the inscribed circle
          if (Math.hypot(hx - cx, hy - cy) <= maxRadiusCircle) {
            holes.push({ x: hx, y: hy, angle });
          }
        } else {
          // Full mode: include if inside the (rounded) rect boundary
          if (cornerRadius > 0) {
            if (isInsideRoundedRect(hx, hy, xMin, yMin, xMax, yMax, cornerRadius)) holes.push({ x: hx, y: hy, angle });
          } else if (hx >= xMin - r && hx <= xMax + r && hy >= yMin - r && hy <= yMax + r) {
            holes.push({ x: hx, y: hy, angle });
          }
        }
      }
    }
    return holes;
  }

  let offsetFn = () => 0;
  if (patternType === "Staggered 60°" || patternType === "Staggered 45°") {
    offsetFn = (rowIdx) => (rowIdx % 2 !== 0 ? pitchX / 2 : 0);
  } else if (patternType === "Custom Angle") {
    const angleRad = (customAngle * Math.PI) / 180;
    offsetFn = (rowIdx) => (rowIdx % 2 !== 0 ? pitchY * Math.tan(angleRad) : 0);
  }

  const holeHeight = holeH || diameter;
  const holeWidth = holeW || diameter;
  const minEdgeGap = Math.min(pitchX - holeWidth, pitchY - holeHeight);
  const safeMinGap = Math.max(0, minEdgeGap);

  let effPY = pitchY;
  if (patternType === "Staggered 60°" || patternType === "Staggered 45°") {
    // In staggered layouts, adjacent rows are offset by pitchX/2 horizontally.
    // The nearest neighbor is diagonal, so use Euclidean distance for min gap check
    // instead of purely vertical distance which over-constrains the spacing.
    const halfPX = pitchX / 2;
    const holeDim = Math.max(holeWidth, holeHeight);
    const minDist = holeDim + safeMinGap;
    const staggeredMinPY = Math.sqrt(Math.max(holeHeight * holeHeight, minDist * minDist - halfPX * halfPX));
    if (patternType === "Staggered 60°") {
      effPY = Math.max(pitchX * Math.sqrt(3) / 2, staggeredMinPY);
    } else {
      effPY = Math.max(pitchX, staggeredMinPY);
    }
  }

  // Center-aligned: start from panel center, expand outward
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
  // How many rows above/below center
  const rowsUp = Math.ceil((cy - yMin + r) / effPY);
  const rowsDown = Math.ceil((yMax + r - cy) / effPY);

  for (let ri = -rowsUp; ri <= rowsDown; ri++) {
    const y = cy + ri * effPY;
    if (y < yMin - r || y > yMax + r) continue;
    // Row index for offset: center row = 0
    const rowIdx = Math.abs(ri);
    const off = offsetFn(rowIdx);
    // Expand columns from center
    const colsLeft = Math.ceil((cx - xMin + r) / pitchX) + 1;
    const colsRight = Math.ceil((xMax + r - cx) / pitchX) + 1;
    for (let ci = -colsLeft; ci <= colsRight; ci++) {
      const x = cx + ci * pitchX + off;
      if (x >= xMin - r && x <= xMax + r) {
        holes.push({ x, y });
      }
    }
  }

  // Filter by corner radius if set
  if (cornerRadius > 0) {
    return holes.filter(h => isInsideRoundedRect(h.x, h.y, xMin, yMin, xMax, yMax, cornerRadius));
  }
  return holes;
}

// ─── Overlap & ligament: shape-aware (AABB for rect/pill, circle for others) ──
function checkShapeOverlap(h1, h2, shape, w, h) {
  if (shape === "Rectangle") {
    // AABB overlap: gap < 0 on both axes
    const gapX = Math.abs(h1.x - h2.x) - w;
    const gapY = Math.abs(h1.y - h2.y) - h;
    return gapX < -0.001 && gapY < -0.001;
  }
  if (shape === "Pill") {
    // Stadium overlap approximation: AABB check
    const gapX = Math.abs(h1.x - h2.x) - w;
    const gapY = Math.abs(h1.y - h2.y) - h;
    return gapX < -0.001 && gapY < -0.001;
  }
  // Circle / Hexagon: distance-based
  const d = Math.max(w, h);
  return Math.hypot(h1.x - h2.x, h1.y - h2.y) < d - 0.001;
}

function calcShapeGap(h1, h2, shape, w, h) {
  if (shape === "Rectangle" || shape === "Pill") {
    // Minimum gap between AABBs (Chebyshev-like: the gap that must be bridged)
    const gapX = Math.abs(h1.x - h2.x) - w;
    const gapY = Math.abs(h1.y - h2.y) - h;
    // If both axes overlap → negative (overlap); otherwise the gap is the max of the two axis gaps
    if (gapX < 0 && gapY < 0) return Math.max(gapX, gapY); // overlap amount
    if (gapX < 0) return gapY; // only Y gap matters
    if (gapY < 0) return gapX; // only X gap matters
    return Math.hypot(Math.max(0, gapX), Math.max(0, gapY)); // corner gap
  }
  const d = Math.max(w, h);
  return Math.hypot(h1.x - h2.x, h1.y - h2.y) - d;
}

function findOverlaps(holes, shape, w, h) {
  const overlaps = new Set();
  if (holes.length > 10000) return overlaps;
  const gridSize = Math.max(w, h);
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i && checkShapeOverlap(hole, holes[j], shape, w, h)) {
          overlaps.add(i); overlaps.add(j);
        }
      }
    }
  });
  return overlaps;
}

function calcMinLigament(holes, shape, w, h) {
  if (holes.length < 2 || holes.length > 10000) return null;
  let minGap = Infinity;
  const gridSize = Math.max(w, h) * 2;
  const grid = {};
  holes.forEach((hole, i) => {
    const key = `${Math.floor(hole.x / gridSize)},${Math.floor(hole.y / gridSize)}`;
    (grid[key] ||= []).push(i);
  });
  holes.forEach((hole, i) => {
    const gx = Math.floor(hole.x / gridSize), gy = Math.floor(hole.y / gridSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of (grid[`${gx + dx},${gy + dy}`] || [])) {
        if (j > i) {
          const g = calcShapeGap(hole, holes[j], shape, w, h);
          if (g < minGap) minGap = g;
        }
      }
    }
  });
  return minGap === Infinity ? null : Math.max(0, minGap);
}

// ─── Theoretical OAR (unit cell based, industry standard) ────────────
function calcTheoreticalOAR(patternType, pitchX, pitchY, holeArea) {
  let cellArea;
  if (patternType === "Staggered 60°") {
    cellArea = pitchX * (pitchX * Math.sqrt(3) / 2);
  } else if (patternType === "Staggered 45°") {
    cellArea = pitchX * pitchX;
  } else {
    // Straight, Custom Angle — rectangular cell
    cellArea = pitchX * pitchY;
  }
  if (cellArea <= 0) return 0;
  return Math.min((holeArea / cellArea) * 100, 100);
}

function generateSVGString(holes, params) {
  const { diameter, sheetW, sheetH, thickness, taperAngle, taperDirection, holeShape, holeW, holeH, holeRadius: hr } = params;
  const shape = holeShape || "Circle";
  const w = holeW || diameter, h = holeH || diameter;
  const taperActive = thickness > 0 && taperAngle > 0;
  const taperScale = taperActive ? Math.max(0, calcExitDiameter(diameter, thickness, taperAngle)) / diameter : 1;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">\n`;
  svg += `  <rect width="${sheetW}" height="${sheetH}" fill="#c0c0c0" />\n`;

  if (taperActive && taperScale > 0) {
    const topW = taperDirection === "Top larger" ? w : w * taperScale;
    const topH = taperDirection === "Top larger" ? h : h * taperScale;
    const botW = taperDirection === "Top larger" ? w * taperScale : w;
    const botH = taperDirection === "Top larger" ? h * taperScale : h;
    svg += `  <g id="entry-side">\n`;
    holes.forEach(pt => { svg += holeSVGElement(pt.x, pt.y, shape, topW, topH, 'fill="#000"', '', pt.angle, hr); });
    svg += `  </g>\n  <g id="exit-side">\n`;
    holes.forEach(pt => { svg += holeSVGElement(pt.x, pt.y, shape, botW, botH, 'fill="none"', 'stroke="#666" stroke-width="0.15"', pt.angle, hr); });
    svg += `  </g>\n`;
  } else {
    holes.forEach(pt => { svg += holeSVGElement(pt.x, pt.y, shape, w, h, 'fill="#000"', '', pt.angle, hr); });
  }
  return svg + `</svg>`;
}

// ─── Gauge ───────────────────────────────────────────────────────────
function Gauge({ value, nominalValue, dark }) {
  const R = 54, S = 7, nr = R - S;
  const circ = nr * 2 * Math.PI, arc = circ * 0.75;
  const off = arc - (clamp(value, 0, 100) / 100) * arc;
  const hasGhost = nominalValue != null && Math.abs(nominalValue - value) > 0.01;
  const ghostOff = hasGhost ? arc - (clamp(nominalValue, 0, 100) / 100) * arc : 0;
  const fg = dark ? "#60a5fa" : "#2563eb";

  return (
    <svg width={R * 2} height={R * 2} viewBox={`0 0 ${R * 2} ${R * 2}`} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={R} cy={R} r={nr} fill="none" stroke={dark ? "#2a2a2e" : "#e2e2e8"} strokeWidth={S}
        strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform={`rotate(135 ${R} ${R})`} />
      {hasGhost && <circle cx={R} cy={R} r={nr} fill="none" stroke={dark ? "rgba(96,165,250,0.2)" : "rgba(37,99,235,0.15)"} strokeWidth={S}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={ghostOff} strokeLinecap="round" transform={`rotate(135 ${R} ${R})`}
        style={{ transition: "stroke-dashoffset 0.2s" }} />}
      <circle cx={R} cy={R} r={nr} fill="none" stroke={fg} strokeWidth={S}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(135 ${R} ${R})`}
        style={{ transition: "stroke-dashoffset 0.2s" }} />
      <text x={R} y={R - 4} textAnchor="middle" fill={dark ? "#f0f0f0" : "#111"} fontSize="22" fontWeight="600" fontFamily="'JetBrains Mono', monospace">{value.toFixed(1)}</text>
      <text x={R} y={R + 14} textAnchor="middle" fill={dark ? "#888" : "#666"} fontSize="11" fontFamily="'JetBrains Mono', monospace">% Open</text>
    </svg>
  );
}

// ─── Slider Row (improved: empty input doesn't snap) ─────────────────
function SliderRow({ label, value, min, max, step, onChange, unit, dark }) {
  const [inputVal, setInputVal] = useState(String(value));
  const inputRef = useRef(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setInputVal(String(value));
  }, [value]);

  const commitInput = () => {
    isFocused.current = false;
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed)) { setInputVal(String(value)); return; }
    const clamped = clamp(parsed, min, max);
    onChange(clamped);
    setInputVal(String(clamped));
  };

  const trackBg = dark ? "#333" : "#d4d4d8";
  const trackFg = dark ? "#60a5fa" : "#2563eb";
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: dark ? "#ccc" : "#444", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={inputVal}
            onFocus={() => { isFocused.current = true; inputRef.current?.select(); }}
            onBlur={commitInput}
            onKeyDown={e => { if (e.key === "Enter") { commitInput(); inputRef.current?.blur(); } }}
            onChange={e => setInputVal(e.target.value)}
            style={{
              width: 52, height: 24, fontSize: 11, textAlign: "right",
              background: dark ? "#1e1e22" : "#fff", color: dark ? "#eee" : "#222",
              border: `1px solid ${dark ? "#333" : "#d0d0d0"}`,
              borderRadius: 4, padding: "0 4px", outline: "none",
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
          {unit && <span style={{ fontSize: 10, color: dark ? "#666" : "#999", fontFamily: "'JetBrains Mono', monospace" }}>{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 4, appearance: "none", outline: "none", borderRadius: 2, cursor: "pointer",
          background: `linear-gradient(to right, ${trackFg} 0%, ${trackFg} ${pct}%, ${trackBg} ${pct}%, ${trackBg} 100%)`
        }}
      />
    </div>
  );
}

// ─── Tiny Toggle ─────────────────────────────────────────────────────
function Toggle({ value, onChange, dark }) {
  const accent = dark ? "#60a5fa" : "#2563eb";
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 34, height: 18, borderRadius: 9, padding: 2, flexShrink: 0, cursor: "pointer",
      background: value ? accent : (dark ? "#333" : "#ccc"), transition: "background 0.2s",
      display: "flex", alignItems: "center",
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, background: "#fff",
        transform: value ? "translateX(16px)" : "translateX(0)",
        transition: "transform 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
      }} />
    </div>
  );
}

// ─── Pitch Info Display (secondary info under edge gap slider) ────────
function PitchInfo({ label, value, dark }) {
  return (
    <div style={{ fontSize: 9, color: dark ? "#555" : "#aaa", marginTop: -6, marginBottom: 8, paddingLeft: 2, fontFamily: "'JetBrains Mono', monospace" }}>
      ↔ {label}: {value.toFixed(2)} mm
    </div>
  );
}

// ─── Link Icon (for pitch sync) ──────────────────────────────────────
function LinkIcon({ linked, dark }) {
  const c = linked ? (dark ? "#60a5fa" : "#2563eb") : (dark ? "#555" : "#aaa");
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: "block" }}>
      {linked ? <>
        <path d="M6.5 9.5L9.5 6.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 11L5.5 12.5a2.12 2.12 0 0 1-3-3L4 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      </> : <>
        <path d="M9 5l1.5-1.5a2.12 2.12 0 0 1 3 3L12 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 11L5.5 12.5a2.12 2.12 0 0 1-3-3L4 8" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
        <path d="M5 3l6 10" stroke={c} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </>}
    </svg>
  );
}

// ─── Main App ────────────────────────────────────────────────────────
export default function PerforationGenerator() {
  const [dark, setDark] = useState(true);
  const [diameter, setDiameter] = useState(5);
  const [holeShape, setHoleShape] = useState("Circle");
  const [holeW, setHoleW] = useState(5);   // for Rectangle & Pill (mm)
  const [holeH, setHoleH] = useState(5);   // for Rectangle & Pill (mm)
  const [holeRadius, setHoleRadius] = useState(0); // corner radius for Rectangle holes
  const [patternType, setPatternType] = useState("Staggered 60°");
  const [edgeGapX, setEdgeGapX] = useState(3);
  const [edgeGapY, setEdgeGapY] = useState(3);
  const [gapLinked, setGapLinked] = useState(true);
  const [sheetW, setSheetW] = useState(200);
  const [sheetH, setSheetH] = useState(200);
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [marginLinked, setMarginLinked] = useState(true);
  const [customAngle, setCustomAngle] = useState(30);
  const [radialEdgeGap, setRadialEdgeGap] = useState(5);
  const [circumEdgeGap, setCircumEdgeGap] = useState(5);
  const [radialLinked, setRadialLinked] = useState(true);
  const [radialMode, setRadialMode] = useState("Full");  // "Full" | "Circle"
  const [centerHole, setCenterHole] = useState(false);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [thickness, setThickness] = useState(0);
  const [taperAngle, setTaperAngle] = useState(0);
  const [taperDirection, setTaperDirection] = useState("Top larger");
  const [removedHoles, setRemovedHoles] = useState(new Set());
  const [holeRemovalMode, setHoleRemovalMode] = useState(false);

  const canvasRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Effective hole extents (w = horizontal, h = vertical)
  const hasCustomSize = holeShape === "Rectangle" || holeShape === "Pill";
  const effW = hasCustomSize ? holeW : diameter;
  const effH = hasCustomSize ? holeH : diameter;

  // Derived pitches (hole extent + edge gap)
  const pitchX = effW + edgeGapX;
  const pitchY = effH + edgeGapY;
  const ringSpacing = diameter + radialEdgeGap;
  const circumSpacing = diameter + circumEdgeGap;

  // Shape change: sync dimensions
  const handleShapeChange = useCallback((s) => {
    if ((s === "Rectangle" || s === "Pill") && holeShape !== "Rectangle" && holeShape !== "Pill") {
      // Switching from Circle/Hex → custom size: init from diameter
      setHoleW(s === "Pill" ? diameter * 2 : diameter);
      setHoleH(diameter);
    }
    setHoleShape(s);
  }, [holeShape, diameter]);

  // Edge gap handlers
  const handleEdgeGapX = useCallback((v) => {
    setEdgeGapX(v);
    if (gapLinked) setEdgeGapY(v);
    setSelectedPreset(0);
  }, [gapLinked]);

  const handleEdgeGapY = useCallback((v) => {
    setEdgeGapY(v);
    setSelectedPreset(0);
  }, []);

  const handleRadialEdgeGap = useCallback((v) => {
    setRadialEdgeGap(v);
    if (radialLinked) setCircumEdgeGap(v);
  }, [radialLinked]);

  const handleCircumEdgeGap = useCallback((v) => {
    setCircumEdgeGap(v);
  }, []);

  const handleMarginUniform = useCallback((v) => {
    setMarginTop(v); setMarginBottom(v); setMarginLeft(v); setMarginRight(v);
  }, []);
  const hasAnyMargin = marginTop > 0 || marginBottom > 0 || marginLeft > 0 || marginRight > 0;

  const params = useMemo(() => ({
    diameter, holeShape, holeW: effW, holeH: effH, holeRadius, patternType, pitchX, pitchY, sheetW, sheetH,
    marginTop, marginBottom, marginLeft, marginRight, cornerRadius,
    customAngle, ringSpacing, circumSpacing, radialMode, centerHole,
    thickness, taperAngle, taperDirection
  }), [diameter, holeShape, effW, effH, holeRadius, patternType, pitchX, pitchY, sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, cornerRadius, customAngle, ringSpacing, circumSpacing, radialMode, centerHole, thickness, taperAngle, taperDirection]);

  const allHoles = useMemo(() => generateHoles(params), [params]);
  // Reset removed holes when pattern params change
  useEffect(() => { setRemovedHoles(new Set()); }, [params]);
  const activeHoleCount = allHoles.length - removedHoles.size;
  const holes = allHoles; // keep full array for rendering; use removedHoles set for filtering
  const overlaps = useMemo(() => findOverlaps(holes.filter((_, i) => !removedHoles.has(i)), holeShape, effW, effH), [holes, removedHoles, holeShape, effW, effH]);
  const hasOverlap = overlaps.size > 0;
  const holeCount = allHoles.length;
  const singleHoleArea = calcHoleArea(holeShape, effW, effH, holeRadius);
  const grossArea = sheetW * sheetH;
  const isRadialPattern = patternType === "Radial";
  const perfW = sheetW - marginLeft - marginRight, perfH = sheetH - marginTop - marginBottom;
  const radialCircleRadius = Math.min(perfW, perfH) / 2;
  const perforatedArea = (isRadialPattern && radialMode === "Circle")
    ? Math.PI * radialCircleRadius * radialCircleRadius
    : roundedRectArea(perfW, perfH, cornerRadius);

  // OAR calculation: use counted OAR when holes removed or margins present; else theoretical
  const hasRemovedHoles = removedHoles.size > 0;
  const useCountedOAR = hasRemovedHoles || hasAnyMargin || cornerRadius > 0 || isRadialPattern;
  const theoreticalOAR = calcTheoreticalOAR(patternType, pitchX, pitchY, singleHoleArea);
  const countedOAR = perforatedArea > 0 ? (singleHoleArea * activeHoleCount / perforatedArea) * 100 : 0;
  const nominalOAR = useCountedOAR ? countedOAR : theoreticalOAR;

  const taperActive = thickness > 0 && taperAngle > 0;
  const dExitRaw = calcExitDiameter(diameter, thickness, taperAngle);
  const dExit = Math.max(0, dExitRaw);
  const holeClosed = dExitRaw <= 0;
  const closedHoleCount = holeClosed ? activeHoleCount : 0;
  // Taper scales hole dimensions uniformly
  const taperScale = (diameter > 0 && taperActive) ? Math.max(0, dExit) / diameter : 1;
  const exitW = effW * taperScale, exitH = effH * taperScale;
  const exitHoleArea = calcHoleArea(holeShape, exitW, exitH, holeRadius);
  const theoreticalEffOAR = calcTheoreticalOAR(patternType, pitchX, pitchY, exitHoleArea);
  const countedEffOAR = perforatedArea > 0 ? (exitHoleArea * activeHoleCount / perforatedArea) * 100 : 0;
  const effectiveOAR = useCountedOAR ? countedEffOAR : theoreticalEffOAR;
  const oarDelta = taperActive ? effectiveOAR - nominalOAR : 0;
  const displayOAR = taperActive ? effectiveOAR : nominalOAR;
  const activeHoles = useMemo(() => holes.filter((_, i) => !removedHoles.has(i)), [holes, removedHoles]);
  const minLigament = useMemo(() => calcMinLigament(activeHoles, holeShape, effW, effH), [activeHoles, holeShape, effW, effH]);
  const perfMode = holeCount > 10000;

  const applyPreset = useCallback((idx) => {
    setSelectedPreset(idx);
    if (idx === 0) return;
    const p = DIN_PRESETS[idx];
    setDiameter(p.d);
    setEdgeGapX(Math.max(0, p.pitchX - p.d));
    setEdgeGapY(Math.max(0, p.pitchY - p.d));
    setPatternType(p.pattern);
  }, []);

  // ─── Canvas rendering ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = rect.width, ch = rect.height;

    ctx.fillStyle = dark ? "#0f0f11" : "#e8e8ec";
    ctx.fillRect(0, 0, cw, ch);

    const fitScale = Math.min((cw - 80) / sheetW, (ch - 80) / sheetH);
    const baseScale = fitScale * zoom;
    const cx = cw / 2 + pan.x, cy = ch / 2 + pan.y;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(baseScale, baseScale);
    ctx.translate(-sheetW / 2, -sheetH / 2);

    // Sheet shadow
    ctx.shadowColor = dark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 20 / baseScale;
    ctx.shadowOffsetX = 3 / baseScale; ctx.shadowOffsetY = 3 / baseScale;
    ctx.fillStyle = dark ? "#3a3a40" : "#c8c8cd";
    ctx.fillRect(0, 0, sheetW, sheetH);
    ctx.shadowColor = "transparent";

    ctx.fillStyle = dark ? "#48484f" : "#d4d4da";
    ctx.fillRect(0, 0, sheetW, sheetH);

    {
      const mx = marginLeft, my = marginTop;
      const mw = sheetW - marginLeft - marginRight, mh = sheetH - marginTop - marginBottom;
      const cr = Math.min(cornerRadius, mw / 2, mh / 2);
      const isCircleMode = isRadialPattern && radialMode === "Circle";
      const showBoundary = hasAnyMargin || cornerRadius > 0 || isCircleMode;
      if (showBoundary) {
        ctx.strokeStyle = dark ? "rgba(100,160,250,0.15)" : "rgba(37,99,235,0.1)";
        ctx.lineWidth = 0.3; ctx.setLineDash([2, 2]);
        ctx.beginPath();
        if (isCircleMode) {
          const cRadius = Math.min(mw, mh) / 2;
          ctx.arc(mx + mw / 2, my + mh / 2, cRadius, 0, Math.PI * 2);
        } else {
          ctx.roundRect(mx, my, mw, mh, cr);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Shade outside
        ctx.fillStyle = dark ? "rgba(100,160,250,0.04)" : "rgba(37,99,235,0.03)";
        ctx.fillRect(0, 0, sheetW, sheetH);
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        if (isCircleMode) {
          const cRadius = Math.min(mw, mh) / 2;
          ctx.arc(mx + mw / 2, my + mh / 2, cRadius, 0, Math.PI * 2);
        } else {
          ctx.roundRect(mx, my, mw, mh, cr);
        }
        ctx.fill();
        ctx.restore();
      }
    }

    const r = diameter / 2;
    const rExit = dExit / 2;
    const showTaperRings = taperActive && !perfMode;

    // Clip holes to sheet boundary
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, sheetW, sheetH);
    ctx.clip();

    if (perfMode) {
      ctx.fillStyle = dark ? "#0a0a0c" : "#1a1a1e";
      holes.forEach((h, i) => {
        if (removedHoles.has(i)) return;
        ctx.fillRect(h.x - r * 0.7, h.y - r * 0.7, r * 1.4, r * 1.4);
      });
    } else {
      // Build overlap set based on active (non-removed) holes mapping
      const activeIndices = [];
      holes.forEach((_, i) => { if (!removedHoles.has(i)) activeIndices.push(i); });
      const activeOverlapSet = new Set();
      overlaps.forEach((activeIdx) => {
        if (activeIdx < activeIndices.length) activeOverlapSet.add(activeIndices[activeIdx]);
      });

      holes.forEach((h, i) => {
        const isRemoved = removedHoles.has(i);
        if (isRemoved) {
          // Draw removed hole as faint outline
          ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, effW, effH, h.angle, holeRadius);
          ctx.strokeStyle = dark ? "rgba(255,100,100,0.25)" : "rgba(200,50,50,0.2)";
          ctx.lineWidth = 0.4;
          ctx.setLineDash([1, 1]); ctx.stroke(); ctx.setLineDash([]);
          // Draw X mark
          ctx.strokeStyle = dark ? "rgba(255,100,100,0.35)" : "rgba(200,50,50,0.3)";
          ctx.lineWidth = 0.3;
          const xr = r * 0.5;
          ctx.beginPath(); ctx.moveTo(h.x - xr, h.y - xr); ctx.lineTo(h.x + xr, h.y + xr); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(h.x + xr, h.y - xr); ctx.lineTo(h.x - xr, h.y + xr); ctx.stroke();
          return;
        }
        const isOverlap = activeOverlapSet.has(i);
        const isClosed = taperActive && holeClosed;
        // Draw hole shape
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, effW, effH, h.angle, holeRadius);
        ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
          : isOverlap ? (dark ? "rgba(220,50,50,0.7)" : "rgba(200,30,30,0.6)")
          : (dark ? "#0f0f11" : "#1a1a1e");
        ctx.fill();
        if (showTaperRings && !isClosed) {
          ctx.strokeStyle = dark ? "rgba(200,200,210,0.4)" : "rgba(60,60,70,0.35)";
          ctx.lineWidth = 0.25; ctx.stroke();
        }
        // Subtle gradient for non-circle only on circle (skip for complex shapes for perf)
        if (holeShape === "Circle" && !isOverlap && !isClosed && zoom > 0.5) {
          const grad = ctx.createRadialGradient(h.x - r * 0.2, h.y - r * 0.2, 0, h.x, h.y, r);
          grad.addColorStop(0, dark ? "rgba(40,40,45,0.3)" : "rgba(60,60,65,0.2)");
          grad.addColorStop(1, "transparent");
          ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
        // Taper ring: fill gap between entry and exit shapes
        if (showTaperRings && dExit > 0 && !isClosed) {
          ctx.beginPath();
          traceHolePath(ctx, h.x, h.y, holeShape, effW, effH, h.angle, holeRadius);
          // Cut out the exit shape (reverse winding)
          ctx.save();
          ctx.clip();
          // Fill the entire clipped area, then clear the exit shape
          ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
          ctx.fillRect(h.x - diameter, h.y - diameter, diameter * 2, diameter * 2);
          // Clear exit shape by drawing it with the hole color
          ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, exitW, exitH, h.angle, holeRadius);
          ctx.fillStyle = isClosed ? (dark ? "rgba(220,50,50,0.55)" : "rgba(200,30,30,0.45)")
            : (dark ? "#0f0f11" : "#1a1a1e");
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // End hole clipping
    ctx.restore();

    ctx.strokeStyle = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.5; ctx.strokeRect(0, 0, sheetW, sheetH);
    ctx.restore();

    if (perfMode) {
      ctx.fillStyle = dark ? "rgba(220,160,40,0.85)" : "rgba(180,120,20,0.9)";
      ctx.font = "11px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
      ctx.fillText(`⚡ Performance mode (${holeCount.toLocaleString()} holes)`, 12, ch - 12);
    }
  }, [holes, overlaps, params, dark, pan, zoom, perfMode, holeCount, diameter, holeShape, effW, effH, holeRadius, pitchX, pitchY, patternType, marginTop, marginBottom, marginLeft, marginRight, hasAnyMargin, cornerRadius, radialMode, isRadialPattern, sheetW, sheetH, taperActive, dExit, holeClosed, thickness, taperAngle, taperDirection, removedHoles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ro = new ResizeObserver(() => {
      canvas.style.width = containerRef.current.getBoundingClientRect().width + "px";
      canvas.style.height = containerRef.current.getBoundingClientRect().height + "px";
      setPan(p => ({ ...p }));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(z => {
      const nz = clamp(z * factor, 0.1, 20);
      const scale = nz / z;
      setPan(p => ({
        x: mx - scale * (mx - p.x - cx) - cx,
        y: my - scale * (my - p.y - cy) - cy,
      }));
      return nz;
    });
  }, []);

  const pointerDownPos = useRef(null);
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);
  const handlePointerMove = useCallback((e) => {
    if (!isPanning) return;
    setPan({ x: panOrigin.current.x + (e.clientX - panStart.current.x), y: panOrigin.current.y + (e.clientY - panStart.current.y) });
  }, [isPanning]);
  const handlePointerUp = useCallback((e) => {
    setIsPanning(false);
    // Detect click (not drag) for hole removal
    if (holeRemovalMode && pointerDownPos.current) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cw = rect.width, ch = rect.height;
        const fitScale = Math.min((cw - 80) / sheetW, (ch - 80) / sheetH);
        const baseScale = fitScale * zoom;
        const cx = cw / 2 + pan.x, cy = ch / 2 + pan.y;
        // Convert screen coords to sheet coords
        const sheetX = (clickX - cx) / baseScale + sheetW / 2;
        const sheetY = (clickY - cy) / baseScale + sheetH / 2;
        // Find closest hole within diameter
        const r = diameter / 2;
        let closestIdx = -1, closestDist = Infinity;
        holes.forEach((h, i) => {
          const d = Math.hypot(h.x - sheetX, h.y - sheetY);
          if (d < r * 1.5 && d < closestDist) { closestDist = d; closestIdx = i; }
        });
        if (closestIdx >= 0) {
          setRemovedHoles(prev => {
            const next = new Set(prev);
            if (next.has(closestIdx)) next.delete(closestIdx);
            else next.add(closestIdx);
            return next;
          });
        }
      }
    }
    pointerDownPos.current = null;
  }, [holeRemovalMode, holes, diameter, sheetW, sheetH, zoom, pan]);

  // Exports
  const exportSVG = useCallback(() => {
    const blob = new Blob([generateSVGString(activeHoles, params)], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perforation_pattern.svg"; a.click();
  }, [activeHoles, params]);

  const exportPNG = useCallback(() => {
    const oc = document.createElement("canvas");
    oc.width = sheetW * 8; oc.height = sheetH * 8;
    const ctx = oc.getContext("2d");
    const s = Math.min(oc.width / sheetW, oc.height / sheetH);
    ctx.fillStyle = dark ? "#48484f" : "#d4d4da"; ctx.fillRect(0, 0, oc.width, oc.height);
    ctx.save(); ctx.scale(s, s);
    activeHoles.forEach(h => {
      ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, effW, effH, h.angle, holeRadius);
      ctx.fillStyle = (taperActive && holeClosed) ? "rgba(200,30,30,0.5)" : (dark ? "#0f0f11" : "#1a1a1e");
      ctx.fill();
      if (taperActive && dExit > 0 && !holeClosed) {
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, effW, effH, h.angle, holeRadius);
        ctx.save(); ctx.clip();
        ctx.fillStyle = dark ? "rgba(80,85,95,0.6)" : "rgba(160,165,175,0.5)";
        ctx.fillRect(h.x - diameter, h.y - diameter, diameter * 2, diameter * 2);
        ctx.beginPath(); traceHolePath(ctx, h.x, h.y, holeShape, exitW, exitH, h.angle, holeRadius);
        ctx.fillStyle = (dark ? "#0f0f11" : "#1a1a1e");
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
    oc.toBlob(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "perforation_pattern.png"; a.click(); });
  }, [activeHoles, sheetW, sheetH, diameter, holeShape, effW, effH, dark, taperActive, holeClosed, dExit]);

  // Theme
  const sidebarBorder = dark ? "#27272a" : "#e0e0e5";
  const textPrimary = dark ? "#e4e4e7" : "#18181b";
  const textSecondary = dark ? "#71717a" : "#71717a";
  const sectionBorder = dark ? "#222225" : "#ececf0";
  const controlBg = dark ? "#1e1e22" : "#fafafa";
  const btnBg = dark ? "#27272a" : "#e8e8ec";
  const accentColor = dark ? "#60a5fa" : "#2563eb";
  const warnColor = "#ef4444";
  const sectionStyle = { padding: "14px 0", borderBottom: `1px solid ${sectionBorder}` };
  const sectionTitle = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: textSecondary, marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" };

  const isRadial = patternType === "Radial";
  const showGapY = patternType === "Straight" || patternType === "Custom Angle";
  // Effective pitchY for staggered patterns (auto-derived)
  // Uses diagonal distance check: in staggered layouts, nearest neighbor is at (pitchX/2, effPY)
  const _sHalfPX = pitchX / 2;
  const _sMinGap = Math.min(edgeGapX, edgeGapY);
  const _sHoleDim = Math.max(effW, effH);
  const _sMinDist = _sHoleDim + _sMinGap;
  const _sMinPY = Math.sqrt(Math.max(effH * effH, _sMinDist * _sMinDist - _sHalfPX * _sHalfPX));
  const effPitchY = patternType === "Staggered 60°"
    ? Math.max(pitchX * Math.sqrt(3) / 2, _sMinPY)
    : patternType === "Staggered 45°"
      ? Math.max(pitchX, _sMinPY)
      : pitchY;

  // Segmented button helper
  const SegBtn = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      flex: 1, padding: "6px 8px", fontSize: 10, borderRadius: 4,
      border: `1px solid ${active ? accentColor : sidebarBorder}`,
      background: active ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent",
      color: active ? accentColor : textSecondary,
      cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s"
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: dark ? "#111113" : "#f2f2f5", color: textPrimary, fontFamily: "'JetBrains Mono', -apple-system, sans-serif", overflow: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas ref={canvasRef}
          style={{ width: "100%", height: "100%", cursor: isPanning ? "grabbing" : holeRemovalMode ? "crosshair" : "grab" }}
          onWheel={handleWheel} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        />
        {/* Top-left: key stats + warnings */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
          {/* OAR + Holes summary */}
          <div style={{ background: dark ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", padding: "8px 12px", borderRadius: 6, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: accentColor, lineHeight: 1 }}>{displayOAR.toFixed(1)}</span>
              <span style={{ fontSize: 10, color: textSecondary }}>% OAR</span>
              {taperActive && <span style={{ fontSize: 9, color: dark ? "#f87171" : "#dc2626", marginLeft: 2 }}>{oarDelta < 0 ? `(${oarDelta.toFixed(1)}%p taper)` : ""}</span>}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary }}>Holes <span style={{ color: textPrimary, fontWeight: 500 }}>{activeHoleCount.toLocaleString()}</span>{hasRemovedHoles ? <span style={{ color: warnColor }}> / {holeCount.toLocaleString()}</span> : ""}</span>
              <span style={{ fontSize: 10, color: textSecondary }}>{zoom.toFixed(1)}x</span>
            </div>
          </div>
          {/* Warning badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {hasOverlap && <span style={{ fontSize: 10, color: "#fff", background: warnColor, padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>⚠ Holes overlap</span>}
            {taperActive && holeClosed && <span style={{ fontSize: 10, color: "#fff", background: warnColor, padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>⚠ {closedHoleCount}/{activeHoleCount} holes closed</span>}
            {holeRemovalMode && <span style={{ fontSize: 10, color: "#fff", background: dark ? "#7c3aed" : "#6d28d9", padding: "3px 8px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace" }}>HOLE REMOVAL MODE{removedHoles.size > 0 ? ` (${removedHoles.size} removed)` : ""}</span>}
          </div>
        </div>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={{ position: "absolute", bottom: 12, left: 12, fontSize: 10, color: textSecondary, background: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.7)", padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", backdropFilter: "blur(8px)" }}>
          Reset View
        </button>
      </div>

      {/* Sidebar */}
      <div style={{ width: 440, minWidth: 440, height: "100vh", overflowY: "auto", overflowX: "hidden", background: dark ? "#18181b" : "#ffffff", borderLeft: `1px solid ${sidebarBorder}`, padding: "0 20px", boxSizing: "border-box", scrollbarWidth: "thin", scrollbarColor: dark ? "#333 transparent" : "#ccc transparent" }}>

        {/* Header */}
        <div style={{ padding: "14px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${sectionBorder}` }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.3 }}>Perf Pattern</div>
            <div style={{ fontSize: 9, color: textSecondary, marginTop: 2, letterSpacing: 0.5 }}>CIRCULAR PERFORATION GENERATOR</div>
          </div>
          <button onClick={() => setDark(d => !d)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${sidebarBorder}`, background: controlBg, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: textPrimary }}>
            {dark ? "☀" : "☽"}
          </button>
        </div>

        {/* Gauge + Stats */}
        <div style={{ ...sectionStyle, textAlign: "center" }}>
          <Gauge value={clamp(displayOAR, 0, 100)} nominalValue={taperActive ? clamp(nominalOAR, 0, 100) : null} dark={dark} />

          {taperActive && (
            <div style={{ margin: "8px 0 4px", padding: "6px 8px", borderRadius: 5, background: dark ? "rgba(96,165,250,0.06)" : "rgba(37,99,235,0.04)", border: `1px solid ${dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.1)"}`, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: textSecondary }}>Surface OAR</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: dark ? "#999" : "#666" }}>{nominalOAR.toFixed(1)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: textSecondary }}>Effective OAR (through-thickness)</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>{effectiveOAR.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: 9, color: oarDelta < 0 ? (dark ? "#f87171" : "#dc2626") : textSecondary, textAlign: "center", padding: "2px 0 0", borderTop: `1px solid ${dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}` }}>
                {oarDelta < 0 ? `${oarDelta.toFixed(1)}%p due to taper` : "No taper loss"}
              </div>
              {dExit > 0 && !holeClosed && <div style={{ fontSize: 9, color: textSecondary, textAlign: "center", marginTop: 3 }}>d_exit = {dExit.toFixed(2)} mm</div>}
            </div>
          )}
          {taperActive && holeClosed && (
            <div style={{ margin: "6px 0", padding: "6px 8px", borderRadius: 5, background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`, fontSize: 10, color: warnColor, textAlign: "left", lineHeight: 1.4 }}>
              Taper closes the hole at this thickness. Reduce angle or increase diameter.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginTop: 8 }}>
            {[
              ["Total Holes", holeCount.toLocaleString()],
              ["Active Holes", hasRemovedHoles ? activeHoleCount.toLocaleString() : holeCount.toLocaleString()],
              ["Hole Area", `${singleHoleArea.toFixed(2)} mm²`],
              ["Open Area", `${(singleHoleArea * activeHoleCount).toFixed(1)} mm²`],
              ["Panel Area", `${grossArea.toFixed(0)} mm²`],
              ["Perf. Area", `${perforatedArea.toFixed(0)} mm²`],
            ].map(([l, v]) => (
              <div key={l} style={{ textAlign: "left" }}>
                <div style={{ fontSize: 9, color: textSecondary }}>{l}</div>
                <div style={{ fontSize: 11, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          {minLigament !== null && (
            <div style={{ marginTop: 8, padding: "5px 8px", borderRadius: 4, background: minLigament <= 0 ? (dark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)") : (dark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.08)"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: textSecondary }}>Min Ligament</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: minLigament <= 0 ? warnColor : accentColor }}>{minLigament.toFixed(2)} mm</span>
            </div>
          )}
        </div>

        {/* Pattern */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Pattern</div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Preset (DIN 24041)</div>
            <select value={selectedPreset} onChange={e => applyPreset(parseInt(e.target.value))}
              style={{ width: "100%", height: 30, fontSize: 11, background: controlBg, color: textPrimary, border: `1px solid ${sidebarBorder}`, borderRadius: 4, padding: "0 8px", outline: "none", fontFamily: "'JetBrains Mono', monospace", cursor: "pointer" }}>
              {DIN_PRESETS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PATTERN_TYPES.map(pt => (
                <button key={pt} onClick={() => { setPatternType(pt); setSelectedPreset(0); }}
                  style={{ padding: "5px 10px", fontSize: 10, borderRadius: 4, border: `1px solid ${patternType === pt ? accentColor : sidebarBorder}`, background: patternType === pt ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent", color: patternType === pt ? accentColor : textSecondary, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>
                  {pt}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Hole Shape</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {HOLE_SHAPES.map(s => (
                <button key={s} onClick={() => handleShapeChange(s)}
                  style={{ padding: "5px 10px", fontSize: 10, borderRadius: 4, border: `1px solid ${holeShape === s ? accentColor : sidebarBorder}`, background: holeShape === s ? (dark ? "rgba(96,165,250,0.15)" : "rgba(37,99,235,0.08)") : "transparent", color: holeShape === s ? accentColor : textSecondary, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {hasCustomSize ? (
            <>
              <SliderRow label="Width (W)" value={holeW} min={0.5} max={30} step={0.1} onChange={v => { setHoleW(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
              <SliderRow label="Height (H)" value={holeH} min={0.5} max={30} step={0.1} onChange={v => { setHoleH(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
              {holeShape === "Rectangle" && <SliderRow label="Hole Corner R" value={holeRadius} min={0} max={Math.min(holeW, holeH) / 2} step={0.1} onChange={setHoleRadius} unit="mm" dark={dark} />}
            </>
          ) : (
            <SliderRow label="Hole Diameter" value={diameter} min={0.5} max={20} step={0.1} onChange={v => { setDiameter(v); setSelectedPreset(0); }} unit="mm" dark={dark} />
          )}
          {patternType === "Custom Angle" && <SliderRow label="Stagger Angle" value={customAngle} min={0} max={90} step={1} onChange={setCustomAngle} unit="°" dark={dark} />}
        </div>

        {/* Dimensions */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Dimensions</div>
          {isRadial ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Gap Link</span>
                <button onClick={() => { setRadialLinked(v => !v); if (!radialLinked) setCircumEdgeGap(radialEdgeGap); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                  title={radialLinked ? "Unlink gap" : "Link gap"}>
                  <LinkIcon linked={radialLinked} dark={dark} />
                </button>
              </div>
              <SliderRow label="Radial Edge Gap" value={radialEdgeGap} min={0} max={50} step={0.1} onChange={handleRadialEdgeGap} unit="mm" dark={dark} />
              <PitchInfo label="ring spacing" value={ringSpacing} dark={dark} />
              {!radialLinked && <>
                <SliderRow label="Circum. Edge Gap" value={circumEdgeGap} min={0} max={50} step={0.1} onChange={handleCircumEdgeGap} unit="mm" dark={dark} />
                <PitchInfo label="circum. spacing" value={circumSpacing} dark={dark} />
              </>}
              {radialLinked && <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>Circum. Edge Gap: {radialEdgeGap.toFixed(2)} mm (linked)</div>}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Fill Mode</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Full", "Circle"].map(m => (
                    <SegBtn key={m} label={m} active={radialMode === m} onClick={() => setRadialMode(m)} />
                  ))}
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: textSecondary, cursor: "pointer", marginTop: 4 }}>
                <input type="checkbox" checked={centerHole} onChange={e => setCenterHole(e.target.checked)} style={{ accentColor }} />
                Center hole
              </label>
            </>
          ) : showGapY ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Gap Link (X = Y)</span>
                <button onClick={() => { setGapLinked(v => !v); if (!gapLinked) setEdgeGapY(edgeGapX); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                  title={gapLinked ? "Unlink gap" : "Link gap"}>
                  <LinkIcon linked={gapLinked} dark={dark} />
                </button>
              </div>
              <SliderRow label={gapLinked ? "Edge Gap (X = Y)" : "X Edge Gap"} value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label={gapLinked ? "pitch" : "X pitch"} value={pitchX} dark={dark} />
              {!gapLinked && <>
                <SliderRow label="Y Edge Gap" value={edgeGapY} min={0} max={50} step={0.1} onChange={handleEdgeGapY} unit="mm" dark={dark} />
                <PitchInfo label="Y pitch" value={pitchY} dark={dark} />
              </>}
            </>
          ) : (
            <>
              <SliderRow label="X Edge Gap" value={edgeGapX} min={0} max={50} step={0.1} onChange={handleEdgeGapX} unit="mm" dark={dark} />
              <PitchInfo label="X pitch" value={pitchX} dark={dark} />
              <div style={{ fontSize: 10, color: textSecondary, marginBottom: 8, padding: "2px 0" }}>
                Y Edge Gap: {(effPitchY - effH).toFixed(2)} mm (auto)
                <span style={{ marginLeft: 6, fontSize: 9, color: dark ? "#555" : "#aaa" }}>
                  pitch {effPitchY.toFixed(2)}
                </span>
              </div>
            </>
          )}
          <SliderRow label="Panel Width" value={sheetW} min={10} max={1000} step={1} onChange={setSheetW} unit="mm" dark={dark} />
          <SliderRow label="Panel Height" value={sheetH} min={10} max={1000} step={1} onChange={setSheetH} unit="mm" dark={dark} />
          {/* Margin section */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: textSecondary, flex: 1 }}>Margin {marginLinked ? "(Uniform)" : "(Per-side)"}</span>
              <button onClick={() => { setMarginLinked(v => !v); if (!marginLinked) { const m = marginTop; setMarginBottom(m); setMarginLeft(m); setMarginRight(m); } }}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, borderRadius: 4, display: "flex", alignItems: "center", opacity: 0.8 }}
                title={marginLinked ? "Set per-side margins" : "Use uniform margin"}>
                <LinkIcon linked={marginLinked} dark={dark} />
              </button>
            </div>
            {marginLinked ? (
              <SliderRow label="Margin" value={marginTop} min={0} max={50} step={0.5} onChange={handleMarginUniform} unit="mm" dark={dark} />
            ) : (
              <>
                <SliderRow label="Margin Top" value={marginTop} min={0} max={50} step={0.5} onChange={setMarginTop} unit="mm" dark={dark} />
                <SliderRow label="Margin Bottom" value={marginBottom} min={0} max={50} step={0.5} onChange={setMarginBottom} unit="mm" dark={dark} />
                <SliderRow label="Margin Left" value={marginLeft} min={0} max={50} step={0.5} onChange={setMarginLeft} unit="mm" dark={dark} />
                <SliderRow label="Margin Right" value={marginRight} min={0} max={50} step={0.5} onChange={setMarginRight} unit="mm" dark={dark} />
              </>
            )}
          </div>
          <SliderRow label="Corner Radius" value={cornerRadius} min={0} max={Math.min(perfW / 2, perfH / 2)} step={0.5} onChange={setCornerRadius} unit="mm" dark={dark} />
        </div>

        {/* Taper */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Sheet Thickness & Hole Taper</div>
          <SliderRow label="Thickness (t)" value={thickness} min={0} max={10} step={0.1} onChange={setThickness} unit="mm" dark={dark} />
          <SliderRow label="Taper Angle (θ)" value={taperAngle} min={0} max={15} step={0.1} onChange={setTaperAngle} unit="°" dark={dark} />
          {taperActive && (
            <>
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 10, color: textSecondary, marginBottom: 6 }}>Taper Direction</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {["Top larger", "Bottom larger"].map(dir => <SegBtn key={dir} label={dir} active={taperDirection === dir} onClick={() => setTaperDirection(dir)} />)}
                </div>
              </div>
              <div style={{ marginTop: 8, padding: "5px 8px", borderRadius: 4, background: holeClosed ? (dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)") : (dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: textSecondary }}>Exit Diameter</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: holeClosed ? warnColor : accentColor }}>{holeClosed ? "0 (closed)" : `${dExit.toFixed(2)} mm`}</span>
              </div>
            </>
          )}
          {!taperActive && <div style={{ fontSize: 9, color: dark ? "#444" : "#bbb", marginTop: 6, lineHeight: 1.4 }}>Set thickness and angle above 0 to enable taper compensation.</div>}
        </div>

        {/* Hole Removal */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Hole Removal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Click to Remove</span>
              <Toggle value={holeRemovalMode} onChange={setHoleRemovalMode} dark={dark} />
            </label>
            {holeRemovalMode && <div style={{ fontSize: 9, color: dark ? "#888" : "#888", lineHeight: 1.4 }}>Click holes on the canvas to remove/restore them. OAR recalculates automatically.</div>}
            {removedHoles.size > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: dark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)" }}>
                  <span style={{ fontSize: 10, color: textSecondary }}>Removed</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: warnColor }}>{removedHoles.size} holes</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.05)" }}>
                  <span style={{ fontSize: 10, color: textSecondary }}>Active</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>{activeHoleCount} holes</span>
                </div>
                <button onClick={() => setRemovedHoles(new Set())}
                  style={{ padding: "5px 0", fontSize: 10, fontWeight: 500, background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", color: warnColor, border: `1px solid ${dark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.2)"}`, borderRadius: 4, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
                  Restore All Holes
                </button>
              </>
            )}
          </div>
        </div>


        {/* Export */}
        <div style={{ ...sectionStyle, borderBottom: "none", paddingBottom: 20 }}>
          <div style={sectionTitle}>Export</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["SVG", exportSVG], ["PNG 2x", exportPNG]].map(([label, fn]) => (
              <button key={label} onClick={fn} style={{
                flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 500,
                background: btnBg, color: textPrimary, border: "none", borderRadius: 5,
                cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "background 0.15s"
              }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? "#333338" : "#d4d4da"}
                onMouseLeave={e => e.currentTarget.style.background = btnBg}>
                ↓ {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${accentColor}; cursor: pointer; border: 2px solid ${dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${accentColor}; cursor: pointer; border: 2px solid ${dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        select option { background: ${dark ? "#1e1e22" : "#fff"}; color: ${textPrimary}; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${dark ? "#333" : "#ccc"}; border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
