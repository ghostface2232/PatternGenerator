// Colour and typography tokens for the two themes. Components take a `theme`
// object (from useTheme / getTheme) rather than branching on `dark` themselves.

// The fallback in the middle is the local monospace wearing JetBrains Mono's
// vertical metrics (see the @font-face in GlobalStyles). Without it the sidebar
// jumps 10 px the moment the web font lands — under the user's cursor, on a
// 4 px slider track. The bare generic stays last for a browser too old for
// metric overrides, which then simply behaves as it did before.
export const MONO = "'JetBrains Mono', 'JetBrains Mono Metrics', monospace";

// One colour per field channel, shared by the canvas, the rail and the panels
// so a size controller is the same blue wherever it is mentioned.
export const CHANNEL_COLORS = {
  size: { dark: "#60a5fa", light: "#2563eb" },
  spacing: { dark: "#34d399", light: "#059669" },
  angle: { dark: "#fbbf24", light: "#d97706" },
  shape: { dark: "#f472b6", light: "#db2777" },
};

// The canvas modes' own colours, worn by the mode badge, the rail's active
// mark and the handles drawn in that mode — one hue per mode, so the badge and
// what it describes match.
export const MODE_COLORS = {
  select: { dark: "#a1a1aa", light: "#52525b" },
  fields: { dark: "#818cf8", light: "#4f46e5" },
  variation: { dark: "#60a5fa", light: "#2563eb" },
  path: { dark: "#fb923c", light: "#c2410c" },
  boundary: { dark: "#2dd4bf", light: "#0f766e" },
  remove: { dark: "#c084fc", light: "#7c3aed" },
};

// Motion: one easing and two durations, so every transition in the app moves
// the same way. `prefers-reduced-motion` zeroes them in GlobalStyles.
export const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
export const DURATION_FAST = 120;
export const DURATION = 200;

const DARK = {
  dark: true,
  appBg: "#0a0a0c",
  canvasBg: "#101013",
  panelBg: "#15151a",
  cardBg: "#1a1a20",
  cardHover: "#1f1f26",
  controlBg: "#111115",
  menuBg: "#1c1c22",
  btnBg: "#26262d",
  btnHover: "#30303a",
  railBg: "#15151a",
  border: "#27272f",
  sectionBorder: "#222229",
  inputBorder: "#33333c",
  textPrimary: "#e6e6ea",
  textSecondary: "#8b8b96",
  textMuted: "#5c5c66",
  textFaint: "#46464f",
  label: "#c9c9d0",
  accent: "#7c9cff",
  accentSoft: "#a5b8ff",
  accentBg: "rgba(124,156,255,0.14)",
  accentBgSoft: "rgba(124,156,255,0.06)",
  accentBorder: "rgba(124,156,255,0.45)",
  warn: "#f26b6b",
  warnBg: "rgba(242,107,107,0.12)",
  ok: "#4ade80",
  dial: "#fbbf24",
  track: "#2c2c34",
  scrollbar: "#33333c",
  floatShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.35), 0 18px 40px rgba(0,0,0,0.35)",
  menuShadow: "0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
  hudBg: "rgba(16,16,20,0.78)",
  hudBorder: "rgba(255,255,255,0.07)",
  focusRing: "0 0 0 2px rgba(124,156,255,0.45)",
};

const LIGHT = {
  dark: false,
  appBg: "#dcdce2",
  canvasBg: "#e9e9ee",
  panelBg: "#f7f7f9",
  cardBg: "#ffffff",
  cardHover: "#f3f3f6",
  controlBg: "#ffffff",
  menuBg: "#ffffff",
  btnBg: "#ececf0",
  btnHover: "#dedee4",
  railBg: "#f7f7f9",
  border: "#dcdce3",
  sectionBorder: "#e6e6ec",
  inputBorder: "#cfcfd7",
  textPrimary: "#17171b",
  textSecondary: "#6b6b76",
  textMuted: "#a0a0aa",
  textFaint: "#bcbcc4",
  label: "#3f3f46",
  accent: "#3b63e6",
  accentSoft: "#2b4fc7",
  accentBg: "rgba(59,99,230,0.10)",
  accentBgSoft: "rgba(59,99,230,0.05)",
  accentBorder: "rgba(59,99,230,0.4)",
  warn: "#dc4b4b",
  warnBg: "rgba(220,75,75,0.08)",
  ok: "#15803d",
  dial: "#d97706",
  track: "#d4d4dc",
  scrollbar: "#c8c8d0",
  floatShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.05), 0 14px 30px rgba(0,0,0,0.08)",
  menuShadow: "0 16px 40px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)",
  hudBg: "rgba(255,255,255,0.82)",
  hudBorder: "rgba(0,0,0,0.08)",
  focusRing: "0 0 0 2px rgba(59,99,230,0.35)",
};

export const getTheme = dark => (dark ? DARK : LIGHT);
export const channelColor = (theme, channel) => (CHANNEL_COLORS[channel] || CHANNEL_COLORS.size)[theme.dark ? "dark" : "light"]; // prettier-ignore
export const modeColor = (theme, mode) => (MODE_COLORS[mode] || MODE_COLORS.select)[theme.dark ? "dark" : "light"];
