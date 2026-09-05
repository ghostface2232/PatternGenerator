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
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${theme.accent}; cursor: pointer; border: 2px solid ${theme.dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: ${theme.accent}; cursor: pointer; border: 2px solid ${theme.dark ? "#18181b" : "#fff"}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        button { transition: background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s, transform 0.1s; }
        button:active { transform: scale(0.96); }
        .pg-menu-item:hover { background: ${theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"} !important; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${theme.scrollbar}; border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>
    </>
  );
}
