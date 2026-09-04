import { MONO } from "../theme.js";

// A sidebar card. Radius 8 + shell padding 8 keeps cards concentric with the 16px shell.
export function Section({ title, right, children, theme, last = false, collapsed = false }) {
  return (
    <div
      style={{
        padding: 14,
        marginBottom: last ? 0 : 8,
        background: theme.cardBg,
        border: `1px solid ${theme.sectionBorder}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          color: theme.textSecondary,
          marginBottom: collapsed ? 0 : right ? 10 : 14,
          fontFamily: MONO,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        {right}
      </div>
      {!collapsed && children}
    </div>
  );
}

export const hintStyle = theme => ({ fontSize: 9, color: theme.textSecondary, marginBottom: 14, lineHeight: 1.5 });
export const noteStyle = theme => ({ fontSize: 10, color: theme.textSecondary, marginBottom: 8, padding: "2px 0" });
export const subLabelStyle = theme => ({ fontSize: 10, color: theme.textSecondary, flex: 1 });
