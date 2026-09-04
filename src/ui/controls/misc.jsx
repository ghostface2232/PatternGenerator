import { Link2, Link2Off, MoveHorizontal } from "lucide-react";
import { MONO } from "../theme.js";

// Tiny inline icons and read-only info rows shared by the sidebar panels.

export function ProfileIcon({ type, active, dark }) {
  const stroke = active ? (dark ? "#93c5fd" : "#1d4ed8") : dark ? "#777" : "#777";
  const paths = {
    Ramp: "M2 15 L22 3",
    Peak: "M2 16 L12 3 L22 16",
    Valley: "M2 3 L12 16 L22 3",
    Wave: "M2 10 C5 2 9 2 12 10 C15 18 19 18 22 10",
    Noise: "M2 13 L5 6 L8 11 L11 4 L14 15 L17 8 L20 12 L22 5",
    Steps: "M2 16 L7 16 L7 12 L12 12 L12 8 L17 8 L17 4 L22 4",
  };
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
      <path d="M2 18 H22" stroke={dark ? "#333" : "#ddd"} strokeWidth="1" />
      <path
        d={paths[type]}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Secondary info under an edge-gap slider (derived pitch / spacing).
export function PitchInfo({ label, value, dark }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 9,
        color: dark ? "#555" : "#aaa",
        marginTop: -6,
        marginBottom: 8,
        paddingLeft: 2,
        fontFamily: MONO,
      }}
    >
      <MoveHorizontal size={9} style={{ flexShrink: 0 }} /> {label}: {value.toFixed(2)} mm
    </div>
  );
}

export function LinkIcon({ linked, dark }) {
  const c = linked ? (dark ? "#60a5fa" : "#2563eb") : dark ? "#555" : "#aaa";
  return linked ? (
    <Link2 size={13} color={c} style={{ display: "block" }} />
  ) : (
    <Link2Off size={13} color={c} style={{ display: "block" }} />
  );
}

// Small icon-only toggle button used for gap / margin linking.
export function LinkButton({ linked, onClick, title, dark }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 2,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        opacity: 0.8,
      }}
      title={title}
    >
      <LinkIcon linked={linked} dark={dark} />
    </button>
  );
}
