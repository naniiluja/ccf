// CCF memory-audit — pure decisions behind scripts/memory-audit.mjs and /ccf:updatespec step 5b.
// Project memory lives outside git, so a wrong deletion there cannot be recovered. That is why the
// consolidation pass is GATED by deterministic thresholds (it runs only when memory has actually grown)
// and why the optional Jev column is advisory: these functions only measure and label, they never decide
// what to delete. No I/O here; the script reads the directory and calls the network.

import { DEFAULT_CAP_BYTES, noulValue, withinSizeCap } from "./completion-evidence.mjs";

/** Memory types Claude Code writes; anything else (or no frontmatter) is `untyped`. */
const KNOWN_TYPES = ["feedback", "user", "project", "reference"];

/** Gate defaults: more than 20 feedback files, or the index at 150+ lines or 20KB+. */
export const DEFAULT_THRESHOLDS = Object.freeze({ maxFeedback: 20, indexLines: 150, indexKb: 20 });

/** Jev labels in tie-break order: on equal scores the least destructive action wins. */
const LABELS = /** @type {const} */ (["keep", "merge", "drop"]);

const QUESTION_TEXT = {
  keep: "Should this memory be kept as is: still true, specific to this project or user, and not duplicated by another memory listed in state?",
  merge: "Should this memory be merged into another memory listed in state, because the two cover the same fact or one extends the other?",
  drop: "Should this memory be dropped as stale, duplicate or wrong, judged against the other memories and the index in state?",
};

/**
 * Read the fields CCF cares about from a memory file's YAML frontmatter. A missing, unclosed or
 * unrecognised frontmatter yields `type: "untyped"`, never `feedback`, so a stray file cannot open the gate.
 * Accepts `type`/`modified` at top level or nested under `metadata:`.
 * @param {string} text
 * @returns {{ name: string, description: string, type: string, modified: string | null }}
 */
export function parseMemoryFrontmatter(text) {
  const empty = { name: "", description: "", type: "untyped", modified: null };
  if (typeof text !== "string") return empty;
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return empty;
  const close = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (close < 0) return empty;
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of lines.slice(1, close)) {
    const m = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (value !== "" && !(m[1] in fields)) fields[m[1]] = value;
  }
  const type = KNOWN_TYPES.includes(fields.type) ? fields.type : "untyped";
  return { name: fields.name ?? "", description: fields.description ?? "", type, modified: fields.modified ?? null };
}

/**
 * Local `.md` link targets in the index (`[Title](file.md)`), basename only; external URLs are ignored.
 * @param {string} indexText
 * @returns {string[]}
 */
function indexLinks(indexText) {
  /** @type {string[]} */
  const out = [];
  for (const m of indexText.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || !href.toLowerCase().endsWith(".md")) continue;
    out.push(href.replace(/^\.\//, ""));
  }
  return out;
}

/**
 * Measure a memory directory's content.
 * @param {{ indexText?: string, files?: { name: string, text: string }[] }} input
 * @returns {{
 *   counts: Record<string, number>,
 *   index: { lines: number, bytes: number },
 *   danglingIndex: string[],
 *   unindexed: string[],
 *   files: { file: string, type: string, modified: string | null }[],
 * }}
 */
export function auditMemory(input) {
  const indexText = typeof input?.indexText === "string" ? input.indexText : "";
  const files = Array.isArray(input?.files) ? input.files : [];
  /** @type {Record<string, number>} */
  const counts = { feedback: 0, user: 0, project: 0, reference: 0, untyped: 0 };
  const entries = files.map((f) => {
    const fm = parseMemoryFrontmatter(f.text);
    counts[fm.type] += 1;
    return { file: String(f.name), type: fm.type, modified: fm.modified };
  });
  const lines = indexText === "" ? 0 : indexText.replace(/\r?\n$/, "").split(/\r?\n/).length;
  const links = new Set(indexLinks(indexText));
  const names = new Set(entries.map((e) => e.file));
  return {
    counts,
    index: { lines, bytes: Buffer.byteLength(indexText, "utf8") },
    danglingIndex: [...links].filter((l) => !names.has(l)),
    unindexed: entries.map((e) => e.file).filter((n) => !links.has(n)),
    files: entries,
  };
}

/**
 * The consolidation gate. Feedback opens strictly above `maxFeedback`; the index opens AT its limits.
 * @param {{ feedbackCount?: number, indexLines?: number, indexBytes?: number }} m
 * @param {{ maxFeedback?: number, indexLines?: number, indexKb?: number }} [thresholds]
 * @returns {{ gate: boolean, reasons: string[] }}
 */
export function shouldConsolidate(m, thresholds = DEFAULT_THRESHOLDS) {
  /** @param {any} v @param {number} d */
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const t = thresholds ?? DEFAULT_THRESHOLDS;
  const maxFeedback = num(t.maxFeedback, DEFAULT_THRESHOLDS.maxFeedback);
  const indexLines = num(t.indexLines, DEFAULT_THRESHOLDS.indexLines);
  const indexKb = num(t.indexKb, DEFAULT_THRESHOLDS.indexKb);
  /** @type {string[]} */
  const reasons = [];
  if (num(m?.feedbackCount, 0) > maxFeedback) reasons.push("feedback-count");
  if (num(m?.indexLines, 0) >= indexLines) reasons.push("index-lines");
  if (num(m?.indexBytes, 0) >= indexKb * 1024) reasons.push("index-bytes");
  return { gate: reasons.length > 0, reasons };
}

/**
 * Build the single Jev request: every memory's full text plus the index as `state`, three Nouls per file.
 * An oversize state is refused, never truncated, because Jev would then judge memories it cannot see.
 * @param {{ name: string, text: string }[]} files
 * @param {string} indexText
 * @param {number} [capBytes]
 * @returns {{ ok: true, state: { index: string, memories: { file: string, text: string }[] }, questions: Record<string, { type: "noul", instructions: string }> }
 *   | { ok: false, reason: "nothing-to-ask" | "too-large" }}
 */
export function buildJevMemoryRequest(files, indexText, capBytes = DEFAULT_CAP_BYTES) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) return { ok: false, reason: "nothing-to-ask" };
  const state = {
    index: typeof indexText === "string" ? indexText : "",
    memories: list.map((f) => ({ file: String(f.name), text: String(f.text ?? "") })),
  };
  if (!withinSizeCap(JSON.stringify(state), capBytes)) return { ok: false, reason: "too-large" };
  /** @type {Record<string, { type: "noul", instructions: string }>} */
  const questions = {};
  for (const m of state.memories) {
    for (const label of LABELS) {
      questions[`${m.file}::${label}`] = { type: "noul", instructions: `Memory file "${m.file}". ${QUESTION_TEXT[label]}` };
    }
  }
  return { ok: true, state, questions };
}

/**
 * Turn Jev's answers into one `{ label, score }` per file: the highest of its three scores, ties going to
 * the least destructive label. A file missing any valid answer gets no entry rather than a guess.
 * @param {Record<string, any>} answers
 * @param {{ name: string }[]} files
 * @returns {Record<string, { label: string, score: number }>}
 */
export function labelFromAnswers(answers, files) {
  const a = answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
  /** @type {Record<string, { label: string, score: number }>} */
  const out = {};
  for (const f of Array.isArray(files) ? files : []) {
    const scores = LABELS.map((label) => noulValue(a[`${f.name}::${label}`]));
    if (scores.some((s) => s === null)) continue;
    let best = 0;
    scores.forEach((s, i) => { if (/** @type {number} */ (s) > /** @type {number} */ (scores[best])) best = i; });
    out[f.name] = { label: LABELS[best], score: /** @type {number} */ (scores[best]) };
  }
  return out;
}
