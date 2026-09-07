// The shared shapes of the app's small controls — a chip, an icon button, a
// row button — as style factories over the theme tokens, so every panel draws
// the same chip and a change here reaches all of them. Components keep their
// own aria attributes; these are looks only.
import { DURATION_FAST, EASE, MONO } from "../theme.js";

export const transition = (props = "background, color, border-color, opacity, box-shadow, transform") =>
  `${props
    .split(",")
    .map(p => `${p.trim()} ${DURATION_FAST}ms ${EASE}`)
    .join(", ")}`;

// A selectable chip: quiet until active, when it takes the accent.
export const chipStyle = (theme, active, extra = {}) => ({
  border: `1px solid ${active ? theme.accentBorder : theme.border}`,
  borderRadius: 6,
  background: active ? theme.accentBg : "transparent",
  color: active ? theme.accent : theme.textSecondary,
  fontSize: 10,
  cursor: "pointer",
  fontFamily: MONO,
  padding: "6px 4px",
  lineHeight: 1.2,
  transition: transition(),
  ...extra,
});

// A square icon button.
export const iconButtonStyle = (theme, extra = {}) => ({
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  background: theme.controlBg,
  color: theme.textPrimary,
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
  transition: transition(),
  ...extra,
});

// A full-width action button, optionally in its "on" state.
export const actionButtonStyle = (theme, on = false, extra = {}) => ({
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: `1px solid ${on ? theme.accentBorder : theme.border}`,
  borderRadius: 6,
  background: on ? theme.accentBg : theme.controlBg,
  color: on ? theme.accent : theme.textPrimary,
  fontSize: 10,
  cursor: "pointer",
  fontFamily: MONO,
  padding: "0 10px",
  transition: transition(),
  ...extra,
});

// A quiet, low-emphasis button (remove-all, back-to, and the like).
export const ghostButtonStyle = (theme, extra = {}) => ({
  height: 26,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  background: "transparent",
  color: theme.textSecondary,
  fontSize: 10,
  cursor: "pointer",
  fontFamily: MONO,
  padding: "0 8px",
  transition: transition(),
  ...extra,
});

// The soft notice under a control: a hint, or a warning when `warn`.
export const noticeStyle = (theme, warn = false) => ({
  padding: "8px 10px",
  borderRadius: 6,
  background: warn ? theme.warnBg : theme.accentBgSoft,
  border: `1px solid ${warn ? "rgba(242,107,107,0.18)" : theme.sectionBorder}`,
  color: theme.textSecondary,
  fontSize: 10,
  lineHeight: 1.6,
  marginBottom: 12,
});

// A row label beside a toggle.
export const rowLabelStyle = theme => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  fontSize: 11,
  color: theme.textSecondary,
  marginBottom: 10,
});

// The keycap a shortcut is written in.
export const kbdStyle = theme => ({
  display: "inline-block",
  minWidth: 16,
  padding: "1px 5px",
  borderRadius: 4,
  border: `1px solid ${theme.border}`,
  background: theme.controlBg,
  color: theme.textSecondary,
  fontSize: 9,
  fontFamily: MONO,
  textAlign: "center",
  lineHeight: 1.5,
});
