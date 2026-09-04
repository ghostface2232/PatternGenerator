// The document: everything that describes a pattern and survives a reload.
// UI-only state (theme, zoom, edit modes) deliberately lives elsewhere.
// Bump DOC_SCHEMA_VERSION and add a migration in persistence when the shape changes.
import { DEFAULT_VARIATION } from "../fields/variation-engine.js";

export const DOC_SCHEMA_VERSION = 1;

export const cloneVariation = variation => ({
  ...variation,
  layers: (variation.layers || []).map(layer => ({ ...layer })),
});

export function createDocument() {
  return {
    schemaVersion: DOC_SCHEMA_VERSION,
    units: "mm",
    name: "Untitled",
    sheet: { w: 200, h: 200 },
    boundary: {
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      marginLinked: true,
      cornerRadius: 0,
    },
    hole: {
      shape: "Circle",
      diameter: 5, // Circle & Hexagon (corner-to-corner)
      w: 5,
      h: 5, // Rectangle, Pill, Diamond, Triangle (mm)
      cornerRadius: 0,
      diamondOrient: "Point up",
      triEquilateral: true, // Triangle: lock H = W·√3/2
    },
    layout: {
      type: "Staggered 60°",
      edgeGapX: 3,
      edgeGapY: 3,
      gapLinked: true,
      customAngle: 30,
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
