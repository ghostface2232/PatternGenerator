import { getTheme } from "../theme.js";
import { transition } from "./styles.js";

// The two sizes: the default for a section heading or a labelled row, and a
// smaller one for a list row, where it sits beside 28 px chips and an icon
// button and a full-size switch reads as the loudest thing in the row.
const SIZES = {
  default: { width: 34, height: 18, knob: 14 },
  small: { width: 26, height: 14, knob: 10 },
};

// An on/off switch. It wears the theme's accent rather than a colour of its
// own, so it sits with the chips and buttons around it instead of shouting
// over them, and the off state is the theme's track with a hairline inside it,
// which keeps it visible on the card without asking for attention. Keyboard:
// Space or Enter flips it, as a native switch does.
export function Toggle({ value, onChange, dark, label, disabled = false, size = "default" }) {
  const theme = getTheme(dark);
  const { width, height, knob } = SIZES[size] || SIZES.default;
  const pad = (height - knob) / 2;
  const flip = () => !disabled && onChange(!value);
  return (
    <div
      onClick={flip}
      onKeyDown={e => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          flip();
        }
      }}
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={value}
      aria-disabled={disabled || undefined}
      aria-label={label}
      style={{
        boxSizing: "border-box",
        width,
        height,
        borderRadius: height / 2,
        padding: pad,
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        background: value ? theme.accent : theme.track,
        boxShadow: value ? "none" : `inset 0 0 0 1px ${theme.inputBorder}`,
        opacity: disabled ? 0.5 : 1,
        transition: transition("background, box-shadow, opacity"),
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          background: value ? "#ffffff" : dark ? "#9a9aa6" : "#ffffff",
          transform: value ? `translateX(${width - knob - 2 * pad}px)` : "translateX(0)",
          transition: transition("transform, background"),
          boxShadow: dark ? "0 1px 2px rgba(0,0,0,0.35)" : "0 1px 2px rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );
}
