// Shared vocabulary for patterns, shapes and presets. Pure data, no side effects.

// The layout modes, in the order the Type dropdown offers them. The first five
// are the original grid and radial families; Cross-hatch, Scatter, Spiral and
// Fibonacci arrived with Phase 3. Keep this list and the LAYOUTS registry in
// layouts/index.js in step — layouts.test.js asserts they match, since the
// document may hold any name from here and the registry decides what each one
// means. The names are the values a saved document carries, so they are part of
// the file format: rename one and every document naming it falls back to the
// default on load.
export const PATTERN_TYPES = [
  "Straight",
  "Staggered 60°",
  "Staggered 45°",
  "Radial",
  "Custom Angle",
  "Cross-hatch",
  "Scatter",
  "Spiral",
  "Fibonacci",
  "Path",
];
export const HOLE_SHAPES = ["Circle", "Rectangle", "Pill", "Hexagon", "Diamond", "Triangle", "Superellipse"];
export const CUSTOM_SIZE_SHAPES = ["Rectangle", "Pill", "Diamond", "Triangle", "Superellipse"];
// The one shape whose outline the `shape` field channel can morph per hole.
export const MORPH_SHAPE = "Superellipse";
export const DIAMOND_ORIENTATIONS = ["Point up", "Flat up"];
export const RADIAL_LAYOUTS = ["Concentric", "Sunflower", "6k Rosette"];
export const RADIAL_MODES = ["Full", "Circle"];
export const TAPER_DIRECTIONS = ["Top larger", "Bottom larger"];

export const DIN_PRESETS = [
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

// Patterns above this many holes switch to the reduced "performance mode" render,
// and overlap / ligament computation is skipped.
export const PERF_MODE_HOLE_LIMIT = 10000;

// Size-variation layers a document may carry.
export const MAX_VARIATION_LAYERS = 3;

// Curves the Path layout may carry, and vertices per curve. Both are what the
// canvas can sensibly show handles for at once, not a limit anything downstream
// needs: the generator walks whatever it is given.
export const MAX_PATHS = 4;
export const MAX_PATH_POINTS = 48;

// Image assets a document may embed, with a per-image and a whole-document cap
// on the base64. The decoder downsamples to IMAGE_MAP_SIZE before encoding, so
// even a full-frame noise photo — the worst case for PNG — lands around 80 K
// chars; eight of those fit inside the total with room to spare.
//
// Both numbers exist to keep a document inside the browser's localStorage quota,
// which measures around 5 MB and is shared with the recent list. An earlier
// 1 M-char per-image cap failed at exactly that job: eight of them is 8 MB, so
// validation would happily accept a document the autosave could then never
// write, and it would retry the failure on every keystroke thereafter.
export const MAX_ASSETS = 8;
export const MAX_ASSET_DATA_URL_CHARS = 300_000;
export const MAX_ASSET_TOTAL_CHARS = 1_200_000;

// Value ranges the UI can produce. Loading a file or share link clamps to these,
// so an imported document can never describe a pattern the sliders could not.
export const DOC_LIMITS = {
  "sheet.w": [10, 1000],
  "sheet.h": [10, 1000],
  "boundary.margins": [0, 50],
  "boundary.cornerRadius": [0, 500],
  "hole.diameter": [0.5, 20],
  "hole.w": [0.5, 30],
  "hole.h": [0.5, 30],
  "hole.cornerRadius": [0, 30],
  "layout.edgeGap": [0, 50],
  "layout.customAngle": [0, 90],
  "layout.radial.gap": [0, 50],
  // Cross-hatch line directions. A full half-turn each way, because it is the
  // difference between the two that shapes the lattice and either one may be
  // the larger.
  "layout.crosshatch.angle": [-90, 90],
  // Scatter is the one layout that draws random numbers, so the seed is part of
  // the document: the same seed has to place the same holes in every tab, every
  // reload and every export, or `removedHoles` addresses a list that no longer
  // exists.
  "layout.scatter.seed": [0, 99999],
  // Path vertices live in sheet millimetres and may be dragged off the sheet, so
  // like a controller's they are bounded by the largest sheet rather than by the
  // current one.
  "layout.path.coord": [-2000, 2000],
  "taper.thickness": [0, 10],
  "taper.angle": [0, 15],
  "variation.minScale": [0.01, 2],
  "variation.maxScale": [0.05, 2.5],
  "variation.quantize": [0, 12],
  "variation.cullBelow": [0, 100],
  "layer.opacity": [0, 1],
  "layer.angle": [-360, 360],
  "layer.center": [0, 1],
  "layer.radius": [0.1, 2],
  "layer.turns": [0.25, 8],
  "layer.position": [0, 1],
  "layer.phase": [0, 1],
  "layer.frequency": [0.25, 10],
  "layer.detail": [1, 6],
  "layer.steps": [2, 16],
  "layer.exponent": [0.12, 5],
  "layer.jitter": [0, 0.5],
  "layer.seed": [0, 99999],
  "hole.shapeMix": [0, 1],
  // Controllers live in sheet millimetres and may sit off the sheet, so their
  // coordinates are bounded by the largest sheet rather than by the current one.
  "controller.coord": [-2000, 2000],
  "controller.radius": [0.5, 2000],
  "controller.strength": [0, 1],
  "controller.target.size": [0.05, 4],
  "controller.target.spacing": [0.2, 4],
  "controller.target.angle": [-180, 180],
  "controller.target.shape": [0, 1],
  "controller.image.gamma": [0.1, 5],
  "controller.image.level": [0, 1],
  "controller.image.size": [1, 2000],
  "controller.image.rotation": [-180, 180],
};
