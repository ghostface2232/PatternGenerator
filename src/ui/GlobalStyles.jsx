import { DURATION, DURATION_FAST, EASE } from "./theme.js";

export function GlobalStyles({ theme }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
      <style>{`
        /* JetBrains Mono arrives over the network, and it is a tall face: ascent
           1.020, descent 0.300, so a line box is 1.32 em against the 1.164 em of
           the monospace it replaces. At 11 px that is 1.7 px a line, and the
           lines above the Hole Diameter slider added up to a 10 px drop of the
           whole panel at the moment the font landed — controls moving out from
           under a cursor mid-click, on a track 4 px tall. So the fallback is the
           same local monospace as before wearing the metrics of the font it
           stands in for: the two states occupy identical space and nothing
           moves. Local faces only, no second download; if none of them resolve
           the face never loads and the stack falls through to the generic. */
        @font-face {
          font-family: "JetBrains Mono Metrics";
          src: local("DejaVu Sans Mono"), local("Menlo"), local("Consolas"), local("Liberation Mono"), local("Monaco"), local("Courier New");
          ascent-override: 102%;
          descent-override: 30%;
          line-gap-override: 0%;
        }
        * { box-sizing: border-box; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${theme.accent}; cursor: pointer; border: 2px solid ${theme.dark ? "#15151a" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform ${DURATION_FAST}ms ${EASE}; }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${theme.accent}; cursor: pointer; border: 2px solid ${theme.dark ? "#15151a" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="range"]:hover::-webkit-slider-thumb { transform: scale(1.15); }
        input[type="range"]:focus-visible { outline: none; box-shadow: ${theme.focusRing}; border-radius: 4px; }
        button { transition: background ${DURATION_FAST}ms ${EASE}, color ${DURATION_FAST}ms ${EASE}, border-color ${DURATION_FAST}ms ${EASE}, opacity ${DURATION_FAST}ms ${EASE}, transform ${DURATION_FAST}ms ${EASE}, box-shadow ${DURATION_FAST}ms ${EASE}; }
        button:active:not(:disabled) { transform: scale(0.97); }
        button:focus-visible, input:focus-visible, [role="switch"]:focus-visible { outline: none; box-shadow: ${theme.focusRing}; }
        button:disabled { cursor: default; }
        .pg-menu-item:hover { background: ${theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} !important; }
        .pg-hover:hover:not(:disabled) { background: ${theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}; color: ${theme.textPrimary}; }
        .pg-rail-btn:hover:not(:disabled) { background: ${theme.dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}; color: ${theme.textPrimary}; }
        .pg-fade-in { animation: pg-fade-in ${DURATION}ms ${EASE} both; }
        .pg-pop-in { animation: pg-pop-in ${DURATION}ms ${EASE} both; }
        .pg-collapse { display: grid; grid-template-rows: 1fr; transition: grid-template-rows ${DURATION}ms ${EASE}, opacity ${DURATION}ms ${EASE}; }
        .pg-collapse[data-closed="true"] { grid-template-rows: 0fr; opacity: 0; pointer-events: none; }
        .pg-collapse > div { min-height: 0; overflow: hidden; }
        .pg-tooltip { position: relative; }
        .pg-tooltip::after { content: attr(data-tip); position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%) translateX(-4px); white-space: nowrap; background: ${theme.dark ? "#26262d" : "#17171b"}; color: #f4f4f5; font-size: 10px; padding: 5px 8px; border-radius: 6px; pointer-events: none; opacity: 0; transition: opacity ${DURATION_FAST}ms ${EASE}, transform ${DURATION_FAST}ms ${EASE}; z-index: 20; box-shadow: 0 6px 18px rgba(0,0,0,0.3); }
        .pg-tooltip:hover::after, .pg-tooltip:focus-visible::after { opacity: 1; transform: translateY(-50%) translateX(0); transition-delay: 350ms; }
        @keyframes pg-fade-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
        @keyframes pg-pop-in { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
        ::-webkit-scrollbar { width: 5px; height: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${theme.scrollbar}; border-radius: 3px; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>
    </>
  );
}
