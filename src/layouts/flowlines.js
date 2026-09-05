// Flow Lines: evenly spaced streamlines of a direction field, cut as slots.
//
// This is the one layout whose output is not a set of points. Each "hole" is a
// centreline the generator integrated through the field, and the width along it
// comes later, from the size channel, in decorateHoles — so a slot narrows and
// widens the way a hole grows and shrinks, and for the same reason: what a
// controller does to how a hole is DRAWN must not move it.
//
// The direction at a point is the layout's own base angle plus whatever the
// angle channel adds there. That makes the angle channel a placement input in
// this mode and only in this mode, which is why `compilePlacement` compiles it
// here and why an image cannot drive it (see layoutPlacementChannels in
// ./index.js): a picture decodes asynchronously and does not travel in a share
// link, so a line that followed one would land somewhere else on a reload.
//
// The even spacing is Jobard and Lefebvre's: integrate a line, then walk along
// it dropping candidate seeds a separation to either side, keep the ones far
// enough from every line already drawn, and repeat until nothing new fits. The
// result has no lattice and no clumping, and the separation is a field, so a
// spacing controller thins or crowds the lines without breaking either.
//
// What the mode guarantees is the same thing Voronoi guarantees, and it is the
// reason to prefer this construction to hatching a field by brute force: the
// metal left between two neighbouring slots is the edge gap, everywhere.
import { SpatialHash } from "../geometry/spatial-hash.js";
import { isInsideRoundedRect } from "../geometry/rounded-rect.js";
import { distPointSeg, segmentGap } from "../geometry/polygon.js";

// The integration step, as a fraction of the local separation. Half a separation
// keeps a line's own curvature well inside what its outline can be offset around
// and still costs only two samples of the field per separation walked.
const STEP = 0.5;
// How close two centrelines may come, in separations, and the reason it is a
// bare 1: a separation is the slot's own width plus the edge gap, so lines a
// separation apart leave exactly the edge gap of metal between them. Seeds are
// placed at that same distance, so where the field is uniform the lines land
// exactly a separation apart rather than somewhere inside a tolerance.
const SEPARATIONS = 1;
// Slack on that comparison, relative: a seed placed at exactly one separation
// must not be turned away by the last bit of a square root.
const TOLERANCE = 1e-9;
// The sharpest turn one step may take. A line that turned faster than this would
// curve tighter than its own half-width, and the two sides of its outline would
// cross — which fills as a pinch or a hole rather than as a slot.
const MAX_TURN = Math.PI / 6;
// How many of its own most recent steps a line does not test itself against.
// They are one step away by construction; everything before them is tested.
const SELF_LAG = 4;
// Fewer vertices than this is a dash, not a line.
const MIN_LINE_POINTS = 3;

export const MAX_FLOW_LINES = 1_000;
// Total centreline vertices. Past this the mode refuses rather than drawing part
// of the panel: the lines grow outward from the first one, so a cap would leave
// a patch of pattern in a blank sheet.
export const MAX_FLOW_POINTS = 120_000;
const MAX_LINE_STEPS = 4_000;

// A binary min-heap of seed candidates, ordered by the separation the field asks
// for where each one sits.
//
// The order is the whole point. Candidates are offered by the lines already
// drawn, so a line that begins in a sparse corner offers its sparse candidates
// first; taken in that order they claim the ground a denser part of the sheet
// needed, and the crowded region then has no room left to be crowded in. Under a
// point controller pulling the separation to half, that cost every one of the
// closer lines it asked for. Densest first, and each region gets the spacing it
// was asked for whatever order the lines happened to reach it in.
class SeedQueue {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(item) {
    const items = this.items;
    items.push(item);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (items[parent].r <= items[i].r) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      for (let i = 0; ;) {
        const left = 2 * i + 1,
          right = left + 1;
        let small = i;
        if (left < items.length && items[left].r < items[small].r) small = left;
        if (right < items.length && items[right].r < items[small].r) small = right;
        if (small === i) break;
        [items[small], items[i]] = [items[i], items[small]];
        i = small;
      }
    }
    return top;
  }
}

// Keep a direction within MAX_TURN of the one before it.
function limitTurn(px, py, nx, ny) {
  const turn = Math.atan2(px * ny - py * nx, px * nx + py * ny);
  if (Math.abs(turn) <= MAX_TURN) return [nx, ny];
  const a = Math.atan2(py, px) + Math.sign(turn) * MAX_TURN;
  return [Math.cos(a), Math.sin(a)];
}

export function generateFlowLines({ bounds, cornerRadius = 0, width, separation, baseAngle = 0, angle, spacing }) {
  const { xMin, xMax, yMin, yMax } = bounds;
  if (!(xMax > xMin) || !(yMax > yMin) || !(separation > 0)) return [];

  // The centreline stays half a width inside the boundary, so the slot itself
  // ends at the boundary rather than half over it. Insetting a rounded rectangle
  // takes the same off its corner radius.
  const half = Math.max(0, width) / 2;
  const inner = { xMin: xMin + half, xMax: xMax - half, yMin: yMin + half, yMax: yMax - half };
  const innerRadius = Math.max(0, cornerRadius - half);
  if (!(inner.xMax > inner.xMin) || !(inner.yMax > inner.yMin)) return [];

  const lowest = spacing ? Math.max(1e-6, spacing.min) : 1;
  const finest = separation * lowest;
  // Lines a separation apart, sampled every STEP of one, cover the panel with
  // about area / (STEP · sep²) vertices. Refused before the first line is drawn.
  if ((xMax - xMin) * (yMax - yMin) > MAX_FLOW_POINTS * STEP * finest * finest) return [];

  const sepAt = spacing ? (x, y) => separation * spacing.sample(x, y) : () => separation;
  const dirAt = (x, y) => {
    const radians = ((baseAngle + (angle ? angle.sample(x, y) : 0)) * Math.PI) / 180;
    return [Math.cos(radians), Math.sin(radians)];
  };
  const insideBoundary = (x, y) =>
    isInsideRoundedRect(x, y, inner.xMin, inner.yMin, inner.xMax, inner.yMax, innerRadius);
  // A point of a line, carrying the clearance the field asks for there.
  const at = (x, y) => ({ x, y, r: sepAt(x, y) * SEPARATIONS });

  // Segments, in a grid by their midpoints. A new step measures its distance to
  // the LINES already drawn, not to samples of them: two segments can each have
  // both ends a full separation from a curve and still pass closer than that in
  // the middle, where the curve bends toward them. Measured, testing the end
  // point alone left 2.83 mm of metal under an angle controller on a pattern
  // asked for 3 mm. Segment to segment is the exact question, and the same one
  // `calcMinLigament` asks afterwards, so the two agree by construction.
  const cellSize = separation * Math.sqrt(lowest);
  const store = () => ({ hash: new SpatialHash(cellSize), list: [], longest: 0 });
  const add = (into, a, b) => {
    into.longest = Math.max(into.longest, Math.hypot(b.x - a.x, b.y - a.y));
    into.hash.insert((a.x + b.x) / 2, (a.y + b.y) / 2, into.list.length);
    into.list.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: Math.min(a.r, b.r) });
  };
  // Required clearance is min(what this step asks for, what that segment asked
  // for) — the same rule the scatter sampler makes about two holes of different
  // radii, and for the same reason: under `max` a sparse line would cast a shadow
  // no dense line could enter and the pattern would seam wherever the field
  // changed; under `min` the dense side packs up to the edge of the sparse one.
  //
  // `skipFrom` is how a line ignores the few steps it has just taken, which are
  // one step away by construction.
  const tooClose = (into, a, b, skipFrom = Infinity) => {
    const reach = b.r + into.longest / 2 + Math.hypot(b.x - a.x, b.y - a.y) / 2;
    return into.hash.forEachNear((a.x + b.x) / 2, (a.y + b.y) / 2, reach, index => {
      if (index >= skipFrom) return false;
      const s = into.list[index];
      return segmentGap([a.x, a.y], [b.x, b.y], [s.ax, s.ay], [s.bx, s.by]) < Math.min(b.r, s.r) * (1 - TOLERANCE);
    });
  };
  const pointTooClose = (into, p) =>
    into.hash.forEachNear(p.x, p.y, p.r + into.longest / 2, index => {
      const s = into.list[index];
      return distPointSeg(p.x, p.y, s.ax, s.ay, s.bx, s.by) < Math.min(p.r, s.r) * (1 - TOLERANCE);
    });

  const world = store();

  // One half of a line, from the seed outward. `sign` is which way along the
  // field: −1 walks the same curve backwards.
  //
  // The line's own segments go into a grid of their own as they are drawn, so a
  // field that turns right round cannot lay a line back over itself. Everything
  // but the last few steps is tested, however long ago it was walked: a wide
  // vortex closes on itself hundreds of steps later, and a fixed window of recent
  // steps would miss exactly that.
  const walk = (from, sign) => {
    const out = [];
    const own = store();
    let current = from;
    let [dx, dy] = dirAt(current.x, current.y);
    dx *= sign;
    dy *= sign;
    for (let step = 0; step < MAX_LINE_STEPS; step++) {
      const h = Math.max(1e-6, current.r * STEP);
      // Midpoint rule: the direction at the middle of the step, not at its start,
      // which is what keeps a line from spiralling out of a curving field.
      let [mx, my] = dirAt(current.x + (dx * h) / 2, current.y + (dy * h) / 2);
      [mx, my] = limitTurn(dx, dy, mx * sign, my * sign);
      const next = at(current.x + mx * h, current.y + my * h);
      if (!insideBoundary(next.x, next.y)) break;
      if (tooClose(world, current, next) || tooClose(own, current, next, out.length - SELF_LAG)) break;
      add(own, current, next);
      out.push(next);
      current = next;
      dx = mx;
      dy = my;
    }
    return out;
  };

  const lines = [];
  const pending = new SeedQueue();
  let vertices = 0;
  const full = () => lines.length >= MAX_FLOW_LINES || vertices >= MAX_FLOW_POINTS;

  // Candidates a separation to either side of a line, at intervals of a
  // separation along it. Every place a neighbouring line could go.
  const offerSeeds = line => {
    let since = Infinity;
    for (let i = 0; i < line.length; i++) {
      if (i > 0) since += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y);
      if (since < line[i].r) continue;
      since = 0;
      const a = line[Math.max(0, i - 1)],
        b = line[Math.min(line.length - 1, i + 1)];
      const tx = b.x - a.x,
        ty = b.y - a.y;
      const length = Math.hypot(tx, ty) || 1;
      const nx = (-ty / length) * line[i].r,
        ny = (tx / length) * line[i].r;
      for (const [sx, sy] of [
        [line[i].x + nx, line[i].y + ny],
        [line[i].x - nx, line[i].y - ny],
      ]) {
        if (insideBoundary(sx, sy)) pending.push(at(sx, sy));
      }
    }
  };

  const seed = from => {
    if (pointTooClose(world, from)) return;
    // Both ways from the seed and then joined: one line through the field, not
    // two half lines that happen to meet.
    const back = walk(from, -1);
    const forward = walk(from, 1);
    back.reverse();
    const points = [...back, from, ...forward];
    if (points.length < MIN_LINE_POINTS) return;
    for (let i = 1; i < points.length; i++) add(world, points[i - 1], points[i]);
    vertices += points.length;
    lines.push(points);
    offerSeeds(points);
  };

  const middle = at((xMin + xMax) / 2, (yMin + yMax) / 2);
  if (!insideBoundary(middle.x, middle.y)) return [];
  seed(middle);
  while (pending.size > 0 && !full()) seed(pending.pop());

  // Each line becomes one hole, placed at the middle of its own extent so that
  // the field controllers sample it somewhere near it, and carrying its
  // centreline relative to that point.
  return lines.map(points => {
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    for (const point of points) {
      if (point.x < left) left = point.x;
      if (point.x > right) right = point.x;
      if (point.y < top) top = point.y;
      if (point.y > bottom) bottom = point.y;
    }
    const cx = (left + right) / 2,
      cy = (top + bottom) / 2;
    return { x: cx, y: cy, stroke: { pts: points.map(point => [point.x - cx, point.y - cy]) } };
  });
}
