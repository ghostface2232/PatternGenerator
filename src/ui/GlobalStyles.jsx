export function GlobalStyles({ theme }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
      <style>{`
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
