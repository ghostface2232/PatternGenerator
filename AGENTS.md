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
- Interactive controls carry `aria-label`s and the HUD stats carry `data-testid`s; the Playwright tests address them that way. Keep them when editing. **An accessible name has to be unique in the document** — the tool rail and the fields panel both offer "add a polyline controller", so one says *Add* and the other *Place …at the centre*; the e2e suite deliberately uses no `.first()`, so a future duplicate fails there instead of silently addressing whichever button came first. A chip whose only "on" cue is its colour carries `aria-pressed`.
- **In the e2e suite, never press at a coordinate measured before an earlier step.** JetBrains Mono is fetched from Google Fonts at run time, so the whole sidebar reflows whenever it lands — the Hole Diameter track drops 10 px, against roughly 6 px of vertical slack in the control (the 12 px thumb overhanging a 4 px track). A box captured before one interaction and reused for the next points at empty panel afterwards, and the gesture is lost with no error: exactly how `two quick slider gestures remain separate undo steps` failed in CI while passing everywhere the font is unreachable. Click and hover through the locator (`locator.click({ position })`), which re-measures, waits for the box to hold still and verifies the point hits the control. Fractions of a box's *width* stay valid across the reflow — the sidebar is a fixed 440 px and nothing moves horizontally — but no y does.
- The three canvas modes — field editing, variation editing, hole removal — are **mutually exclusive**, and each entry point clears the other two. Two at once means a click does something the on-canvas badge does not describe: field editing plus hole removal turned every click that missed a controller into a deleted hole.

## Architecture

```
src/
  core/        document model, constants, math, history, persistence, and the pure pipeline (document → holes → stats)
  geometry/    hole shapes (SHAPES registry), superellipse, polygon helpers, boundary, ligament/overlap, OAR
  layouts/     hole placement: grid.js (grid family + uniform-ligament tilings) and radial-engine.js
  fields/      size-variation scalar fields (variation-engine.js) + its gizmo, and the controller system
               (controllers.js, image-map.js, controller-gizmo.js)
  export/      svg.js, png.js, download.js
  render/      canvas-renderer.js (pure drawScene) and view.js (sheet ↔ canvas transform)
  ui/          React: App.jsx (state, pipeline memos, actions, project I/O), EditorContext, TopBar, Sidebar,
               canvas/, panels/, controls/, theme.js, useImageMaps.js (the DOM half of image controllers)
```

### Data flow

```
doc (ui/useDocument.js reducer)
  → deriveGeometry(doc)        effective hole extents, pitches, tiling flags      core/pipeline.js
  → buildParams(doc, g)        flat params for generateHoles / exports
  → generateHoles(params)      hole centres (+ optional per-hole rotation `angle`) layouts/grid.js
  → compileDocumentField(...)  the document's controllers, flattened for sampling  fields/controllers.js
  → decorateHoles(...)         variation scale × the size channel, the angle and shape channels,
                               taper exit sizes, cull flags
  → filterActive(...)          minus removed / culled holes
  → computeStats(...)          OAR (theoretical or counted), ligament, overlaps
  → drawScene / SVG / PNG
```

`computePattern(doc)` runs the whole chain in one call; `core/pipeline.test.js` pins the baseline numbers (739 holes, 35.4% OAR, 3.00 mm ligament for the default document; 100% OAR for the seamless tilings at gap 0).

### The document

`core/document.js` → `createDocument()` is the schema (`schemaVersion` 2): `sheet`, `boundary` (margins, corner radius), `hole` (shape, sizes, corner radius, `shapeMix`), `layout` (type, gaps, radial block), `presetIndex`, `variation`, `fields` (the controller block), `assets` (image data for the image controllers), `taper`, `appearance`, `removedHoles`. UI-only state (theme, zoom, edit modes, the armed field tool, **which controller is selected**) lives in `App.jsx` and is never part of the document — selection in particular, because it changes on every click and each change would be an undo step that evicts a real edit from the hundred-step history.

Edits go through the `api` from `useDocument`: `set(path, value, opts)`, `patch({ path: value }, opts)`, `update(fn, opts)`, `replace(doc)`, plus `undo()`, `redo()`, `closeGroup()`, `canUndo`, `canRedo` and `ref.current` (latest document for pointer handlers). `setIn` shares untouched branches, and the pipeline memos in `App.jsx` key on the sub-objects, so a colour or removed-hole edit does not regenerate the pattern. Compound edits (preset apply, linked gaps, shape switch) are `actions` in `App.jsx`.

### History (undo/redo)

`core/history.js` is a pure past/present/future structure. Every recorded edit is one undo step, except that consecutive edits with the same coalescing key inside `COALESCE_MS` merge into one (a slider drag, typing, a gizmo drag). `useDocument` picks the key automatically: numeric/string `set`s use their path, all-numeric `patch`es use their joined paths, everything else stands alone. Pass `{ merge: "key" }` to control it, and call `api.closeGroup()` when a drag ends. There is deliberately no way to change the document without recording a step: such an edit could drop `removedHoles` with no undo step left to restore them. The variation panel and gizmo use the small `history` adapter in `App.jsx` (`commit` / `live` / `endDrag`), which maps onto the same API.

### Persistence (`core/persistence.js`)

- Autosave: `App.jsx` writes the document to `localStorage` 300 ms after every change and upserts it into the recent list (10 entries, keyed by `doc.id`). `loadInitialDocument()` restores it on start. `flushPending()` writes synchronously before loading another document, on `pagehide`, and on a `visibilitychange` that hides the page — but only when the document differs from the last one saved, so a tab left open does not write its stale copy over what another tab saved (both share the one `current` key). `useDocument` mirrors the document into `api.ref` from a **layout** effect so these listeners see the latest one even when they fire in the same task as the edit.
- Files: `.perf.json` via `serializeDocument` / `deserializeDocument`; opening runs `migrateDocument`, which upgrades older `schemaVersion`s through `MIGRATIONS` and then `validateDocument`. **When you change the document shape, bump `DOC_SCHEMA_VERSION`, add a migration step, and extend `validateDocument`.**
- Validation: a document can arrive from a hand-edited file or a share link, so `validateDocument` rebuilds it field by field from `createDocument()` — type check, range clamp against `DOC_LIMITS` (the UI's own slider ranges), enum membership — and drops unknown keys. It handles every shape `JSON.parse` can produce without throwing, and deliberately does **not** catch beyond that: each caller already turns a throw into something useful (an alert naming the file, or falling back to the autosaved document), and swallowing it would replace the user's document with a blank one and say nothing. A wrong type used to crash the render (`variation.layers: null` threw during the first paint and left a blank page with no way back, because the autosave had already replaced the last good copy). Clamping bounds an imported document to what the sliders can reach — it is not a performance budget: a 1000 mm panel of 0.5 mm holes at zero gap is four million holes either way, which is slow but no longer fatal. Keep new fields covered.
- Share links: `encodeShareHash(doc)` → `#d=<lz-string>`; a link beats the autosaved document on load and is stripped from the URL afterwards. The `id` is dropped so a shared copy becomes its own document.
- Images: `MAX_ASSETS × MAX_ASSET_DATA_URL_CHARS` has to stay inside the localStorage quota (~5 MB, shared with the recent list), or validation accepts documents the autosave can never write and then retries the failure on every keystroke. `MAX_ASSET_TOTAL_CHARS` bounds the document as a whole; the decoder's own worst case is ~80 K chars per image. `assets` is the one part of a document that does not travel. `stripAssets` takes it out of share links (a URL cannot carry a bitmap) and out of `touchRecent` (ten documents share one localStorage key, and a few hundred kilobytes of base64 each would blow the quota and take the whole recent list with it). The `current` autosave keeps them, so a reload is unaffected. An image controller whose picture is missing compiles away and reads as absent, never as black. `pruneAssets` drops an image the moment no controller points at it; `validateAssets` does the same on load, and rejects anything that is not a `data:image/(png|jpeg|webp);base64,` URL under `MAX_ASSET_DATA_URL_CHARS`.
- Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, Ctrl/Cmd+S download. Text fields keep the browser's own undo.

### Hole shapes

`geometry/shapes.js` exports `SHAPES`, a registry where each shape implements `area`, `trace` (canvas), `svg`, `contains` (hit test) and `gap` (signed clearance). Overlap is `gap < -0.001` for every shape. To add a shape, add one entry there plus its name in `core/constants.js` `HOLE_SHAPES` (and `CUSTOM_SIZE_SHAPES` if it has separate W/H). Placement rules for special lattices live in `layouts/grid.js`.

Diamond and Triangle are convex polygons sharing `geometry/polygon.js`. Rotation (radial patterns, Diamond "Flat up", point-down Triangles) is a per-hole `angle` set at generation time; downstream code only reads `hole.angle`.

**Superellipse** (`geometry/superellipse.js`) is the morph shape: |x/a|ⁿ + |y/b|ⁿ = 1, with n = 1 a diamond, n = 2 an ellipse and n → ∞ a rectangle. It is the only shape whose outline varies per hole, because the `shape` field channel drives its exponent — which is why every registry operation takes a trailing `n` argument that the other six ignore, and why `gap` reads `superN` off the hole objects. Area is closed form (a Γ-function identity, not a polygon estimate, since OAR reads it) and the hit test is the implicit equation. Only `trace` and `svg` build a polygon, at `SUPER_SEGMENTS` vertices; that inscribed polygon is what an export writes, 0.16% under the exact area, which is below what the OAR readout resolves. `hole.cornerRadius` is meaningless here and is ignored.

The clearance needs care. **`superReach` is the radial function and `superSupport` is the support function, and only the second one is safe for gaps.** For a convex body ρ(θ) ≤ h(θ), equal only where the outward normal points along θ — so a gap built on the reach reads *wider* than the metal is. That is not a corner case: on the default 60° lattice with the shape slider at the square end, where the nearest neighbour sits on a diagonal, it over-reported the ligament by 0.14 mm, 13% of the real bridge, and it also let genuinely overlapping crossed slots read as 2 mm apart. `superellipseGap` instead maximises `u·d − h₁(u) − h₂(−u)` over direction, which every direction lower-bounds — so stopping the search early costs precision, never soundness. Verified against brute force: never over-reports, within 0.03 mm on the lattice cases. The hexagon's `hexEdgeReach` has the same theoretical gap but is exact for its own neighbours, whose contact normals do point along the centre line.

### Field controllers (`fields/controllers.js`)

A controller is geometry the user drops on the sheet — `point`, `line`, `curve` (cubic Bézier), `polyline` or `image` — driving ONE channel: `size` (a multiplier on top of the variation field), `angle` (degrees added to the hole's own rotation), `shape` (the superellipse mix) or `spacing`. **`spacing` is modelled, validated, stored and evaluated but nothing reads it**: it decides where holes go, which is the layouts' business, and Phase 3 is where they start reading it. `EDITABLE_CHANNELS` is what the UI offers.

Evaluation: distance to the geometry → `w = falloff(d / radius) · strength` → blend each controller's `target` against the channel's base. The blend is a convex combination that keeps the base's share until the weights saturate (`W ≤ 1` → `base·(1−W) + Σwᵢtᵢ`; `W > 1` → `Σwᵢtᵢ / W`), which is continuous at `W = 1`, exact at full weight, and independent of the order controllers are listed in. `compileControllers` does the per-document work once (flattening curves, resolving `syncWith` with a cycle guard, dropping controllers that cannot contribute); `evaluateCompiled` is the per-hole call. Non-finite numbers are filtered at compile time as well as by `validateDocument` — NaN survives `clamp` and would empty the whole pattern.

`activeFieldChannels(doc, field)` says which channels are actually doing something here: the shape has to be able to show it (no angle over Circles, no morph over anything but Superellipse) **and** at least one controller's target has to differ from the channel's neutral value. It gates both the per-hole work and the switch to counted OAR. The gate matters because the two OAR paths disagree slightly on identical geometry, so a 1.0× size controller flipping the path would move the headline figure without moving a hole. It does not catch a controller whose reach falls entirely off the sheet, or a 60° rotation of a hexagon — both would need geometry the function does not have, and both fail conservatively (the counted figure is the honest one, just more expensive).

The one-sided mask is a **weight, not a sign**. Gating on the bare side of the nearest segment tears where two legs of a polyline are equidistant, and breaks the tie by list order: on a 40 mm leg meeting a diagonal that put a 27° step in the angle field 12 mm away from any geometry, and made the mask depend on the direction the polyline was drawn in. `polylineWeight` instead gates each segment's own contribution by `sin` of the angle between it and the offset, and takes the maximum — continuous everywhere except across the geometry itself, which is where a one-sided controller is meant to step. With `oneSided === 0` it is exactly `falloff(nearest distance)`.

An image controller's brightness is its **weight**, not a target interpolated toward the base. Both forms agree for a controller on its own; only the first composes, because a dark pixel has to mean "no influence" the way a distant point does — otherwise a black image quietly holds down every other controller over the same ground.

Controllers never move a hole, so they stay out of `PLACEMENT_PARAMS` and removed-hole indices survive adding, editing and enabling one. The spacing channel is the thing that will change that.

Handles, hit testing and drag maths are in `fields/controller-gizmo.js` (pure, in sheet mm, like the variation gizmo). Image sampling is in `fields/image-map.js` (pure); decoding a file and turning it back into a brightness map needs the DOM and lives in `ui/useImageMaps.js`.

### Uniform-ligament tilings

Three shape/pattern combos replace the generic grid with an exact tiling where the edge gap is a uniform ligament on every side (seamless at gap 0): Hexagon + Staggered 60° (honeycomb), Triangle + any non-radial type (alternating ▲▽ rows), Diamond + Staggered 60° (rhombus lattice). The trick is always the same: lay out the lattice of the hole *expanded outward by gap/2*, then draw the actual hole inset at the shared incenter. Theoretical OAR for these uses the tiling cell area, not pitch×pitch.

### Size variation

`fields/variation-engine.js` is pure scalar-field math (spaces × profiles × blending). `fields/gizmo.js` maps the four canvas handles to layer parameters. Edits to the variation block go through the `history` adapter (see History above) so they share the global undo stack.

## Gotchas

- Patterns above **10,000 holes** (`PERF_MODE_HOLE_LIMIT`) switch to a reduced "performance mode" render, and overlap/ligament computation is skipped.
- `holes` positions include centres slightly outside the perforation bounds (within one hole radius); edge clipping is handled visually and by `estimateVisibleHoleArea`, not by dropping holes.
- OAR has two paths: theoretical (unit cell) for clean infinite patterns, counted (visible area sampling) whenever margins, corner radius, removal, variation, a live field channel, or radial mode make the theoretical value wrong. The two disagree slightly on the same geometry (35.4 vs 35.6 for the default document), so a change that only flips the path still moves the readout — which is why `activeFieldChannels` gates it rather than the raw controller count.
- Controller evaluation is O(holes × controllers) on the main thread, capped at `MAX_CONTROLLERS` (8). A document with no controllers pays one `.some()` over an empty array. Moving the loop to a worker is Phase 6's job, together with generation and statistics.
- The **Superellipse clearance is the most expensive shape** in the registry, because it is the only one whose gap has no closed form: `computePattern` on the default document costs 7 ms for Circles, 9 ms for the superellipse at the ellipse end (a circle, and short-circuited as one) and 18 ms at the square end. At 8.5 k holes that is 19 / 81 / 305 ms. The search skips its refinement for pairs further apart than one hole width, which is most of them; the constant is `GAP_DIRECTIONS × GAP_REFINEMENTS` in `superellipse.js`.
- Everything a canvas drag writes is clamped to the same `DOC_LIMITS` range `validateDocument` uses. Without that the editor cannot read back its own output: a drag at a zoomed-out view wrote a 2505 mm rectangle that came back 2000 mm after a reload, with no undo step pointing at the original. `fields/gizmo.js` has always done this; `fields/controller-gizmo.js` does it too.
- `removedHoles` are indices into the generated list, so `useDocument`'s reducer clears them in the same history step as any edit that changes `patternSignature(doc)` — the value signature of `PLACEMENT_PARAMS`, the subset of `buildParams` that `generateHoles` reads. Keep that list in step with `generateHoles`' destructuring — that equality is what makes it sound, since `generateHoles` is pure in `params`. The sweep in `pipeline.test.js` spot-checks it across base documents × edits (including compensating pairs that hold the pitch constant while the hole size moves); it catches most entries being dropped but not all, so verify against the destructuring rather than against a green suite. The hole corner radius and the taper fields reshape a hole without moving it, so they stay out. The check is deliberately conservative in the other direction: some edits that happen to leave every centre where it was (a panel corner radius too small to clip anything, a shape swap between two shapes that share a lattice) still reset the removals. Undo brings them back. Link flags, colours and the document name leave them alone, and loading a document (`replace`/undo/redo) keeps the removals it was saved with.
- The service worker caches aggressively in production; `index.html` unregisters it in dev. Bump `CACHE_NAME` in `public/sw.js` when app-shell files change.
- Verify geometry changes with `npm test` (pipeline baseline) and `npm run test:e2e` (real browser): gap 0 on the seamless tilings must read 100.0% OAR and Min Ligament must equal the configured edge gap.
