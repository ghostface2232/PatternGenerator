import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MONO } from "../theme.js";

// Custom dropdown (replaces native <select>, styled to match the GUI). The menu
// is position: fixed so it can escape the scrolling sidebar.
export function Select({ value, options, onChange, dark, placeholder, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const btnRef = useRef(null);
  const border = dark ? "#27272a" : "#e0e0e5";
  const bg = dark ? "#131316" : "#ffffff";
  const menuBg = dark ? "#1b1b1f" : "#ffffff";
  const text = dark ? "#e4e4e7" : "#18181b";
  const accent = dark ? "#60a5fa" : "#2563eb";
  const current = options.find(o => String(o.value) === String(value));

  const openMenu = () => {
    const r = btnRef.current.getBoundingClientRect();
    const menuH = Math.min(options.length * 28 + 8, 264);
    const below = r.bottom + 4 + menuH <= window.innerHeight - 8;
    setMenuPos({ left: r.left, width: r.width, top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - menuH) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = e => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }} onPointerDown={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "0 8px 0 9px",
          fontSize: 11,
          background: bg,
          color: current ? text : "#71717a",
          border: `1px solid ${open ? accent : border}`,
          borderRadius: 5,
          cursor: "pointer",
          fontFamily: MONO,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current ? current.label : placeholder || "Select…"}
        </span>
        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            color: "#71717a",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && menuPos && (
        <div
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: 264,
            overflowY: "auto",
            zIndex: 100,
            background: menuBg,
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: 4,
            boxShadow: dark ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 32px rgba(0,0,0,0.16)",
          }}
        >
          {options.map(o => {
            const selected = String(o.value) === String(value);
            return (
              <button
                key={String(o.value)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="pg-menu-item"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 8px",
                  fontSize: 10.5,
                  textAlign: "left",
                  background: "transparent",
                  color: selected ? accent : text,
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily: MONO,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                {selected && <Check size={11} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
