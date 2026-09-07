// The document: everything that describes a pattern and survives a reload.
// UI-only state (theme, zoom, edit modes) deliberately lives elsewhere.
// Bump DOC_SCHEMA_VERSION and add a migration in persistence when the shape changes.
import { DEFAULT_VARIATION } from "../fields/variation-engine.js";

export const DOC_SCHEMA_VERSION = 7;

export const cloneVariation = variation => ({
  ...variation,
  layers: (variation.layers || []).map(layer => ({ ...layer })),
});

// Stable per-document id (used by the recent list). Falls back for old runtimes.
export function newDocumentId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDocument() {
  return {
    schemaVersion: DOC_SCHEMA_VERSION,
    id: newDocumentId(),
    units: "mm",
    name: "Untitled",
    sheet: { w: 200, h: 200 },
    // The perforation boundary: which part of the sheet receives holes. The
    // sheet is the material; the boundary is the region inside it, and `trim`
    // says the sheet is cut to the boundary's outline as well.
    boundary: {
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      marginLinked: true,
      cornerRadius: 0,
      // "Rectangle" | "Ellipse" | "Polygon" (BOUNDARY_SHAPES). The first two
      // fill the margin-inset rectangle; a Polygon is its own outline and the
      // margins do not apply to it.
      shape: "Rectangle",
      // The polygon boundary's rings, in sheet millimetres: [[[x, y], …], …],
      // read by the even-odd rule so an imported logo keeps its counters. Empty
      // until one is drawn or imported, and then the Polygon shape behaves as
      // the Rectangle would.
      rings: [],
      // Keep-out regions, subtracted from whichever outline is above:
      // { id, shape, x, y, w, h, rotation, cornerRadius, points }, with x, y the
      // centre, w and h the size (a Circle reads w as its diameter), and
      // `points` the absolute ring of a Polygon cutout.
      cutouts: [],
      trim: false,
    },
    hole: {
      shape: "Circle",
      diameter: 5, // Circle & Hexagon (corner-to-corner)
      w: 5,
      h: 5, // Rectangle, Pill, Diamond, Triangle (mm)
      cornerRadius: 0,
      diamondOrient: "Point up",
      triEquilateral: true, // Triangle: lock H = W·√3/2
      shapeMix: 0.5, // Superellipse only: 0 diamond · 0.5 ellipse · 1 near-square
      // The preset shapes' parameter (0…1, read across each preset's own
      // range) and count (a star's points, a row's slots).
      ratio: 0.5,
      count: 5,
      // The Custom shape: an outline in unit space (its bounding box the unit
      // square), read from an SVG file (`kind: "svg"`) or built in the shape
      // editor (`kind: "layers"`, with the editable stack in `layers` and the
      // composed result in `rings`). `aspect` is the outline's own height over
      // width, and `lockAspect` keeps H at W × aspect.
      custom: { kind: "none", name: "", rings: [], aspect: 1, lockAspect: true, layers: [] },
    },
    layout: {
      type: "Staggered 60°",
      edgeGapX: 3,
      edgeGapY: 3,
      gapLinked: true,
      customAngle: 30,
      // Cross-hatch: the directions the two line families run in, in degrees.
      // 45 and −45 cross at a right angle, so the default is the Straight grid
      // turned onto its diagonal rather than a mode that looks broken until it
      // is adjusted.
      crosshatch: { angleA: 45, angleB: -45 },
      // Scatter: the seed the Poisson-disk sampler draws from. In the document
      // because the pattern has to be reproducible from the document alone.
      // Voronoi draws its cell sites from the same one.
      scatter: { seed: 1 },
      // Path: the curves holes are strung along. Empty means "no curve drawn
      // yet", and the layout falls back to a default S across the perforation
      // area so the mode shows something the moment it is picked; the panel's
      // Add Path seeds an editable copy of that same curve.
      path: { paths: [], smooth: true, alignToTangent: true },
      // Flow Lines: the direction the streamlines head in where no angle
      // controller says otherwise. 0° runs them left to right, so the mode shows
      // a pattern the moment it is picked rather than waiting for a field.
      flow: { angle: 0 },
      radial: {
        edgeGap: 5,
        circumGap: 5,
        linked: true,
        mode: "Full", // "Full" | "Circle"
        layout: "Concentric", // "Concentric" | "Sunflower" | "6k Rosette"
        centerHole: false,
      },
    },
    presetIndex: 0,
    variation: cloneVariation(DEFAULT_VARIATION),
    // Field controllers (Phase 2). One flat list; each entry names the channel
    // it drives. See fields/controllers.js for the shape of an entry. Which
    // controller is SELECTED is not here: selection is a view of the document,
    // not part of it, and putting it here would spend one undo step per click.
    fields: { enabled: false, controllers: [] },
    // Image data for the image controllers, keyed by assetId. Kept in the
    // document so a file save and a reload restore the picture; deliberately
    // stripped from share links and from the recent list (see persistence.js).
    assets: {},
    taper: { enabled: false, thickness: 0, angle: 0, direction: "Top larger" },
    appearance: { holeColor: "#141418", bgColor: "#c8c8cd" },
    removedHoles: [], // indices into the generated hole list
  };
}

// ─── Immutable path helpers ───────────────────────────────────────────
export function getIn(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setIn(obj, path, value) {
  const keys = path.split(".");
  const walk = (node, i) => {
    if (i === keys.length) return value;
    const key = keys[i];
    const next = walk(node == null ? undefined : node[key], i + 1);
    if (node != null && node[key] === next) return node;
    return { ...(node || {}), [key]: next };
  };
  return walk(obj, 0);
}

// Apply several `path: value` pairs at once.
export function patchIn(obj, patch) {
  return Object.entries(patch).reduce((acc, [path, value]) => setIn(acc, path, value), obj);
}
