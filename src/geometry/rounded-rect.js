// Axis-aligned rounded rectangle helpers (used by the Rectangle hole and the
// rectangular perforation boundary).

export function isInsideRoundedRect(px, py, x1, y1, x2, y2, cr) {
  if (cr <= 0) return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  const maxR = Math.min((x2 - x1) / 2, (y2 - y1) / 2);
  const r = Math.min(cr, maxR);
  if (px >= x1 + r && px <= x2 - r && py >= y1 && py <= y2) return true;
  if (px >= x1 && px <= x2 && py >= y1 + r && py <= y2 - r) return true;
  const corners = [
    [x1 + r, y1 + r],
    [x2 - r, y1 + r],
    [x1 + r, y2 - r],
    [x2 - r, y2 - r],
  ];
  for (const [cx, cy] of corners) {
    if (Math.hypot(px - cx, py - cy) <= r) return true;
  }
  return false;
}

export function roundedRectArea(w, h, cr) {
  if (cr <= 0) return w * h;
  const maxR = Math.min(w / 2, h / 2);
  const r = Math.min(cr, maxR);
  return w * h - 4 * r * r + Math.PI * r * r;
}
