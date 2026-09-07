import { ChevronRight } from "lucide-react";
import { useEditor } from "../EditorContext.jsx";
import { MONO } from "../theme.js";
import { transition } from "../controls/index.js";

// An inspector card. The heading folds the body away (a chevron, as in every
// design tool's property panel) when `onToggle` is given; `right` is a control
// that stays in the heading either way — a section's on/off switch is reachable
// while it is folded. Radius 10 + shell padding 8 keeps cards concentric with
// the 16 px shell.
//
// The body stays in the DOM while folded, sized to zero rows: its controls keep
// their state and a test that scrolls one into view finds it. Folding is a UI
// preference and never part of the document.
export function Section({ id, title, right, children, theme, last = false, collapsed = false }) {
  const { ui, actions } = useEditor();
  const open = !id || !ui.closedSections?.[id];
  const folded = collapsed || !open;
  const clickable = !!id && !collapsed;
  const onToggle = () => actions.toggleSection(id);
  return (
    <div
      id={id ? `section-${id}` : undefined}
      style={{
        padding: "12px 14px",
        marginBottom: last ? 0 : 6,
        background: theme.cardBg,
        border: `1px solid ${theme.sectionBorder}`,
        borderRadius: 10,
        transition: transition("background"),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: folded ? 0 : right ? 10 : 12,
          transition: transition("margin"),
        }}
      >
        <button
          type="button"
          onClick={clickable ? onToggle : undefined}
          aria-expanded={clickable ? !folded : undefined}
          aria-label={clickable ? `${folded ? "Expand" : "Collapse"} ${title}` : undefined}
          tabIndex={clickable ? 0 : -1}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            padding: 0,
            margin: 0,
            border: "none",
            background: "transparent",
            cursor: clickable ? "pointer" : "default",
            color: theme.textSecondary,
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 1.1,
            fontFamily: MONO,
            textAlign: "left",
          }}
        >
          {clickable && (
            <ChevronRight
              size={12}
              style={{
                flexShrink: 0,
                transform: folded ? "none" : "rotate(90deg)",
                transition: transition("transform"),
                opacity: 0.8,
              }}
            />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </button>
        {right}
      </div>
      {!collapsed && (
        <div className="pg-collapse" data-closed={folded ? "true" : "false"} aria-hidden={folded || undefined}>
          <div>{children}</div>
        </div>
      )}
    </div>
  );
}

export const hintStyle = theme => ({ fontSize: 10, color: theme.textSecondary, marginBottom: 12, lineHeight: 1.55 });
export const noteStyle = theme => ({ fontSize: 10, color: theme.textSecondary, marginBottom: 8, padding: "2px 0" });
export const subLabelStyle = theme => ({ fontSize: 10, color: theme.textSecondary, flex: 1 });
// The heading over a group of controls inside a section — the fields panel has
// used this shape since Phase 2; it lives here so the Path block matches it.
export const groupLabelStyle = theme => ({
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.9,
  color: theme.textMuted,
  marginBottom: 6,
  fontFamily: MONO,
});
