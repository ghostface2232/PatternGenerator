# AGENTS.md

Guidance for AI coding agents working on this repository.

## What this is

A single-page React app that generates perforation patterns (holes in a metal sheet) and exports them as SVG/PNG. No backend, no router. State is one document object driven through a reducer; all geometry is pure, UI-free JavaScript.

## Commands

```bash
npm install
npm run dev          # Vite dev server
npm test             # node --test "src/**/*.test.js"  (plain Node, no JSX transform)
npm run test:e2e     # Playwright smoke suite against the dev server (e2e/)
npm run lint         # ESLint (flat config, react-hooks rules)
npm run format       # Prettier --write over src/ and e2e/
npm run build        # vite build → docs/
```

In the remote sandbox Chromium is pre-installed: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome npm run test:e2e`.

## Repository conventions

- **`docs/` is the deployed site** (GitHub Pages) and is committed. After any source change, run `npm run build` and include the regenerated `docs/` in the same commit. CI fails if `docs/` is stale. Never edit `docs/` by hand.
- **Tests run in plain Node** (`node --test`), so test files can only import pure `.js` modules, never `.jsx`. Everything under `core/`, `geometry/`, `layouts/`, `fields/`, `export/` and `render/` must stay importable from Node (no DOM access at module scope).
- **Prettier + ESLint are the style guide.** Run `npm run format` and `npm run lint` before committing.
- All geometry is in **millimetres, sheet space** (origin = sheet top-left, y down). Canvas zoom/pan is applied as a transform at draw time only (`render/view.js`).
- UI components receive a `theme` token object from `ui/theme.js` (or a `dark` boolean for the low-level controls). Labels are English, JetBrains Mono, terse.
- Interactive controls carry `aria-label`s and the HUD stats carry `data-testid`s; the Playwright tests address them that way. Keep them when editing.

## Architecture

```
src/
  core/        document model, constants, math, history, persistence, and the pure pipeline (document → holes → stats)
  geometry/    hole shapes (SHAPES registry), polygon helpers, boundary, ligament/overlap, OAR
  layouts/     hole placement: grid.js (grid family + uniform-ligament tilings) and radial-engine.js
  fields/      size-variation scalar fields (variation-engine.js) and the on-canvas gizmo math
  export/      svg.js, png.js, download.js
  render/      canvas-renderer.js (pure drawScene) and view.js (sheet ↔ canvas transform)
  ui/          React: App.jsx (state, pipeline memos, actions, project I/O), EditorContext, TopBar, Sidebar, canvas/, panels/, controls/, theme.js
```

### Data flow

```
doc (ui/useDocument.js reducer)
  → deriveGeometry(doc)        effective hole extents, pitches, tiling flags      core/pipeline.js
  → buildParams(doc, g)        flat params for generateHoles / exports
  → generateHoles(params)      hole centres (+ optional per-hole rotation `angle`) layouts/grid.js
  → decorateHoles(...)         size variation scale, taper exit sizes, cull flags
  → filterActive(...)          minus removed / culled holes
  → computeStats(...)          OAR (theoretical or counted), ligament, overlaps
  → drawScene / SVG / PNG
```

`computePattern(doc)` runs the whole chain in one call; `core/pipeline.test.js` pins the baseline numbers (739 holes, 35.4% OAR, 3.00 mm ligament for the default document; 100% OAR for the seamless tilings at gap 0).

### The document

`core/document.js` → `createDocument()` is the schema (`schemaVersion` 1): `sheet`, `boundary` (margins, corner radius), `hole`, `layout` (type, gaps, radial block), `presetIndex`, `variation`, `taper`, `appearance`, `removedHoles`. UI-only state (theme, zoom, edit modes) lives in `App.jsx` and is never part of the document.

Edits go through the `api` from `useDocument`: `set(path, value, opts)`, `patch({ path: value }, opts)`, `update(fn, opts)`, `replace(doc)`, plus `undo()`, `redo()`, `closeGroup()`, `canUndo`, `canRedo` and `ref.current` (latest document for pointer handlers). `setIn` shares untouched branches, and the pipeline memos in `App.jsx` key on the sub-objects, so a colour or removed-hole edit does not regenerate the pattern. Compound edits (preset apply, linked gaps, shape switch) are `actions` in `App.jsx`.

### History (undo/redo)

`core/history.js` is a pure past/present/future structure. Every recorded edit is one undo step, except that consecutive edits with the same coalescing key inside `COALESCE_MS` merge into one (a slider drag, typing, a gizmo drag). `useDocument` picks the key automatically: numeric/string `set`s use their path, all-numeric `patch`es use their joined paths, everything else stands alone. Pass `{ merge: "key" }` to control it, and call `api.closeGroup()` when a drag ends. There is deliberately no way to change the document without recording a step: such an edit could drop `removedHoles` with no undo step left to restore them. The variation panel and gizmo use the small `history` adapter in `App.jsx` (`commit` / `live` / `endDrag`), which maps onto the same API.

### Persistence (`core/persistence.js`)

- Autosave: `App.jsx` writes the document to `localStorage` 300 ms after every change and upserts it into the recent list (10 entries, keyed by `doc.id`). `loadInitialDocument()` restores it on start. `flushPending()` writes synchronously before loading another document, on `pagehide`, and on a `visibilitychange` that hides the page — but only when the document differs from the last one saved, so a tab left open does not write its stale copy over what another tab saved (both share the one `current` key). `useDocument` mirrors the document into `api.ref` from a **layout** effect so these listeners see the latest one even when they fire in the same task as the edit.
- Files: `.perf.json` via `serializeDocument` / `deserializeDocument`; opening runs `migrateDocument`, which upgrades older `schemaVersion`s through `MIGRATIONS` and then `validateDocument`. **When you change the document shape, bump `DOC_SCHEMA_VERSION`, add a migration step, and extend `validateDocument`.**
- Validation: a document can arrive from a hand-edited file or a share link, so `validateDocument` rebuilds it field by field from `createDocument()` — type check, range clamp against `DOC_LIMITS` (the UI's own slider ranges), enum membership — and drops unknown keys. It handles every shape `JSON.parse` can produce without throwing, and deliberately does **not** catch beyond that: each caller already turns a throw into something useful (an alert naming the file, or falling back to the autosaved document), and swallowing it would replace the user's document with a blank one and say nothing. A wrong type used to crash the render (`variation.layers: null` threw during the first paint and left a blank page with no way back, because the autosave had already replaced the last good copy). Clamping bounds an imported document to what the sliders can reach — it is not a performance budget: a 1000 mm panel of 0.5 mm holes at zero gap is four million holes either way, which is slow but no longer fatal. Keep new fields covered.
- Share links: `encodeShareHash(doc)` → `#d=<lz-string>`; a link beats the autosaved document on load and is stripped from the URL afterwards. The `id` is dropped so a shared copy becomes its own document.
- Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, Ctrl/Cmd+S download. Text fields keep the browser's own undo.

### Hole shapes

`geometry/shapes.js` exports `SHAPES`, a registry where each shape implements `area`, `trace` (canvas), `svg`, `contains` (hit test) and `gap` (signed clearance). Overlap is `gap < -0.001` for every shape. To add a shape, add one entry there plus its name in `core/constants.js` `HOLE_SHAPES` (and `CUSTOM_SIZE_SHAPES` if it has separate W/H). Placement rules for special lattices live in `layouts/grid.js`.

Diamond and Triangle are convex polygons sharing `geometry/polygon.js`. Rotation (radial patterns, Diamond "Flat up", point-down Triangles) is a per-hole `angle` set at generation time; downstream code only reads `hole.angle`.

### Uniform-ligament tilings

Three shape/pattern combos replace the generic grid with an exact tiling where the edge gap is a uniform ligament on every side (seamless at gap 0): Hexagon + Staggered 60° (honeycomb), Triangle + any non-radial type (alternating ▲▽ rows), Diamond + Staggered 60° (rhombus lattice). The trick is always the same: lay out the lattice of the hole *expanded outward by gap/2*, then draw the actual hole inset at the shared incenter. Theoretical OAR for these uses the tiling cell area, not pitch×pitch.

### Size variation

`fields/variation-engine.js` is pure scalar-field math (spaces × profiles × blending). `fields/gizmo.js` maps the four canvas handles to layer parameters. Edits to the variation block go through the `history` adapter (see History above) so they share the global undo stack.

## Gotchas

- Patterns above **10,000 holes** (`PERF_MODE_HOLE_LIMIT`) switch to a reduced "performance mode" render, and overlap/ligament computation is skipped.
- `holes` positions include centres slightly outside the perforation bounds (within one hole radius); edge clipping is handled visually and by `estimateVisibleHoleArea`, not by dropping holes.
- OAR has two paths: theoretical (unit cell) for clean infinite patterns, counted (visible area sampling) whenever margins, corner radius, removal, variation, or radial mode make the theoretical value wrong.
- `removedHoles` are indices into the generated list, so `useDocument`'s reducer clears them in the same history step as any edit that changes `patternSignature(doc)` — the value signature of `PLACEMENT_PARAMS`, the subset of `buildParams` that `generateHoles` reads. Keep that list in step with `generateHoles`' destructuring — that equality is what makes it sound, since `generateHoles` is pure in `params`. The sweep in `pipeline.test.js` spot-checks it across base documents × edits (including compensating pairs that hold the pitch constant while the hole size moves); it catches most entries being dropped but not all, so verify against the destructuring rather than against a green suite. The hole corner radius and the taper fields reshape a hole without moving it, so they stay out. The check is deliberately conservative in the other direction: some edits that happen to leave every centre where it was (a panel corner radius too small to clip anything, a shape swap between two shapes that share a lattice) still reset the removals. Undo brings them back. Link flags, colours and the document name leave them alone, and loading a document (`replace`/undo/redo) keeps the removals it was saved with.
- The service worker caches aggressively in production; `index.html` unregisters it in dev. Bump `CACHE_NAME` in `public/sw.js` when app-shell files change.
- Verify geometry changes with `npm test` (pipeline baseline) and `npm run test:e2e` (real browser): gap 0 on the seamless tilings must read 100.0% OAR and Min Ligament must equal the configured edge gap.
