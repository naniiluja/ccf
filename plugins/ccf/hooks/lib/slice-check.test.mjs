// Tests for lib/slice-check.mjs — node --test, no dependency.
// Pure helpers behind scripts/jev-slice-check.mjs: read a task's `Files to touch`, compute file overlap
// in code (never asked of Jev), build batched pairwise Noul questions, merge answers into a
// dependency graph with waves, fragment warnings and skipped-batch reports.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractFiles,
  filesOverlap,
  buildSliceRequests,
  mergeSliceAnswers,
  DEFAULT_BATCH_SIZE,
} from "./slice-check.mjs";

const T = (id, files, extra = {}) => ({ id, title: `task ${id}`, files, criteria: [`crit ${id}`], ...extra });
const TASKS = [T("1", ["a.mjs"]), T("2", ["a.mjs"]), T("3", ["c.mjs"]), T("4", ["d.mjs"])];

// ---- extractFiles ------------------------------------------------------------------------------

test("extractFiles: path-like tokens from the `Files to touch` section only, deduplicated", () => {
  const text = [
    "# Task", "", "## Goal", "mentions other.mjs in prose", "",
    "## Files to touch",
    "plugins/ccf/hooks/a.mjs (new), hooks.json, `lib/b.mjs`",
    "- README.md, plugins/ccf/hooks/a.mjs",
    "",
    "## Test first", "x/y.mjs",
  ].join("\n");
  assert.deepEqual(extractFiles(text), ["plugins/ccf/hooks/a.mjs", "hooks.json", "lib/b.mjs", "README.md"]);
});

test("extractFiles: missing section, empty, non-string → []", () => {
  assert.deepEqual(extractFiles("# no files section"), []);
  for (const g of [undefined, null, 5, {}, ""]) assert.deepEqual(extractFiles(g), []);
});

// ---- filesOverlap ------------------------------------------------------------------------------

test("filesOverlap: shared normalized paths; backslashes and ./ prefix do not hide a clash", () => {
  assert.deepEqual(filesOverlap(["a/b.mjs", "c.mjs"], ["./a\\b.mjs", "d.mjs"]), ["a/b.mjs"]);
  assert.deepEqual(filesOverlap(["a"], ["b"]), []);
  for (const g of [undefined, null, "x", 5]) assert.deepEqual(filesOverlap(g, ["a"]), []);
});

// ---- buildSliceRequests ------------------------------------------------------------------------

test("buildSliceRequests: one state with named fields, questions reference tasks[i] by path", () => {
  const r = buildSliceRequests(TASKS);
  assert.equal(r.state.tasks.length, 4);
  assert.deepEqual(Object.keys(r.state.tasks[0]).sort(), ["acceptance_criteria", "files", "id", "title"]);
  const all = Object.assign({}, ...r.batches);
  assert.match(all.dep_0_2.instructions, /tasks\[0\]/);
  assert.match(all.dep_0_2.instructions, /tasks\[2\]/);
  assert.equal(all.dep_0_2.type, "noul");
});

test("buildSliceRequests: overlapping pairs are NOT asked (code decides them); every other pair gets dep + contract; every task gets a fragment question", () => {
  const all = Object.assign({}, ...buildSliceRequests(TASKS).batches);
  assert.ok(!("dep_0_1" in all) && !("contract_0_1" in all), "tasks 1 and 2 share a.mjs");
  for (const [i, j] of [[0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) {
    assert.ok(`dep_${i}_${j}` in all && `contract_${i}_${j}` in all, `pair ${i},${j}`);
  }
  for (let i = 0; i < 4; i++) assert.ok(`fragment_${i}` in all);
  assert.equal(Object.keys(all).length, 5 * 2 + 4);
});

test("buildSliceRequests: batches never exceed batchSize and lose no question", () => {
  const r = buildSliceRequests(TASKS, { batchSize: 5 });
  assert.deepEqual(r.batches.map((b) => Object.keys(b).length), [5, 5, 4]);
  assert.equal(buildSliceRequests(TASKS).batches.length, 1);
  assert.equal(DEFAULT_BATCH_SIZE, 100);
  for (const bad of [0, -1, NaN, "x", undefined]) {
    assert.equal(buildSliceRequests(TASKS, { batchSize: bad }).batches.length, 1, `bad batchSize ${String(bad)} falls back to the default`);
  }
});

test("buildSliceRequests: one task → fragment question only; none / garbage → no batches, never throws", () => {
  const one = Object.keys(Object.assign({}, ...buildSliceRequests([T("1", ["a"])]).batches));
  assert.deepEqual(one, ["fragment_0"]);
  for (const g of [[], undefined, null, "x", 5, [null, 1]]) assert.deepEqual(buildSliceRequests(g).batches, []);
});

// ---- mergeSliceAnswers -------------------------------------------------------------------------

const ok = (answers) => ({ ok: true, answers });
const n = (v) => ({ noul: v });

test("mergeSliceAnswers: file overlap always yields an edge; dependency/contract edges at or above the threshold", () => {
  const r = mergeSliceAnswers(TASKS, [ok({
    dep_0_2: n(0.5), contract_0_2: n(0.49), dep_2_3: n(0.9), fragment_0: n(0.1),
  })]);
  const kinds = r.edges.map((e) => `${e.from}>${e.to}:${e.kind}`).sort();
  assert.deepEqual(kinds, ["1>2:file-overlap", "1>3:dependency", "3>4:dependency"]);
  assert.deepEqual(r.edges.find((e) => e.kind === "file-overlap").files, ["a.mjs"]);
  assert.equal(r.edges.find((e) => e.from === "1" && e.to === "3").p, 0.5);
});

test("mergeSliceAnswers: fragments at or above the threshold are reported with p", () => {
  const r = mergeSliceAnswers(TASKS, [ok({ fragment_2: n(0.5), fragment_3: n(0.49) })]);
  assert.deepEqual(r.fragments, [{ id: "3", p: 0.5 }]);
});

test("mergeSliceAnswers: waves are topological levels in input order; independent tasks share wave 0", () => {
  const r = mergeSliceAnswers(TASKS, [ok({ dep_2_3: n(0.9) })]);
  // edges: 1>2 (overlap), 3>4 (dep) → levels 1:0, 2:1, 3:0, 4:1
  assert.deepEqual(r.waves, [["1", "3"], ["2", "4"]]);
});

test("mergeSliceAnswers: a failed batch is skipped and reported, its questions are unjudged, other batches still count", () => {
  const r = mergeSliceAnswers(TASKS, [{ ok: false, reason: "invalid-request" }, ok({ dep_2_3: n(0.9) })]);
  assert.deepEqual(r.skipped, [{ batch: 0, reason: "invalid-request" }]);
  assert.ok(r.edges.some((e) => e.kind === "dependency"));
});

test("mergeSliceAnswers: missing / malformed answers are unjudged, never an edge; garbage input never throws", () => {
  const r = mergeSliceAnswers(TASKS, [ok({ dep_0_2: { noul: "high" }, dep_0_3: n(2), dep_1_2: n(-1), dep_1_3: {}, dep_2_3: null })]);
  assert.deepEqual(r.edges.map((e) => e.kind), ["file-overlap"]);
  for (const g of [undefined, null, "x", 5, [], [null], [{}]]) {
    const out = mergeSliceAnswers(TASKS, g);
    assert.ok(Array.isArray(out.edges) && Array.isArray(out.waves));
  }
  assert.deepEqual(mergeSliceAnswers(undefined, [ok({})]).waves, []);
});

test("mergeSliceAnswers: a task depending on an earlier one never forms a cycle (edges only run from lower to higher index)", () => {
  const r = mergeSliceAnswers(TASKS, [ok({ dep_0_2: n(1), dep_0_3: n(1), dep_2_3: n(1), dep_1_2: n(1) })]);
  const flat = r.waves.flat();
  assert.equal(new Set(flat).size, flat.length);
  assert.equal(flat.length, 4);
});
