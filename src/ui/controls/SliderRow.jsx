import { useEffect, useRef, useState } from "react";
import { clamp } from "../../core/math.js";
import { MONO } from "../theme.js";

// Label + numeric text input + range slider. The text input holds partial
// edits locally and only commits (clamped) on Enter / blur, so typing never snaps.
export function SliderRow({ label, value, min, max, step, onChange, unit, dark }) {
  const [inputVal, setInputVal] = useState(String(value));
  const inputRef = useRef(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setInputVal(String(value));
  }, [value]);

  const commitInput = () => {
    isFocused.current = false;
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed)) { setInputVal(String(value)); return; }
    const clamped = clamp(parsed, min, max);
    onChange(clamped);
    setInputVal(String(clamped));
  };

  const trackBg = dark ? "#333" : "#d4d4d8";
  const trackFg = dark ? "#60a5fa" : "#2563eb";
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: dark ? "#ccc" : "#444", fontFamily: MONO, letterSpacing: 0.3 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            aria-label={label}
            value={inputVal}
            onFocus={() => { isFocused.current = true; inputRef.current?.select(); }}
            onBlur={commitInput}
            onKeyDown={e => { if (e.key === "Enter") { commitInput(); inputRef.current?.blur(); } }}
            onChange={e => setInputVal(e.target.value)}
            style={{
              width: 52, height: 24, fontSize: 11, textAlign: "right",
              background: dark ? "#131316" : "#fff", color: dark ? "#eee" : "#222",
              border: `1px solid ${dark ? "#333" : "#d0d0d0"}`,
              borderRadius: 4, padding: "0 4px", outline: "none",
              fontFamily: MONO
            }}
          />
          {unit && <span style={{ fontSize: 10, color: dark ? "#666" : "#999", fontFamily: MONO }}>{unit}</span>}
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%", height: 4, appearance: "none", outline: "none", borderRadius: 2, cursor: "pointer",
          background: `linear-gradient(to right, ${trackFg} 0%, ${trackFg} ${pct}%, ${trackBg} ${pct}%, ${trackBg} 100%)`
        }}
      />
    </div>
  );
}
