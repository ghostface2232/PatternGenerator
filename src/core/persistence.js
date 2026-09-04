// Saving and loading documents: JSON files, localStorage autosave with a recent
// list, and compressed share links in the URL hash. All functions are pure or
// take their storage as a parameter so they run under node --test.
import LZString from "lz-string";
import { DOC_SCHEMA_VERSION, createDocument } from "./document.js";

export const FILE_EXTENSION = ".perf.json";
export const FILE_MIME = "application/json";
export const STORAGE_KEY_CURRENT = "perf-pattern:current";
export const STORAGE_KEY_RECENT = "perf-pattern:recent";
export const RECENT_LIMIT = 10;
export const SHARE_PARAM = "d";

// ─── Migration ────────────────────────────────────────────────────────
// One entry per schema step: MIGRATIONS[n] upgrades version n → n+1.
const MIGRATIONS = {
  // 0 → 1: documents saved before schemaVersion existed carry no version.
  0: doc => ({ ...doc, schemaVersion: 1 }),
};

function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return patch === undefined ? base : patch;
  if (typeof base !== "object" || base === null) return patch === undefined ? base : patch;
  if (typeof patch !== "object" || patch === null) return base;
  const out = { ...base };
  for (const key of Object.keys(patch)) out[key] = deepMerge(base[key], patch[key]);
  return out;
}

// Upgrade any older document to the current schema and fill missing fields
// from the defaults so newly added settings never come back undefined.
export function migrateDocument(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Not a document");
  let doc = raw;
  let version = Number.isInteger(doc.schemaVersion) ? doc.schemaVersion : 0;
  if (version > DOC_SCHEMA_VERSION)
    throw new Error(`Document schema ${version} is newer than this app (${DOC_SCHEMA_VERSION})`);
  while (version < DOC_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from schema ${version}`);
    doc = step(doc);
    version++;
  }
  const merged = deepMerge(createDocument(), doc);
  merged.schemaVersion = DOC_SCHEMA_VERSION;
  merged.removedHoles = Array.isArray(merged.removedHoles) ? merged.removedHoles.filter(Number.isInteger) : [];
  return merged;
}

// ─── JSON ─────────────────────────────────────────────────────────────
export function serializeDocument(doc, pretty = true) {
  return JSON.stringify(doc, null, pretty ? 2 : 0);
}

export function deserializeDocument(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.sheet || !parsed.hole)
    throw new Error("File is not a Perf Pattern document");
  return migrateDocument(parsed);
}

// Safe file name from the document name ("Speaker grille v2" → "Speaker_grille_v2").
export function fileStem(doc) {
  const stem = String(doc.name || "pattern")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return stem || "pattern";
}

// ─── Share links ──────────────────────────────────────────────────────
export function encodeShareHash(doc) {
  const compact = { ...doc };
  delete compact.id; // a shared copy becomes its own document when opened
  return `#${SHARE_PARAM}=${LZString.compressToEncodedURIComponent(JSON.stringify(compact))}`;
}

export function decodeShareHash(hash) {
  if (!hash) return null;
  const match = /^#?(?:.*&)?d=([^&]+)/.exec(hash);
  if (!match) return null;
  const json = LZString.decompressFromEncodedURIComponent(match[1]);
  if (!json) throw new Error("Share link is damaged");
  return deserializeDocument(json);
}

// ─── localStorage autosave + recent list ──────────────────────────────
// `storage` is anything with getItem / setItem / removeItem (localStorage or a Map shim).
export function saveCurrent(storage, doc) {
  storage.setItem(STORAGE_KEY_CURRENT, serializeDocument(doc, false));
}

export function loadCurrent(storage) {
  const text = storage.getItem(STORAGE_KEY_CURRENT);
  if (!text) return null;
  try {
    return deserializeDocument(text);
  } catch {
    return null;
  }
}

export function loadRecent(storage) {
  try {
    const list = JSON.parse(storage.getItem(STORAGE_KEY_RECENT) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Upsert the document in the recent list (most recent first, capped).
export function touchRecent(storage, doc, now = Date.now()) {
  const entry = { id: doc.id, name: doc.name, updatedAt: now, doc };
  const rest = loadRecent(storage).filter(e => e && e.id !== doc.id);
  const list = [entry, ...rest].slice(0, RECENT_LIMIT);
  storage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
  return list;
}

export function removeRecent(storage, id) {
  const list = loadRecent(storage).filter(e => e && e.id !== id);
  storage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
  return list;
}
