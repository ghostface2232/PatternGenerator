# Perf Pattern Generator

A browser-based generator for perforation patterns (perforated metal sheets, acoustic panels, decorative screens). Configure hole shape, size, and spacing on a millimeter-accurate canvas, preview the result live with open-area statistics, and export production-ready SVG or PNG.

Built with React + Vite. Installable as an offline-capable PWA.

## Features

- **Hole shapes** — Circle, Rectangle (rounded corners), Pill, Hexagon, Diamond (point-up or flat-up), Triangle (alternating ▲▽ rows), Superellipse (one slider from diamond through ellipse to square), most with corner-radius control
- **Layout modes** — Straight, Staggered 60°, Staggered 45°, Radial (concentric, Sunflower, 6k Rosette), Custom Angle, Cross-hatch (two line families at any pair of angles), Scatter (seeded Poisson-disk, reproducible from the document), Spiral (Archimedean, equal steps along the arm), Fibonacci (golden angle), Path (equal steps along curves you drag on the canvas), Voronoi (stone cracks: each hole is its own cell) and Flow Lines (slots along the streamlines of a direction field). Switching mode keeps the boundary, the hole and every controller
- **A constant ligament without a lattice** — Voronoi and Flow Lines place their holes so that exactly the edge gap of metal is left between any two neighbours, everywhere, however irregular the pattern looks. In Voronoi the hole is the cell polygon and in Flow Lines it is a slot; in both the hole-shape dropdown steps aside and the panel says so. Asking afterwards for holes larger than that spacing — with a size controller, or by squeezing the spacing one — overlaps them exactly as it would in any other mode, and the ligament readout and the overlap warning follow it down
- **Seamless tilings** — Hexagon honeycomb, interlocking Diamond lattice, and the Triangle tiling treat the edge gap as a uniform ligament on every side; at 0 gap they tile the plane exactly (100% open area)
- **DIN 24041 presets** — common Rv/Rg perforation standards
- **Field controllers** — a point, line, curve, polyline or image placed on the panel drives one channel across it: hole size, hole spacing, hole rotation, or the superellipse morph. Spacing varies the density of the layout itself — row pitch in the grid modes, both line families in Cross-hatch, the disc radius in Scatter and Voronoi, the step in Spiral, Fibonacci and Path, the line separation in Flow Lines — and under Flow Lines the rotation channel becomes the direction field the lines follow. Points, lines and curves are drawn straight onto the canvas; polylines and images are added at the centre and then shaped by their handles. Reach, falloff, strength and one-sidedness per controller, and one controller can follow another's geometry. An image drives the channel from its brightness (halftone) — drop one anywhere on the page — with invert, gamma and level range. Everything is edited on the canvas with draggable handles, over a live heat-map of the channel
- **Size variation** — multi-layer scalar fields (linear / radial / angular / spiral × ramp / peak / wave / noise / steps) modulate hole size across the panel, edited directly on the canvas with Photoshop-style gizmo handles; includes presets, randomize, undo/redo
- **Sheet & bounds** — panel size, per-side margins, rounded panel corners, hole removal by click
- **Thickness & taper** — models tapered (conical) holes: exit diameter, surface vs. effective (through-thickness) open area, closed-hole warnings
- **Live statistics** — open area ratio (OAR) gauge, hole count, exact minimum ligament, overlap detection
- **Export** — dimensioned SVG (mm units, entry/exit layers when taper is active) and high-resolution PNG
- **Projects** — autosave in the browser, `.perf.json` save / open (or drop a file onto the page), copy-to-clipboard share links, a recent-documents list, and global undo / redo (Ctrl+Z, Ctrl+Shift+Z). Controller images are saved with the file; share links and the recent list leave them out

## Getting started

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # unit tests (node --test)
npm run test:e2e   # browser smoke tests (Playwright)
npm run lint       # ESLint
npm run build      # production build → docs/
```

## Deployment

`vite build` outputs to `docs/` (relative base path), which is committed and served via GitHub Pages. After changing source, run `npm run build` and commit the regenerated `docs/` alongside your changes; CI checks that the two match.

The app registers a service worker (`public/sw.js`) for offline use. Bump `CACHE_NAME` in `sw.js` when changing cached app-shell files.

## Project layout

```
index.html                 entry point + service-worker registration
src/main.jsx               React bootstrap
src/core/                  document model, constants, seeded rng, and the pure document → holes → stats pipeline
src/geometry/              hole shapes (registry), polygon and stroke helpers, boundary, ligament, OAR, spatial hash
src/layouts/               hole placement: the mode registry, grid family, uniform-ligament tilings, radial engine,
                           cross-hatch, scatter, spiral, fibonacci, path, voronoi, flow lines
src/fields/                size-variation fields, the controller system, image sampling, and the on-canvas gizmo maths
src/export/                SVG / PNG writers and download helpers
src/render/                canvas renderer and view transform
src/ui/                    React app: App, TopBar, Sidebar, canvas/, panels/, controls/, theme
e2e/                       Playwright smoke tests
public/                    PWA assets (manifest, service worker, icons)
docs/                      committed production build (GitHub Pages)
```

All geometry is computed in millimeters in sheet space; the canvas applies zoom/pan transforms on top. See `AGENTS.md` for the architecture in more depth and `ROADMAP.md` for the improvement plan.
