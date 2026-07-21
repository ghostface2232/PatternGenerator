# Perf Pattern Generator

A browser-based generator for perforation patterns (perforated metal sheets, acoustic panels, decorative screens). Configure hole shape, size, and spacing on a millimeter-accurate canvas, preview the result live with open-area statistics, and export production-ready SVG or PNG.

Built with React + Vite. Installable as an offline-capable PWA.

## Features

- **Hole shapes** — Circle, Rectangle (rounded corners), Pill, Hexagon, Diamond (point-up or flat-up), Triangle (alternating ▲▽ rows), most with corner-radius control
- **Pattern types** — Straight, Staggered 60°, Staggered 45°, Radial (concentric, Sunflower, 6k Rosette), Custom Angle
- **Seamless tilings** — Hexagon honeycomb, interlocking Diamond lattice, and the Triangle tiling treat the edge gap as a uniform ligament on every side; at 0 gap they tile the plane exactly (100% open area)
- **DIN 24041 presets** — common Rv/Rg perforation standards
- **Size variation** — multi-layer scalar fields (linear / radial / angular / spiral × ramp / peak / wave / noise / steps) modulate hole size across the panel, edited directly on the canvas with Photoshop-style gizmo handles; includes presets, randomize, undo/redo
- **Sheet & bounds** — panel size, per-side margins, rounded panel corners, hole removal by click
- **Thickness & taper** — models tapered (conical) holes: exit diameter, surface vs. effective (through-thickness) open area, closed-hole warnings
- **Live statistics** — open area ratio (OAR) gauge, hole count, exact minimum ligament, overlap detection
- **Export** — dimensioned SVG (mm units, entry/exit layers when taper is active) and high-resolution PNG

## Getting started

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # unit tests (node --test)
npm run build    # production build → docs/
```

## Deployment

`vite build` outputs to `docs/` (relative base path), which is committed and served via GitHub Pages. After changing source, run `npm run build` and commit the regenerated `docs/` alongside your changes.

The app registers a service worker (`public/sw.js`) for offline use. Bump `CACHE_NAME` in `sw.js` when changing cached app-shell files.

## Project layout

```
index.html                     entry point + service-worker registration
src/main.jsx                   React bootstrap
src/perforation-generator.jsx  the entire app: geometry, pattern generation, canvas, UI
src/radial-engine.js           pure radial-pattern geometry (unit-tested)
src/radial-engine.test.js      tests for radial layouts and spacing
src/variation-engine.js        pure size-variation field math (unit-tested)
src/variation-engine.test.js   tests for the variation engine
public/                        PWA assets (manifest, service worker, icons)
docs/                          committed production build (GitHub Pages)
```

All geometry is computed in millimeters in sheet space; the canvas applies zoom/pan transforms on top.
