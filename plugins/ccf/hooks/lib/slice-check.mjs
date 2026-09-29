// CCF slice-check helpers — pure logic behind scripts/jev-slice-check.mjs.
// After the plan skill writes its task table, build a dependency graph over the open tasks with waves.
// Division of labor: CODE decides every pair it can (two tasks whose declared files clash after brace and
// glob expansion, a task with no file list, two tasks on the same hotspot class such as a lockfile or the
// shared spec); those pairs are never asked. Jev only judges what needs reading (does B need A's result,
// do both change one contract or one piece of shared state, is this task too small to stand alone).
// FAIL-CLOSED: Jev may only ADD an edge. A pair whose answers are missing, malformed or lost with a failed
// batch is an `unanswered` edge, because a wrong "independent" can let two tasks run in parallel while a
// wrong "dependent" only costs parallelism (task 064, section 2c).
// Everything is pure and defensive so it is unit-testable and never throws.

import { DEFAULT_THRESHOLD, noulValue } from "./completion-evidence.mjs";

/** Questions per request. Measured live (task 057): 400 questions in one request succeeded, so 100 is a conservative quarter of that. */
export const DEFAULT_BATCH_SIZE = 100;

/**
 * P(yes) at or above which a Jev pair answer becomes an edge. Lower than the 0.5 fragment threshold on
 * purpose: missing a real dependency costs a broken merge, flagging a false one costs only parallelism.
 * Not backtested yet (task 064 step 2), so treat the value as a conservative default, not a measurement.
 */
export const EDGE_THRESHOLD = 0.3;

/** The pair questions, in the order they are asked; `kind` is the edge a yes produces. */
const PAIR_QUESTIONS = /** @type {const} */ ([
  ["dep", "dependency", (/** @type {number} */ i, /** @type {number} */ j) => `Does \`tasks[${j}]\` need a result, decision or file produced by \`tasks[${i}]\` in order to be implemented and verified?`],
  ["contract", "contract", (/** @type {number} */ i, /** @type {number} */ j) => `Do \`tasks[${i}]\` and \`tasks[${j}]\` both change the same function signature, data format or behavioural contract?`],
  ["shared_state", "shared-state", (/** @type {number} */ i, /** @type {number} */ j) => `Do \`tasks[${i}]\` and \`tasks[${j}]\` both change the same config, schema, migration, dependency, generated file or shared export?`],
]);

/**
 * Hotspot classes: files that many tasks touch as a side effect, so two tasks on one class conflict even
 * when their paths differ (two edits to two lockfiles, two migrations, two rules files). Matched on the
 * normalized path; detection is code, never Jev.
 * @type {[string, RegExp][]}
 */
const HOTSPOTS = [
  ["dependency-manifest", /(^|\/)(package(-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.(toml|lock)|go\.(mod|sum)|requirements[^/]*\.txt|pyproject\.toml|poetry\.lock|Pipfile(\.lock)?|Gemfile(\.lock)?|composer\.(json|lock)|[^/]+\.csproj|packages\.lock\.json)$/i],
  ["migration-schema", /(^|\/)(migrations?|migrate)\/|(^|\/)schema\.[\w]+$|\.prisma$/i],
  ["generated", /(^|\/)(__snapshots__|generated|gen)\/|\.snap$|\.gen\.[\w]+$|\.generated\.[\w]+$/i],
  ["barrel-export", /(^|\/)index\.[cm]?[jt]sx?$|(^|\/)__init__\.py$|(^|\/)mod\.rs$/i],
  ["shared-config", /(^|\/)(tsconfig[^/]*\.json|hooks\.json|\.eslintrc[^/]*|eslint\.config\.[\w]+|\.prettierrc[^/]*|(vite|webpack|rollup|jest|vitest|babel)\.config\.[\w]+|docker-compose[^/]*\.ya?ml|Dockerfile|\.env\.example|settings[^/]*\.json|\.mcp\.json|plugin\.json|marketplace\.json)$|(^|\/)\.github\/workflows\//i],
  ["shared-spec", /(^|\/)(CLAUDE\.md|PLAN\.md|ARCHIVE\.md|README[^/]*|CHANGELOG[^/]*)$|(^|\/)\.claude\/rules\//i],
];

/**
 * @typedef {{ id: string, title: string, files: string[], criteria: string[] }} SliceTask
 */

/**
 * @param {any} p
 * @returns {string}
 */
function normPath(p) {
  return String(p).replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Expand shell-style brace groups, nested ones included: `a/{b,c}.md` → `a/b.md`, `a/c.md`.
 * @param {any} token
 * @returns {string[] | null} null when a brace is unbalanced or a group is empty (unparseable)
 */
export function expandBraces(token) {
  const text = String(token ?? "");
  let depth = 0;
  for (const ch of text) {
    if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) return null;
  }
  if (depth !== 0) return null;
  const open = text.indexOf("{");
  if (open < 0) return [text];
  let close = -1;
  /** @type {number[]} */
  const commas = [];
  depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === "{") depth++;
    else if (text[k] === "}" && --depth === 0) { close = k; break; }
    else if (text[k] === "," && depth === 1) commas.push(k);
  }
  const inner = text.slice(open + 1, close);
  if (inner === "") return null;
  const parts = [];
  let from = open + 1;
  for (const c of [...commas, close]) { parts.push(text.slice(from, c)); from = c + 1; }
  /** @type {string[]} */
  const out = [];
  for (const part of parts) {
    const expanded = expandBraces(text.slice(0, open) + part + text.slice(close + 1));
    if (expanded === null) return null;
    out.push(...expanded);
  }
  return out;
}

/**
 * Split on whitespace, `,` and `;` outside braces; inside a brace group whitespace becomes `,` so
 * `{check updatespec}` reads like `{check,updatespec}`. An unclosed brace keeps the rest of the line
 * in one token, which then fails to expand and clashes with everything.
 * @param {string} line
 * @returns {string[]}
 */
function splitTokens(line) {
  /** @type {string[]} */
  const out = [];
  let cur = "";
  let depth = 0;
  let openAt = -1;
  let start = -1;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (!cur && start < 0) start = k;
    if (ch === "{") {
      if (depth++ === 0) openAt = k;
      cur += ch;
    } else if (ch === "}" && depth > 0) {
      depth--;
      cur = cur.replace(/,$/, "") + ch;
    } else if (depth === 0 && /[\s,;]/.test(ch)) {
      if (cur) out.push(cur);
      cur = "";
      start = -1;
    } else if (depth > 0 && /[\s,]/.test(ch)) {
      if (!cur.endsWith(",") && !cur.endsWith("{")) cur += ",";
    } else cur += ch;
  }
  if (depth > 0) {
    // Unclosed brace: keep the token up to the first whitespace after the brace as the unparseable
    // marker, and re-read the rest of the line from there, so trailing prose cannot swallow it or a
    // later path. The re-read also yields the group's interior words (`b.mjs` from `src/{a b.mjs`) as
    // paths: harmless here (one more clash), and worktree-preflight blocks the task on
    // `unparseable-declared` anyway, so such a token can never widen a scope.
    const ws = line.slice(openAt).search(/\s/);
    if (ws < 0) out.push(line.slice(start).trim());
    else {
      out.push(line.slice(start, openAt + ws));
      out.push(...splitTokens(line.slice(openAt + ws)));
    }
    return out;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Path-like tokens in a task file's "Files to touch" section (ends at the next `## ` heading).
 * Parenthesised notes such as "(new)" and backticks are dropped; a brace group is kept as one token even
 * when it holds spaces (`{check updatespec}.md`) and then expanded; an unbalanced brace is kept verbatim so
 * `pathsClash` can treat it as clashing with everything. The result is deduplicated in order.
 * @param {any} text task file contents
 * @returns {string[]}
 */
export function extractFiles(text) {
  if (typeof text !== "string") return [];
  /** @type {string[]} */
  const out = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+files to touch\b/i.test(line);
      continue;
    }
    if (!inSection) continue;
    const cleaned = line.replace(/\([^)]*\)/g, " ").replace(/`/g, " ").replace(/^\s*[-*]\s+/, "");
    for (const raw of splitTokens(cleaned)) {
      const tok = raw.trim().replace(/[.,;:]+$/, "");
      if (!tok || !/^[\w@./\\{},*?-]+$/.test(tok)) continue;
      if (!/[/\\]/.test(tok) && !/\.\w{1,6}\}?$/.test(tok)) continue;
      for (const p of expandBraces(tok) ?? [tok]) {
        const norm = normPath(p);
        if (!out.includes(norm)) out.push(norm);
      }
    }
  }
  return out;
}

/**
 * @param {string} glob
 * @returns {RegExp}
 */
function globRegex(glob) {
  let re = "";
  for (let k = 0; k < glob.length; k++) {
    const ch = glob[k];
    if (ch === "*" && glob[k + 1] === "*") {
      re += glob[k + 2] === "/" ? "(?:.*/)?" : ".*";
      k += glob[k + 2] === "/" ? 2 : 1;
    } else if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** @param {string} p */
const isGlob = (p) => /[*?]/.test(p);

/**
 * Could one path written in a task file name the same file as another? Directories (`dir/`) mean
 * `dir/**`. Two globs clash when one literal prefix (the text before the first wildcard) starts with the
 * other: a file matching both must start with both prefixes. Anything unparseable clashes (fail-closed).
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
export function pathsClash(a, b) {
  const ea = expandBraces(normPath(a ?? ""));
  const eb = expandBraces(normPath(b ?? ""));
  if (!ea || !eb) return true;
  /** @param {string} p */
  const asPattern = (p) => (p.endsWith("/") ? `${p}**` : p);
  for (const x of ea.map(asPattern)) {
    for (const y of eb.map(asPattern)) {
      if (x === y) return true;
      const gx = isGlob(x), gy = isGlob(y);
      if (gx && gy) {
        const px = x.slice(0, x.search(/[*?]/)), py = y.slice(0, y.search(/[*?]/));
        if (px.startsWith(py) || py.startsWith(px)) return true;
      } else if (gx ? globRegex(x).test(y) : gy && globRegex(y).test(x)) return true;
    }
  }
  return false;
}

/**
 * Declared files two tasks both touch: an identical path once, a different spelling as `a ~ b`.
 * @param {any} a
 * @param {any} b
 * @returns {string[]}
 */
export function filesOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  /** @type {string[]} */
  const out = [];
  for (const x of [...new Set(a.map(normPath))]) {
    for (const y of [...new Set(b.map(normPath))]) {
      if (!pathsClash(x, y)) continue;
      const label = x === y ? x : `${x} ~ ${y}`;
      if (!out.includes(label)) out.push(label);
    }
  }
  return out;
}

/**
 * Hotspot classes a file list touches, in HOTSPOTS order.
 * @param {any} files
 * @returns {string[]}
 */
export function hotspotClasses(files) {
  if (!Array.isArray(files)) return [];
  const paths = files.map(normPath);
  return HOTSPOTS.filter(([, re]) => paths.some((p) => re.test(p))).map(([name]) => name);
}

/**
 * The edge code can decide for a pair without asking anyone, or null when only reading can tell.
 * @param {SliceTask} a
 * @param {SliceTask} b
 * @returns {{ kind: "unknown-files" } | { kind: "file-overlap", files: string[] } | { kind: "hotspot", hotspots: string[] } | null}
 */
function certainEdge(a, b) {
  if (a.files.length === 0 || b.files.length === 0) return { kind: "unknown-files" };
  const files = filesOverlap(a.files, b.files);
  if (files.length) return { kind: "file-overlap", files };
  const hb = new Set(hotspotClasses(b.files));
  const hotspots = hotspotClasses(a.files).filter((h) => hb.has(h));
  if (hotspots.length) return { kind: "hotspot", hotspots };
  return null;
}

/**
 * Keep only usable task objects, coerced to the SliceTask shape. Indexes into the result are the
 * indexes used in question ids and `tasks[i]` paths, so build and merge must both go through here.
 * @param {any} tasks
 * @returns {SliceTask[]}
 */
function normTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  /** @type {SliceTask[]} */
  const out = [];
  for (const t of tasks) {
    if (!t || typeof t !== "object") continue;
    const id = String(t.id ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      title: String(t.title ?? ""),
      files: Array.isArray(t.files) ? t.files.map(String) : [],
      criteria: Array.isArray(t.criteria) ? t.criteria.map(String) : [],
    });
  }
  return out;
}

/**
 * Build the shared state and the batched Noul questions.
 * @param {any} tasks
 * @param {{ batchSize?: any }} [opts]
 * @returns {{ state: { tasks: { id: string, title: string, files: string[], acceptance_criteria: string[] }[] },
 *   batches: Record<string, { type: "noul", instructions: string }>[] }}
 */
export function buildSliceRequests(tasks, opts = {}) {
  const list = normTasks(tasks);
  const size = typeof opts?.batchSize === "number" && Number.isFinite(opts.batchSize) && opts.batchSize >= 1
    ? Math.floor(opts.batchSize) : DEFAULT_BATCH_SIZE;
  const state = {
    tasks: list.map((t) => ({ id: t.id, title: t.title, files: t.files, acceptance_criteria: t.criteria })),
  };
  /** @type {[string, string][]} */
  const qs = [];
  list.forEach((_, i) => {
    qs.push([
      `fragment_${i}`,
      `Is \`tasks[${i}]\` a fragment too small to stand alone as a PR-sized change (for example a doc-only or one-line edit that belongs inside a neighbouring task), rather than a cohesive vertical slice?`,
    ]);
  });
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (certainEdge(list[i], list[j])) continue; // certain: code decides it
      for (const [prefix, , ask] of PAIR_QUESTIONS) qs.push([`${prefix}_${i}_${j}`, ask(i, j)]);
    }
  }
  /** @type {Record<string, { type: "noul", instructions: string }>[]} */
  const batches = [];
  for (let k = 0; k < qs.length; k += size) {
    /** @type {Record<string, { type: "noul", instructions: string }>} */
    const batch = {};
    for (const [id, instructions] of qs.slice(k, k + size)) batch[id] = { type: "noul", instructions };
    batches.push(batch);
  }
  return { state, batches };
}

/**
 * @typedef {"file-overlap" | "unknown-files" | "hotspot" | "dependency" | "contract" | "shared-state" | "unanswered"} EdgeKind
 * @typedef {{ from: string, to: string, kind: EdgeKind, p?: number, files?: string[], hotspots?: string[], questions?: string[] }} SliceEdge
 */

/**
 * Merge per-batch results into edges, fragment warnings and waves, FAIL-CLOSED: a pair code did not
 * decide needs a valid answer to EVERY pair question, or it gets an `unanswered` edge. A failed batch is
 * also reported in `skipped`. Edges always run from a lower to a higher index, so the graph has no cycle,
 * and two tasks in one wave therefore have no edge of any kind between them.
 * @param {any} tasks the same value passed to buildSliceRequests
 * @param {any} results one entry per batch: `{ ok: true, answers }` or `{ ok: false, reason }`
 * @param {{ edgeThreshold?: number, fragmentThreshold?: number }} [opts]
 * @returns {{
 *   edges: SliceEdge[],
 *   fragments: { id: string, p: number }[],
 *   skipped: { batch: number, reason: string }[],
 *   unanswered: { from: string, to: string, questions: string[] }[],
 *   waves: string[][],
 *   parallel_candidates: string[][],
 * }}
 */
export function mergeSliceAnswers(tasks, results, opts = {}) {
  const edgeThreshold = typeof opts?.edgeThreshold === "number" ? opts.edgeThreshold : EDGE_THRESHOLD;
  const fragmentThreshold = typeof opts?.fragmentThreshold === "number" ? opts.fragmentThreshold : DEFAULT_THRESHOLD;
  const list = normTasks(tasks);
  /** @type {Record<string, any>} */
  const answers = {};
  /** @type {{ batch: number, reason: string }[]} */
  const skipped = [];
  (Array.isArray(results) ? results : []).forEach((r, idx) => {
    if (r && typeof r === "object" && r.ok === true && r.answers && typeof r.answers === "object") Object.assign(answers, r.answers);
    else skipped.push({ batch: idx, reason: r && typeof r === "object" && typeof r.reason === "string" ? r.reason : "bad-result" });
  });

  /** @type {SliceEdge[]} */
  const edges = [];
  /** @type {{ from: string, to: string, questions: string[] }[]} */
  const unanswered = [];
  /** @type {number[]} */
  const level = list.map(() => 0);
  /** @param {number} i @param {number} j */
  const link = (i, j) => {
    level[j] = Math.max(level[j], level[i] + 1);
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const from = list[i].id, to = list[j].id;
      const certain = certainEdge(list[i], list[j]);
      if (certain) {
        edges.push({ from, to, ...certain });
        link(i, j);
        continue;
      }
      /** @type {string[]} */
      const missing = [];
      for (const [prefix, kind] of PAIR_QUESTIONS) {
        const qid = `${prefix}_${i}_${j}`;
        const p = noulValue(answers[qid]);
        if (p === null) missing.push(qid);
        else if (p >= edgeThreshold) {
          edges.push({ from, to, kind, p });
          link(i, j);
        }
      }
      if (missing.length) {
        edges.push({ from, to, kind: "unanswered", questions: missing });
        unanswered.push({ from, to, questions: missing });
        link(i, j);
      }
    }
  }

  /** @type {{ id: string, p: number }[]} */
  const fragments = [];
  list.forEach((t, i) => {
    const p = noulValue(answers[`fragment_${i}`]);
    if (p !== null && p >= fragmentThreshold) fragments.push({ id: t.id, p });
  });

  /** @type {string[][]} */
  const waves = [];
  list.forEach((t, i) => {
    (waves[level[i]] ??= []).push(t.id);
  });
  return { edges, fragments, skipped, unanswered, waves, parallel_candidates: waves.filter((w) => w.length >= 2) };
}
