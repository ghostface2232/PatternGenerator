// Shared vocabulary for patterns, shapes and presets. Pure data, no side effects.

export const PATTERN_TYPES = ["Straight", "Staggered 60°", "Staggered 45°", "Radial", "Custom Angle"];
export const HOLE_SHAPES = ["Circle", "Rectangle", "Pill", "Hexagon", "Diamond", "Triangle"];
export const CUSTOM_SIZE_SHAPES = ["Rectangle", "Pill", "Diamond", "Triangle"];
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
};
