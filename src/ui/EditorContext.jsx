import { createContext, useContext } from "react";

// Everything the panels and canvas need: the document + edit API, derived
// geometry/holes/stats, UI state and the theme. Assembled in App.jsx.
export const EditorContext = createContext(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside <EditorContext.Provider>");
  return ctx;
}
