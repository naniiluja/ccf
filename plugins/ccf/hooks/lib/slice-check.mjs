// CCF slice-check helpers — pure logic behind scripts/jev-slice-check.mjs.
// After the plan skill writes its task table, ask Jev (TypeSafe) which task pairs depend on each other
// and which tasks are fragments, and merge the answers into a dependency graph with waves.
// Division of labor: CODE decides what is certain (two tasks touching the same file can never run in
// parallel, so that pair is never asked); Jev only judges what needs reading (does B need A's result,
// do both change one contract, is this task too small to stand alone).
// Everything is pure and defensive so it is unit-testable and never throws.

import { DEFAULT_THRESHOLD, noulValue } from "./completion-evidence.mjs";

/** Questions per request. Measured live (task 057): 400 questions in one request succeeded, so 100 is a conservative quarter of that. */
export const DEFAULT_BATCH_SIZE = 100;

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
 * Path-like tokens in a task file's "Files to touch" section (ends at the next `## ` heading).
 * Parenthesised notes such as "(new)" and backticks are dropped; the result is deduplicated in order.
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
    for (const raw of cleaned.split(/[\s,;]+/)) {
      const tok = raw.replace(/[.,;:]+$/, "");
      if (!tok || !/^[\w@./\\{}*-]+$/.test(tok)) continue;
      if (!/[/\\]/.test(tok) && !/\.\w{1,6}$/.test(tok)) continue;
      const norm = normPath(tok);
      if (!out.includes(norm)) out.push(norm);
    }
  }
  return out;
}

/**
 * Files two tasks both touch, after path normalization.
 * @param {any} a
 * @param {any} b
 * @returns {string[]}
 */
export function filesOverlap(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  const setB = new Set(b.map(normPath));
  return [...new Set(a.map(normPath))].filter((f) => setB.has(f));
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
      if (filesOverlap(list[i].files, list[j].files).length) continue; // certain: code decides it
      qs.push([`dep_${i}_${j}`, `Does \`tasks[${j}]\` need a result, decision or file produced by \`tasks[${i}]\` in order to be implemented and verified?`]);
      qs.push([`contract_${i}_${j}`, `Do \`tasks[${i}]\` and \`tasks[${j}]\` both change the same function signature, data format or behavioural contract?`]);
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
 * Merge per-batch results into edges, fragment warnings and waves. A failed batch is reported in
 * `skipped`; a missing or malformed answer is simply not an edge. Edges always run from a lower to a
 * higher index, so the graph cannot contain a cycle.
 * @param {any} tasks the same value passed to buildSliceRequests
 * @param {any} results one entry per batch: `{ ok: true, answers }` or `{ ok: false, reason }`
 * @param {number} [threshold] P(yes) at or above this counts as yes
 * @returns {{
 *   edges: { from: string, to: string, kind: "file-overlap" | "dependency" | "contract", p?: number, files?: string[] }[],
 *   fragments: { id: string, p: number }[],
 *   skipped: { batch: number, reason: string }[],
 *   waves: string[][],
 * }}
 */
export function mergeSliceAnswers(tasks, results, threshold = DEFAULT_THRESHOLD) {
  const list = normTasks(tasks);
  /** @type {Record<string, any>} */
  const answers = {};
  /** @type {{ batch: number, reason: string }[]} */
  const skipped = [];
  (Array.isArray(results) ? results : []).forEach((r, idx) => {
    if (r && typeof r === "object" && r.ok === true && r.answers && typeof r.answers === "object") Object.assign(answers, r.answers);
    else skipped.push({ batch: idx, reason: r && typeof r === "object" && typeof r.reason === "string" ? r.reason : "bad-result" });
  });

  /** @type {{ from: string, to: string, kind: "file-overlap" | "dependency" | "contract", p?: number, files?: string[] }[]} */
  const edges = [];
  /** @type {number[]} */
  const level = list.map(() => 0);
  /** @param {number} i @param {number} j */
  const link = (i, j) => {
    level[j] = Math.max(level[j], level[i] + 1);
  };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const shared = filesOverlap(list[i].files, list[j].files);
      if (shared.length) {
        edges.push({ from: list[i].id, to: list[j].id, kind: "file-overlap", files: shared });
        link(i, j);
        continue;
      }
      for (const [prefix, kind] of /** @type {const} */ ([["dep", "dependency"], ["contract", "contract"]])) {
        const p = noulValue(answers[`${prefix}_${i}_${j}`]);
        if (p !== null && p >= threshold) {
          edges.push({ from: list[i].id, to: list[j].id, kind, p });
          link(i, j);
        }
      }
    }
  }

  /** @type {{ id: string, p: number }[]} */
  const fragments = [];
  list.forEach((t, i) => {
    const p = noulValue(answers[`fragment_${i}`]);
    if (p !== null && p >= threshold) fragments.push({ id: t.id, p });
  });

  /** @type {string[][]} */
  const waves = [];
  list.forEach((t, i) => {
    (waves[level[i]] ??= []).push(t.id);
  });
  return { edges, fragments, skipped, waves };
}
