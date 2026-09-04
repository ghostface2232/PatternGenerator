export const FIELD_SPACES = ["Linear", "Radial", "Angular", "Spiral"];
export const SIZE_PROFILES = ["Ramp", "Peak", "Valley", "Wave", "Noise", "Steps"];
export const BLEND_MODES = ["Add", "Multiply", "Max", "Min", "Difference"];

export const DEFAULT_VARIATION_LAYER = {
  id: "layer-1",
  enabled: true,
  locked: false,
  opacity: 1,
  blendMode: "Multiply",
  space: "Linear",
  profile: "Peak",
  angle: -90,
  centerX: 0.5,
  centerY: 0.5,
  radius: 1,
  turns: 2.5,
  position: 0.5,
  phase: 0,
  frequency: 3,
  detail: 3,
  steps: 5,
  exponent: 1,
  jitter: 0,
  seed: 417,
  mirror: false,
  invert: false,
};

export const DEFAULT_VARIATION = {
  enabled: false,
  minScale: 0.2,
  maxScale: 1.4,
  quantize: 0,
  cullBelow: 0,
  layers: [{ ...DEFAULT_VARIATION_LAYER }],
  selectedLayerId: "layer-1",
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fract = value => value - Math.floor(value);
const lerp = (a, b, t) => a + (b - a) * t;
const fade = t => t * t * (3 - 2 * t);

function hash2(x, y, seed) {
  let h = Math.imul((x | 0) ^ (seed | 0), 374761393);
  h = Math.imul(h ^ ((y | 0) * 668265263), 1274126177);
  h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const tx = fade(fract(x)),
    ty = fade(fract(y));
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function fbm2D(x, y, seed, detail) {
  let value = 0,
    amplitude = 0.55,
    frequency = 1,
    total = 0;
  const octaves = clamp(Math.round(detail || 3), 1, 6);
  for (let octave = 0; octave < octaves; octave++) {
    value += valueNoise2D(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total > 0 ? value / total : 0;
}

function peakProfile(q, position) {
  const p = clamp(position, 0.001, 0.999);
  return q <= p ? clamp(q / p) : clamp((1 - q) / (1 - p));
}

function profileCoordinate(q, layer) {
  if (!layer.mirror) return q;
  const wrapped = fract(q);
  return wrapped <= 0.5 ? wrapped * 2 : (1 - wrapped) * 2;
}

function evaluateSpace(nx, ny, layer) {
  const angle = (layer.angle * Math.PI) / 180;
  const dx = nx - layer.centerX;
  const dy = ny - layer.centerY;
  const directionX = Math.cos(angle),
    directionY = Math.sin(angle);

  if (layer.space === "Radial") {
    const radius = Math.max(0.02, layer.radius || 1);
    return (Math.hypot(dx, dy) * 2) / radius;
  }
  if (layer.space === "Angular") {
    const angular = Math.atan2(dy, dx) / (Math.PI * 2);
    return fract(angular - layer.angle / 360 + 1);
  }
  // Reach-handle length controls the field scale for every space (radius=1 is the neutral default).
  const scale = Math.max(0.02, layer.radius || 1);

  if (layer.space === "Spiral") {
    const angular = Math.atan2(dy, dx) / (Math.PI * 2);
    const radial = (Math.hypot(dx, dy) * 2) / scale;
    return fract(angular - layer.angle / 360 + radial * (layer.turns || 2.5));
  }

  // Normalize the projection so every direction spans roughly 0..1 over the panel.
  const denominator = Math.max(0.0001, Math.abs(directionX) + Math.abs(directionY));
  return 0.5 + (dx * directionX + dy * directionY) / (denominator * scale);
}

export function evaluateVariationLayer(nx, ny, layer) {
  let q = profileCoordinate(evaluateSpace(nx, ny, layer), layer);
  const phase = layer.phase || 0;
  let value;

  if (layer.profile === "Peak") {
    value = peakProfile(clamp(q), layer.position);
  } else if (layer.profile === "Valley") {
    value = 1 - peakProfile(clamp(q), layer.position);
  } else if (layer.profile === "Wave") {
    value = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (q * Math.max(0.25, layer.frequency) + phase));
  } else if (layer.profile === "Noise") {
    const scale = Math.max(0.35, layer.frequency || 3);
    value = fbm2D((nx + phase * 2.17) * scale, (ny - phase * 1.73) * scale, Math.round(layer.seed || 0), layer.detail);
  } else if (layer.profile === "Steps") {
    const levels = Math.max(2, Math.round(layer.steps || 5));
    value = Math.round(clamp(q + phase) * (levels - 1)) / (levels - 1);
  } else {
    value = clamp(q + phase);
  }

  value = Math.pow(clamp(value), Math.max(0.12, layer.exponent || 1));
  if (layer.invert) value = 1 - value;
  return clamp(value);
}

function blendValues(base, value, layer, first) {
  const opacity = clamp(layer.opacity ?? 1);
  if (first) return lerp(1, value, opacity);
  if (layer.blendMode === "Add") return clamp(base + value * opacity);
  if (layer.blendMode === "Max") return lerp(base, Math.max(base, value), opacity);
  if (layer.blendMode === "Min") return lerp(base, Math.min(base, value), opacity);
  if (layer.blendMode === "Difference") return lerp(base, Math.abs(base - value), opacity);
  return base * lerp(1, value, opacity); // Multiply
}

export function evaluateVariationField(nx, ny, variation, pointSeed = 0) {
  if (!variation?.enabled) return 1;
  let value = 0;
  let activeCount = 0;
  for (const layer of variation.layers || []) {
    if (!layer.enabled) continue;
    let layerValue = evaluateVariationLayer(nx, ny, layer);
    if (layer.jitter > 0) {
      const random = hash2(pointSeed, Math.round(pointSeed / 997), layer.seed || 0) * 2 - 1;
      layerValue = clamp(layerValue + random * layer.jitter);
    }
    value = blendValues(value, layerValue, layer, activeCount === 0);
    activeCount++;
  }
  if (activeCount === 0) value = 1;
  const levels = Math.round(variation.quantize || 0);
  if (levels >= 2) value = Math.round(value * (levels - 1)) / (levels - 1);
  return clamp(value);
}

export function variationScaleAt(nx, ny, variation, pointSeed = 0) {
  if (!variation?.enabled) return 1;
  const value = evaluateVariationField(nx, ny, variation, pointSeed);
  return lerp(variation.minScale, variation.maxScale, value);
}

export function createVariationLayer(index = 1) {
  return {
    ...DEFAULT_VARIATION_LAYER,
    id: `layer-${Date.now()}-${index}`,
    angle: index % 2 ? -90 : 0,
    profile: index % 2 ? "Peak" : "Wave",
    blendMode: index === 1 ? "Multiply" : "Max",
    opacity: index === 1 ? 1 : 0.7,
  };
}

export function randomizeVariationLayer(layer, random = Math.random) {
  if (layer.locked) return layer;
  const spaces = FIELD_SPACES;
  const profiles = SIZE_PROFILES;
  return {
    ...layer,
    space: spaces[Math.floor(random() * spaces.length)],
    profile: profiles[Math.floor(random() * profiles.length)],
    angle: Math.round((random() * 360 - 180) / 15) * 15,
    centerX: 0.2 + random() * 0.6,
    centerY: 0.2 + random() * 0.6,
    radius: 0.45 + random() * 0.9,
    turns: 1 + random() * 4,
    position: 0.18 + random() * 0.64,
    phase: random(),
    frequency: 1 + random() * 5,
    detail: 2 + Math.floor(random() * 4),
    steps: 3 + Math.floor(random() * 7),
    exponent: 0.35 + random() * 2.7,
    jitter: random() < 0.5 ? 0 : random() * 0.16,
    seed: Math.floor(random() * 100000),
    mirror: random() > 0.68,
    invert: random() > 0.72,
  };
}

export const VARIATION_PRESETS = {
  "Center Bloom": {
    minScale: 0.08,
    maxScale: 1.48,
    layer: {
      space: "Radial",
      profile: "Ramp",
      radius: 1.05,
      phase: 0,
      exponent: 1.7,
      centerX: 0.5,
      centerY: 0.5,
      invert: true,
    },
  },
  "Linear Fade": {
    minScale: 0.1,
    maxScale: 1.45,
    layer: { space: "Linear", profile: "Ramp", angle: 0, phase: 0, exponent: 1.15, invert: false },
  },
  "Diagonal Wave": {
    minScale: 0.08,
    maxScale: 1.42,
    layer: { space: "Linear", profile: "Wave", angle: -35, frequency: 3.2, phase: 0.08, exponent: 1.35 },
  },
  "Concentric Pulse": {
    minScale: 0.12,
    maxScale: 1.45,
    layer: { space: "Radial", profile: "Wave", radius: 1.15, frequency: 4.2, phase: 0, exponent: 1.4 },
  },
  "Angular Fan": {
    minScale: 0.16,
    maxScale: 1.45,
    layer: { space: "Angular", profile: "Wave", angle: -90, frequency: 6, phase: 0.1, exponent: 1.75 },
  },
  "Organic Field": {
    minScale: 0.18,
    maxScale: 1.45,
    layer: {
      space: "Linear",
      profile: "Noise",
      angle: 20,
      frequency: 3.6,
      detail: 4,
      phase: 0.2,
      exponent: 1.45,
      seed: 8241,
    },
  },
  "Spiral Echo": {
    minScale: 0.12,
    maxScale: 1.45,
    layer: { space: "Spiral", profile: "Wave", angle: -30, turns: 2.8, frequency: 3.5, phase: 0.05, exponent: 1.25 },
  },
};
