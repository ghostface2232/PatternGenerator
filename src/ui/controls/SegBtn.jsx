import { MONO } from "../theme.js";

// Segmented-control button (one of a row).
export function SegBtn({ label, active, onClick, theme }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "6px 8px",
        fontSize: 10,
        borderRadius: 4,
        border: `1px solid ${active ? theme.accent : theme.border}`,
        background: active ? theme.accentBg : "transparent",
        color: active ? theme.accent : theme.textSecondary,
        cursor: "pointer",
        fontFamily: MONO,
      }}
    >
      {label}
    </button>
  );
}

export function SegRow({ label, options, value, onChange, theme, render }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 6 }}>{label}</div>}
      <div style={{ display: "flex", gap: 5 }}>
        {options.map(o => (
          <SegBtn
            key={o}
            label={render ? render(o) : o}
            active={value === o}
            onClick={() => onChange(o)}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
