import test from "node:test";
import assert from "node:assert/strict";
import { SpatialHash, forEachNeighbourPair } from "./spatial-hash.js";

const grid = (n, step) => {
  const points = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) points.push({ x: i * step, y: j * step });
  return points;
};

test("forEachNear finds everything within the radius, whatever the cell size", () => {
  // Correctness must not depend on the cell size — the scatter sampler picks one
  // from a heuristic, and a query that missed a neighbour would place two holes
  // on top of one another.
  const points = grid(12, 3.7).map((p, i) => ({ ...p, i }));
  for (const cellSize of [0.3, 1, 3.7, 11, 250]) {
    const hash = new SpatialHash(cellSize);
    for (const p of points) hash.insert(p.x, p.y, p.i);
    for (const query of [
      [0, 0, 5],
      [20, 20, 0.5],
      [18.5, 18.5, 12],
      [-40, 7, 45],
    ]) {
      const [x, y, radius] = query;
      const found = new Set();
      hash.forEachNear(x, y, radius, i => {
        if (Math.hypot(points[i].x - x, points[i].y - y) <= radius) found.add(i);
      });
      const expected = points.filter(p => Math.hypot(p.x - x, p.y - y) <= radius).map(p => p.i);
      assert.deepEqual([...found].sort((a, b) => a - b), expected, `cell ${cellSize} query ${query}`); // prettier-ignore
    }
  }
});

test("negative coordinates and the far side of the origin do not collide", () => {
  // The cells are packed into one number, so a sign error would put (−1, 0) and
  // (0, −1) — or a point far out — in the same bucket as something else.
  const hash = new SpatialHash(1);
  const points = [
    [-5.5, -5.5],
    [-5.5, 5.5],
    [5.5, -5.5],
    [5.5, 5.5],
    [0, 0],
  ];
  points.forEach(([x, y], i) => hash.insert(x, y, i));
  for (const [i, [x, y]] of points.entries()) {
    const found = [];
    hash.forEachNear(x, y, 0.1, j => void found.push(j));
    assert.deepEqual(found, [i], `${x},${y}`);
  }
});

test("forEachNear stops early when the visitor says so", () => {
  const hash = new SpatialHash(1);
  for (let i = 0; i < 50; i++) hash.insert(0.5, 0.5, i);
  let seen = 0;
  const hit = hash.forEachNear(0.5, 0.5, 0.4, () => {
    seen++;
    return true;
  });
  assert.equal(hit, true);
  assert.equal(seen, 1);
  assert.equal(
    hash.forEachNear(50, 50, 0.4, () => true),
    false
  );
});

test("forEachNeighbourPair visits each close pair exactly once", () => {
  const points = grid(6, 2);
  const cellSize = 2.5;
  const seen = [];
  forEachNeighbourPair(points, cellSize, (i, j) => seen.push(`${i}-${j}`));
  assert.equal(new Set(seen).size, seen.length, "a pair was visited twice");
  assert.ok(
    seen.every(key => Number(key.split("-")[1]) > Number(key.split("-")[0])),
    "pairs must come out ordered"
  );
  // Every pair within one cell has to be there; pairs further apart may or may
  // not be, which is what makes the caller responsible for the cell size.
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const close = Math.abs(points[i].x - points[j].x) <= cellSize && Math.abs(points[i].y - points[j].y) <= cellSize;
      if (close) assert.ok(seen.includes(`${i}-${j}`), `missed ${i}-${j}`);
    }
  }
});

test("an empty or single-point set is not a special case", () => {
  const seen = [];
  forEachNeighbourPair([], 1, (i, j) => seen.push([i, j]));
  forEachNeighbourPair([{ x: 0, y: 0 }], 1, (i, j) => seen.push([i, j]));
  assert.deepEqual(seen, []);
});
