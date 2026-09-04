import { Check, ChevronDown, Lock, Plus, Redo2, Sparkles, SquarePen, Undo2, X } from "lucide-react";
import { BLEND_MODES, FIELD_SPACES, SIZE_PROFILES, VARIATION_PRESETS } from "../../fields/variation-engine.js";
import { gizmoUsesPosition } from "../../fields/gizmo.js";
import { useEditor } from "../EditorContext.jsx";
import { ProfileIcon, Select, SliderRow, Toggle } from "../controls/index.js";
import { MONO } from "../theme.js";
import { Section } from "./Section.jsx";

export function VariationPanel() {
  const { doc, theme, ui, geometry: g, stats, history, selectedVariationLayer: layer, actions } = useEditor();
  const { dark } = theme;
  const { variation } = doc;
  const { variationEditMode, variationAdvanced, setVariationAdvanced } = ui;
  const iconBtn = (extra = {}) => ({
    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    border: `1px solid ${theme.border}`, borderRadius: 4, background: theme.controlBg, color: theme.textPrimary, cursor: "pointer", ...extra,
  });
  const chip = (active, extra = {}) => ({
    border: `1px solid ${active ? theme.accent : theme.border}`, borderRadius: 4,
    background: active ? theme.accentBg : "transparent", color: active ? theme.accent : theme.textSecondary,
    fontSize: 9, cursor: "pointer", fontFamily: MONO, ...extra,
  });
  const groupLabel = { fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8, color: theme.textSecondary, marginBottom: 6 };

  return (
    <Section title="Size Variation" theme={theme}
      right={<Toggle value={variation.enabled} onChange={actions.setVariationEnabled} dark={dark} label="Size Variation" />}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 5, marginBottom: 8 }}>
        <Select value="" placeholder="Load a field preset…" onChange={actions.applyVariationPreset} dark={dark} ariaLabel="Field preset"
          options={Object.keys(VARIATION_PRESETS).map(name => ({ value: name, label: name }))} />
        <button onClick={history.undo} disabled={!history.canUndo} title="Undo variation" style={iconBtn({ width: 30, height: undefined, color: history.canUndo ? theme.textPrimary : theme.textSecondary, cursor: history.canUndo ? "pointer" : "default", opacity: history.canUndo ? 1 : 0.45 })}><Undo2 size={13} /></button>
        <button onClick={history.redo} disabled={!history.canRedo} title="Redo variation" style={iconBtn({ width: 30, height: undefined, color: history.canRedo ? theme.textPrimary : theme.textSecondary, cursor: history.canRedo ? "pointer" : "default", opacity: history.canRedo ? 1 : 0.45 })}><Redo2 size={13} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        <button onClick={actions.randomizeVariation} style={{ height: 31, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: `1px solid ${theme.border}`, borderRadius: 4, background: theme.controlBg, color: theme.textPrimary, fontSize: 10, cursor: "pointer", fontFamily: MONO }}><Sparkles size={11} /> Randomize</button>
        <button onClick={actions.toggleVariationEditMode} style={{ height: 31, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, border: `1px solid ${variationEditMode ? theme.accent : theme.border}`, borderRadius: 4, background: variationEditMode ? theme.accentBg : theme.controlBg, color: variationEditMode ? theme.accent : theme.textPrimary, fontSize: 10, cursor: "pointer", fontFamily: MONO }}>
          {variationEditMode ? <><Check size={11} /> Editing Canvas</> : <><SquarePen size={11} /> Edit on Canvas</>}
        </button>
      </div>

      {variation.enabled && layer && <>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          {variation.layers.map((l, index) => (
            <button key={l.id} onClick={() => history.live(current => ({ ...current, selectedLayerId: l.id }))}
              style={chip(variation.selectedLayerId === l.id, { flex: 1, height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, opacity: l.enabled ? 1 : 0.45 })}>
              {l.locked && <Lock size={8} style={{ flexShrink: 0 }} />} Layer {index + 1}
            </button>
          ))}
          <button onClick={actions.addVariationLayer} disabled={variation.layers.length >= 3} title="Add layer" style={iconBtn({ cursor: variation.layers.length >= 3 ? "default" : "pointer", opacity: variation.layers.length >= 3 ? 0.4 : 1 })}><Plus size={13} /></button>
          {variation.layers.length > 1 && <button onClick={actions.removeSelectedVariationLayer} title="Remove selected layer" style={iconBtn({ color: theme.warn })}><X size={13} /></button>}
        </div>

        <div style={groupLabel}>Field Space</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 13 }}>
          {FIELD_SPACES.map(space => <button key={space} onClick={() => actions.updateSelectedLayer({ space }, true)} style={chip(layer.space === space, { padding: "6px 2px" })}>{space}</button>)}
        </div>

        <div style={groupLabel}>Size Profile</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 13 }}>
          {SIZE_PROFILES.map(profile => {
            const active = layer.profile === profile;
            return <button key={profile} onClick={() => actions.updateSelectedLayer({ profile }, true)} style={chip(active, { height: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 5 })}><ProfileIcon type={profile} active={active} dark={dark} />{profile}</button>;
          })}
        </div>

        {/* Geometry, position and curve live on the canvas handles. Only count-style knobs stay here. */}
        {layer.space === "Spiral" && <SliderRow label="Spiral Turns" value={layer.turns} min={0.25} max={8} step={0.05} onChange={turns => actions.updateSelectedLayer({ turns })} dark={dark} />}
        {["Wave", "Noise"].includes(layer.profile) && <SliderRow label={layer.profile === "Wave" ? "Frequency" : "Noise Scale"} value={layer.frequency} min={0.25} max={10} step={0.05} onChange={frequency => actions.updateSelectedLayer({ frequency })} dark={dark} />}
        {layer.profile === "Noise" && <SliderRow label="Noise Detail" value={layer.detail} min={1} max={6} step={1} onChange={detail => actions.updateSelectedLayer({ detail })} dark={dark} />}
        {layer.profile === "Steps" && <SliderRow label="Step Count" value={layer.steps} min={2} max={16} step={1} onChange={steps => actions.updateSelectedLayer({ steps })} dark={dark} />}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {/* Whole-percent steps: round on both display and commit so slider drags never surface float artifacts */}
          <SliderRow label="Min Scale" value={Math.round(variation.minScale * 100)} min={1} max={200} step={1} onChange={value => history.live(current => ({ ...current, minScale: Math.min(Math.round(value) / 100, current.maxScale) }))} unit="%" dark={dark} />
          <SliderRow label="Max Scale" value={Math.round(variation.maxScale * 100)} min={5} max={250} step={1} onChange={value => history.live(current => ({ ...current, maxScale: Math.max(Math.round(value) / 100, current.minScale) }))} unit="%" dark={dark} />
        </div>
        <div style={{ marginTop: -5, marginBottom: 10, padding: "6px 8px", borderRadius: 4, background: theme.accentBgSoft, fontSize: 9, color: theme.textSecondary, display: "flex", justifyContent: "space-between" }}>
          <span>Actual extent</span><span style={{ color: theme.accent }}>{(Math.min(g.effW, g.effH) * variation.minScale).toFixed(2)}–{(Math.max(g.effW, g.effH) * variation.maxScale).toFixed(2)} mm</span>
        </div>

        <SliderRow label="Remove Below ⌀" value={variation.cullBelow} min={0} max={Math.max(1, +Math.max(g.effW, g.effH).toFixed(1))} step={0.05} onChange={value => history.live(current => ({ ...current, cullBelow: value }))} unit={variation.cullBelow > 0 ? "mm" : "off"} dark={dark} />
        {stats.culledHoleCount > 0 && <div style={{ marginTop: -5, marginBottom: 10, fontSize: 9, color: theme.textSecondary, display: "flex", justifyContent: "space-between" }}>
          <span>Holes removed by size floor</span><span style={{ color: theme.warn }}>{stats.culledHoleCount.toLocaleString()}</span>
        </div>}

        <button onClick={() => setVariationAdvanced(v => !v)} style={{ width: "100%", height: 28, display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", borderTop: `1px solid ${theme.sectionBorder}`, background: "transparent", color: theme.textSecondary, fontSize: 9, cursor: "pointer", fontFamily: MONO }}><span>ADVANCED MODIFIERS</span><ChevronDown size={12} style={{ transform: variationAdvanced ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /></button>
        {variationAdvanced && <div style={{ paddingTop: 9 }}>
          <div style={{ fontSize: 9, color: theme.textSecondary, marginBottom: 11, lineHeight: 1.5 }}>Direction, origin, reach, position &amp; curve live on the canvas handles. These are the extra modifiers.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[["Mirror", "mirror"], ["Invert", "invert"], ["Layer Enabled", "enabled"], ["Lock Randomize", "locked"]].map(([label, key]) => (
              <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: theme.textSecondary }}>
                {label}<Toggle value={layer[key]} onChange={next => actions.updateSelectedLayer({ [key]: next }, true)} dark={dark} label={label} />
              </label>
            ))}
          </div>
          <SliderRow label="Jitter" value={layer.jitter} min={0} max={0.5} step={0.01} onChange={jitter => actions.updateSelectedLayer({ jitter })} dark={dark} />
          <SliderRow label="Quantize Sizes" value={variation.quantize} min={0} max={12} step={1} onChange={quantize => history.live(current => ({ ...current, quantize }))} unit={variation.quantize >= 2 ? "levels" : "off"} dark={dark} />
          <SliderRow label="Layer Opacity" value={layer.opacity * 100} min={0} max={100} step={1} onChange={opacity => actions.updateSelectedLayer({ opacity: opacity / 100 })} unit="%" dark={dark} />
          {variation.layers.length > 1 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 5 }}>Blend Mode</div><Select value={layer.blendMode} onChange={mode => actions.updateSelectedLayer({ blendMode: mode }, true)} dark={dark} ariaLabel="Blend Mode" options={BLEND_MODES.map(mode => ({ value: mode, label: mode }))} /></div>}
          {layer.profile === "Noise" && <SliderRow label="Noise Seed" value={layer.seed} min={0} max={99999} step={1} onChange={seed => actions.updateSelectedLayer({ seed })} dark={dark} />}
        </div>}
        {variationEditMode && <div style={{ padding: "7px 9px", borderRadius: 5, border: `1px solid ${dark ? "rgba(96,165,250,0.18)" : "rgba(37,99,235,0.14)"}`, background: theme.accentBgSoft, color: theme.textSecondary, fontSize: 9, lineHeight: 1.6 }}>
          <div><span style={{ color: theme.accent }}>●</span> center — drag to move the origin (gradient start).</div>
          <div><span style={{ color: theme.accent }}>◯</span> reach — drag the end point to aim direction &amp; spread.</div>
          <div><span style={{ color: theme.accent }}>◆</span> stop — slide along the line to set {gizmoUsesPosition(layer) ? "position" : "phase"}.</div>
          <div><span style={{ color: theme.dial }}>⟳</span> curve — turn the dial to shape the falloff.</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>Center snaps to the panel centre, edges &amp; corners; spread &amp; position to 0/25/50/75/100%; angles to 45°. Hold Shift to lock to a snap; otherwise it gently pulls in near one.</div>
          <div style={{ opacity: 0.8, marginTop: 2 }}>Drag empty space (or hold Space) to pan.</div>
        </div>}
      </>}
    </Section>
  );
}
