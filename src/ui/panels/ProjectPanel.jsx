import { useEffect, useRef, useState } from "react";
import { Check, FilePlus, FolderOpen, Link, Save } from "lucide-react";
import { useEditor } from "../EditorContext.jsx";
import { Select, smallLabelStyle } from "../controls/index.js";
import { MONO } from "../theme.js";
import { Section } from "./Section.jsx";

// Project card: document name, new / open / save / share, and the recent list.
export function ProjectPanel() {
  const { doc, api, theme, project } = useEditor();
  const { dark } = theme;
  const [name, setName] = useState(doc.name);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→local sync
    setName(doc.name);
  }, [doc.name]);

  const commitName = () => {
    const next = name.trim() || "Untitled";
    setName(next);
    if (next !== doc.name) api.set("name", next, { merge: "name" });
  };

  const btn = (extra = {}) => ({
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    background: theme.controlBg,
    color: theme.textPrimary,
    fontSize: 10,
    cursor: "pointer",
    fontFamily: MONO,
    ...extra,
  });

  const share = async () => {
    const ok = await project.shareLink();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <Section title="Project" theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
        <span style={smallLabelStyle(theme)}>Name</span>
        <input
          type="text"
          aria-label="Document name"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          style={{
            height: 30,
            fontSize: 11,
            background: theme.controlBg,
            color: theme.textPrimary,
            border: `1px solid ${theme.border}`,
            borderRadius: 5,
            padding: "0 9px",
            outline: "none",
            fontFamily: MONO,
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5, marginBottom: 10 }}>
        <button onClick={project.newDocument} title="Start a new document" style={btn()}>
          <FilePlus size={11} /> New
        </button>
        <button onClick={() => fileInput.current?.click()} title={`Open a ${project.fileExtension} file`} style={btn()}>
          <FolderOpen size={11} /> Open
        </button>
        <button onClick={project.saveFile} title={`Download as ${project.fileExtension}`} style={btn()}>
          <Save size={11} /> Save
        </button>
        <button
          onClick={share}
          title="Copy a link that reopens this exact document"
          style={btn(copied ? { borderColor: theme.accent, color: theme.accent } : {})}
        >
          {copied ? (
            <>
              <Check size={11} /> Copied
            </>
          ) : (
            <>
              <Link size={11} /> Share
            </>
          )}
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        aria-label="Open document file"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) project.openFile(file);
          e.target.value = "";
        }}
      />
      {project.recent.some(e => e.id !== doc.id) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={smallLabelStyle(theme)}>Recent (this browser)</span>
          <Select
            value=""
            placeholder="Open a recent document…"
            ariaLabel="Recent documents"
            dark={dark}
            onChange={id => project.openRecent(id)}
            options={project.recent
              .filter(e => e.id !== doc.id)
              .map(e => ({ value: e.id, label: `${e.name || "Untitled"} · ${relativeTime(e.updatedAt)}` }))}
          />
        </div>
      )}
      <div style={{ fontSize: 9, color: theme.textFaint, marginTop: 8, lineHeight: 1.4 }}>
        Autosaved in this browser. Drop a {project.fileExtension} file anywhere to open it.
      </div>
    </Section>
  );
}

function relativeTime(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
