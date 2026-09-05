export function Toggle({ value, onChange, dark, label, disabled = false }) {
  const accent = dark ? "#60a5fa" : "#2563eb";
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-disabled={disabled || undefined}
      aria-label={label}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        padding: 2,
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        background: value ? accent : dark ? "#333" : "#ccc",
        transition: "background 0.2s",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: "#fff",
          transform: value ? "translateX(16px)" : "translateX(0)",
          transition: "transform 0.2s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}
