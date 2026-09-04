import { useEffect, useRef, useState } from "react";
import { clamp } from "../../core/math.js";
import { MONO } from "../theme.js";

// ─── Color helpers (hex <-> HSV) ─────────────────────────────────────
export function hexToHsv(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToHex(h, s, v) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    [r, g, b]
      .map(ch =>
        Math.round((ch + m) * 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

const PICKER_SWATCHES = [
  "#141418",
  "#000000",
  "#3f3f46",
  "#c8c8cd",
  "#ffffff",
  "#2563eb",
  "#ef4444",
  "#f59e0b",
  "#10b981",
];

// Color field: swatch + hex input opening a custom HSV picker popover, styled to
// match the GUI (replaces the native <input type="color">). Partial hex text is
// held locally and only committed once it is a complete #rrggbb value.
export function ColorField({ label, value, onChange, dark }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [text, setText] = useState(value);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const hsvRef = useRef(hsv);
  const dragging = useRef(false);
  const swatchRef = useRef(null);
  const border = dark ? "#27272a" : "#e0e0e5";
  const controlBg = dark ? "#131316" : "#ffffff";
  const textPrimary = dark ? "#e4e4e7" : "#18181b";
  const labelStyle = {
    fontSize: 8,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#71717a",
    fontFamily: MONO,
  };

  // Sync the local text / HSV copies when the committed colour changes from outside
  // (swatch click, undo). The HSV copy is left alone mid-drag so the pad doesn't jump.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→local sync
    setText(value);
    if (!dragging.current) {
      const next = hexToHsv(value);
      hsvRef.current = next;
      setHsv(next);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      if (!dragging.current) setOpen(false);
    };
    const onKey = e => {
      if (e.key === "Escape") setOpen(false);
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

  const commit = (h, s, v) => {
    const next = [h, s, v];
    hsvRef.current = next;
    setHsv(next);
    onChange(hsvToHex(h, s, v));
  };

  // Shared press-drag helper for the SV pad and hue bar.
  const dragWith = (e, apply) => {
    dragging.current = true;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    apply(e, el.getBoundingClientRect());
    const move = ev => apply(ev, el.getBoundingClientRect());
    const up = () => {
      dragging.current = false;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const openPicker = () => {
    const r = swatchRef.current.getBoundingClientRect();
    const w = 196,
      h = 172;
    const left = Math.min(r.left, window.innerWidth - w - 8);
    const top = r.bottom + 6 + h <= window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - h);
    setPos({ left, top });
    setOpen(true);
  };

  const [hue, sat, val] = hsv;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }} onPointerDown={e => e.stopPropagation()}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          ref={swatchRef}
          onClick={() => (open ? setOpen(false) : openPicker())}
          title="Open color picker"
          style={{
            width: 28,
            height: 30,
            padding: 0,
            border: `1px solid ${open ? (dark ? "#60a5fa" : "#2563eb") : border}`,
            borderRadius: 6,
            background: value,
            cursor: "pointer",
            boxShadow: `inset 0 0 0 1px ${dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
          }}
        />
        <input
          type="text"
          value={text}
          aria-label={label}
          onChange={e => {
            const v = e.target.value;
            if (!/^#[0-9a-fA-F]{0,6}$/.test(v)) return; // ignore non-hex keystrokes
            setText(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v); // commit only complete colors
          }}
          onBlur={() => setText(value)} // drop an incomplete edit
          style={{
            width: 68,
            height: 30,
            fontSize: 10,
            background: controlBg,
            color: textPrimary,
            border: `1px solid ${border}`,
            borderRadius: 5,
            padding: "0 6px",
            outline: "none",
            fontFamily: MONO,
            textTransform: "uppercase",
          }}
        />
      </div>
      {open && pos && (
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: 196,
            zIndex: 120,
            padding: 10,
            background: dark ? "#1b1b1f" : "#ffffff",
            border: `1px solid ${border}`,
            borderRadius: 10,
            boxShadow: dark ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 32px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            cursor: "default",
          }}
        >
          {/* Saturation / value pad */}
          <div
            onPointerDown={e =>
              dragWith(e, (ev, rect) => {
                const s = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
                const v = clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1);
                commit(hsvRef.current[0], s, v);
              })
            }
            style={{
              position: "relative",
              height: 110,
              borderRadius: 6,
              cursor: "crosshair",
              touchAction: "none",
              background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${sat * 100}%`,
                top: `${(1 - val) * 100}%`,
                width: 12,
                height: 12,
                marginLeft: -6,
                marginTop: -6,
                borderRadius: 6,
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                background: value,
                pointerEvents: "none",
              }}
            />
          </div>
          {/* Hue bar */}
          <div
            onPointerDown={e =>
              dragWith(e, (ev, rect) => {
                const h = clamp((ev.clientX - rect.left) / rect.width, 0, 1) * 359.9;
                commit(h, hsvRef.current[1], hsvRef.current[2]);
              })
            }
            style={{
              position: "relative",
              height: 10,
              borderRadius: 5,
              cursor: "ew-resize",
              touchAction: "none",
              background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: `${(hue / 360) * 100}%`,
                top: "50%",
                width: 12,
                height: 12,
                marginLeft: -6,
                marginTop: -6,
                borderRadius: 6,
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                background: `hsl(${hue}, 100%, 50%)`,
                pointerEvents: "none",
              }}
            />
          </div>
          {/* Preset swatches */}
          <div style={{ display: "flex", gap: 4 }}>
            {PICKER_SWATCHES.map(c => (
              <button
                key={c}
                onClick={() => onChange(c)}
                title={c.toUpperCase()}
                style={{
                  flex: 1,
                  height: 16,
                  padding: 0,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: c,
                  border: `1px solid ${value.toLowerCase() === c ? (dark ? "#93c5fd" : "#2563eb") : dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
