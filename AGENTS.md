# AGENTS.md

Guidance for AI coding agents working on this repository.

## What this is

A single-page React app that generates perforation patterns (holes in a metal sheet) and exports them as SVG/PNG. No backend, no router, no state library — one big component plus one pure math module.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm test           # node --test src/*.test.js  (plain Node, no JSX transform)
npm run build      # vite build → docs/
```

There is no linter or formatter configured. Match the existing code style by eye.

## Repository conventions

- **`docs/` is the deployed site** (GitHub Pages) and is committed. After any source change, run `npm run build` and include the regenerated `docs/` in the same commit. Never edit `docs/` by hand.
- **Tests run in plain Node** (`node --test`), so test files can only import pure `.js` modules (e.g. `variation-engine.js`), never `.jsx`.
- All geometry is in **millimeters, sheet space** (origin = sheet top-left, y down). Canvas zoom/pan is applied as a transform at draw time only.
- UI is inline-styled with a `dark` boolean theme; follow the existing `SliderRow` / `Toggle` / `SegBtn` patterns for new controls. Labels are in English, JetBrains Mono, terse.

## Architecture

### `src/perforation-generator.jsx` (~2200 lines, everything)

Layout, top to bottom:

1. **Module-level pure helpers** — constants (`HOLE_SHAPES`, `PATTERN_TYPES`, `DIN_PRESETS`), variation-gizmo math, and all shape geometry: area, canvas path tracing, SVG element strings, point-in-hole tests, overlap/gap (ligament) computation, convex-polygon utilities (Diamond/Triangle), and `generateHoles(params)` which turns parameters into hole centers.
2. **Small components** — `Gauge`, `SliderRow`, `Toggle`, icons.
3. **`PerforationGenerator`** — all state, derived memos, a canvas-render `useEffect`, pointer handlers (pan/zoom, variation gizmo drag, hole removal), exports, and the sidebar JSX.

Data pipeline (all memoized):

```
params → generateHoles() → baseHoles (centers + optional per-hole rotation `angle`)
       → holes memo: applies size-variation scale, taper exit sizes, cull flags
       → activeHoles (minus removed/culled) → stats (OAR, ligament, overlaps) + canvas + exports
```

### Adding or changing a hole shape

Shape behavior is branched by string name in several functions that **must stay consistent** with each other:

- `calcHoleArea` — exact area (used by OAR)
- `traceHolePath` — canvas Path2D drawing (also used by PNG export)
- `holeSVGElement` — SVG export string
- `isPointInsideHole` — hit test (drives visible-area estimation at panel edges)
- `checkShapeOverlap` / `calcShapeGap` — overlap warning and min-ligament stat
- `estimateVisibleHoleArea` — bounding box logic for edge-clipped holes
- `generateHoles` — placement; special lattices live here
- UI: `HOLE_SHAPES`, `CUSTOM_SIZE_SHAPES`, size/corner-radius sliders in the Pattern section

Diamond and Triangle are convex polygons sharing generic helpers (`basePolyVerts`, `tracePolyPath`, `roundedPolySVGPath`, `isInsideRoundedPoly`, `convexPolyGap`). Rotation (radial patterns, Diamond "Flat up", point-down Triangles) is expressed as a per-hole `angle` set at generation time; downstream code only reads `hole.angle`.

### Uniform-ligament tilings

Three shape/pattern combos replace the generic grid with an exact tiling where the edge gap is a uniform ligament on every side (seamless at gap 0): Hexagon + Staggered 60° (honeycomb), Triangle + any non-radial type (alternating ▲▽ rows), Diamond + Staggered 60° (rhombus lattice). The trick is always the same: lay out the lattice of the hole *expanded outward by gap/2*, then draw the actual hole inset at the shared incenter. Theoretical OAR for these uses the tiling cell area, not pitch×pitch.

### `src/variation-engine.js`

Pure, UI-free scalar-field math for size variation (spaces × profiles × blending). Keep it dependency-free and side-effect-free — it is the only unit-tested module. Add tests in `src/variation-engine.test.js` when touching it.

## Gotchas

- Patterns above **10,000 holes** switch to a reduced "performance mode" render, and overlap/ligament computation is skipped.
- `holes` positions include centers slightly outside the perforation bounds (within one hole radius); edge clipping is handled visually and by `estimateVisibleHoleArea`, not by dropping holes.
- OAR has two paths: theoretical (unit cell) for clean infinite patterns, counted (visible area sampling) whenever margins, corner radius, removal, variation, or radial mode make the theoretical value wrong.
- The service worker caches aggressively in production; `index.html` unregisters it in dev. Bump `CACHE_NAME` in `public/sw.js` if app-shell files change.
- Verify geometry changes in a real browser (the repo has no component tests): run the dev server and check that gap 0 on the seamless tilings reads 100.0% OAR and that Min Ligament equals the configured edge gap.
