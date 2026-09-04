import { Select } from "./Select.jsx";
import { MONO } from "../theme.js";

export const smallLabelStyle = theme => ({
  fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: theme.textSecondary, fontFamily: MONO,
});

// Labelled Select. `options` may be plain strings or { value, label } objects.
export function Dropdown({ label, value, onChange, options, theme }) {
  const opts = options.map(o => (typeof o === "object" ? o : { value: o, label: o }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
      <span style={smallLabelStyle(theme)}>{label}</span>
      <Select value={value} onChange={onChange} options={opts} dark={theme.dark} ariaLabel={label} />
    </div>
  );
}
