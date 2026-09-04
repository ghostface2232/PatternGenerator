// Canvas view transform: sheet mm ↔ canvas CSS pixels. The sheet is fitted into
// the canvas with an 80px margin, then scaled by `zoom` about the canvas centre
// and offset by `pan` (pixels).
export const FIT_PADDING = 80;

export function computeView(cw, ch, sheetW, sheetH, pan, zoom) {
  const fitScale = Math.min((cw - FIT_PADDING) / sheetW, (ch - FIT_PADDING) / sheetH);
  const baseScale = fitScale * zoom;
  const cx = cw / 2 + pan.x,
    cy = ch / 2 + pan.y;
  return {
    baseScale,
    cx,
    cy,
    originX: cx - (baseScale * sheetW) / 2,
    originY: cy - (baseScale * sheetH) / 2,
  };
}

export function canvasToSheet(view, px, py) {
  return { x: (px - view.originX) / view.baseScale, y: (py - view.originY) / view.baseScale };
}

// Zoom by `factor` keeping the canvas point (mx, my) fixed. Returns the new pan.
export function zoomAbout(pan, zoom, nextZoom, mx, my, cw, ch) {
  const scale = nextZoom / zoom;
  const cx = cw / 2,
    cy = ch / 2;
  return {
    x: mx - scale * (mx - pan.x - cx) - cx,
    y: my - scale * (my - pan.y - cy) - cy,
  };
}
