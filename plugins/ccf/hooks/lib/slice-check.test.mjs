// Tests for lib/slice-check.mjs — node --test, no dependency.
// Pure helpers behind scripts/jev-slice-check.mjs: read a task's `Files to touch`, decide in code every
// pair that can be decided (file overlap after brace/glob expansion, missing file list, shared hotspot),
// ask Jev only about the rest, and merge FAIL-CLOSED: an unanswered pair is a dependency, never independence.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractFiles,
  extractDependsOn,
  expandBraces,
  pathsClash,
  filesOverlap,
  hotspotClasses,
  buildSliceRequests,
  mergeSliceAnswers,
  DEFAULT_BATCH_SIZE,
  EDGE_THRESHOLD,
} from "./slice-check.mjs";

const T = (id, files, extra = {}) => ({ id, title: `task ${id}`, files, criteria: [`crit ${id}`], ...extra });
const TASKS = [T("1", ["a.mjs"]), T("2", ["a.mjs"]), T("3", ["c.mjs"]), T("4", ["d.mjs"])];
const PAIR_PREFIXES = ["dep", "contract", "shared_state"];

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

test("extractFiles: a brace group with spaces or commas stays one token and is expanded (the 060/061 miss)", () => {
  const text = ["## Files to touch", "- plugins/ccf/commands/{check updatespec}.md", "- `.claude/rules/{architecture,tooling}.md`, b/{ x , y }.js"].join("\n");
  assert.deepEqual(extractFiles(text), [
    "plugins/ccf/commands/check.md", "plugins/ccf/commands/updatespec.md",
    ".claude/rules/architecture.md", ".claude/rules/tooling.md", "b/x.js", "b/y.js",
  ]);
});

test("extractFiles: an unbalanced brace is kept verbatim (so it clashes with everything), never throws", () => {
  assert.deepEqual(extractFiles("## Files to touch\nsrc/{a,b.mjs"), ["src/{a,b.mjs"]);
  // prose after the unclosed brace must not swallow the token, nor a valid path earlier on the line
  const withProse = extractFiles("## Files to touch\n- `lib/x.mjs`, `src/{a b.mjs` — parser note");
  assert.ok(withProse.includes("lib/x.mjs") && withProse.includes("src/{a"), JSON.stringify(withProse));
  const later = extractFiles("## Files to touch\n- `src/{a b.mjs`: note, `lib/y.mjs`");
  assert.ok(later.includes("src/{a") && later.includes("lib/y.mjs"), JSON.stringify(later));
});

test("extractFiles: missing section, empty, non-string → []", () => {
  assert.deepEqual(extractFiles("# no files section"), []);
  for (const g of [undefined, null, 5, {}, ""]) assert.deepEqual(extractFiles(g), []);
});

// ---- expandBraces / pathsClash / hotspotClasses ----------------------------------------------

test("expandBraces: nested and multiple groups; no group → itself; unbalanced → null", () => {
  assert.deepEqual(expandBraces("a/{b,c}/{d,e}.md"), ["a/b/d.md", "a/b/e.md", "a/c/d.md", "a/c/e.md"]);
  assert.deepEqual(expandBraces("x/{a,{b,c}}.js"), ["x/a.js", "x/b.js", "x/c.js"]);
  assert.deepEqual(expandBraces("plain.md"), ["plain.md"]);
  for (const bad of ["a/{b,c.md", "a/b}.md", "a/{}.md"]) assert.equal(expandBraces(bad), null, bad);
});

test("pathsClash: equal paths, glob vs concrete, directory vs file under it", () => {
  assert.equal(pathsClash("src/a.ts", "./src/a.ts"), true);
  assert.equal(pathsClash("src/a.ts", "src/b.ts"), false);
  assert.equal(pathsClash("src/*.ts", "src/a.ts"), true);
  assert.equal(pathsClash("src/*.ts", "src/deep/a.ts"), false, "* does not cross /");
  assert.equal(pathsClash("src/**/*.ts", "src/deep/a.ts"), true);
  assert.equal(pathsClash("src/", "src/deep/a.ts"), true);
  assert.equal(pathsClash("docs/", "src/a.ts"), false);
});

test("pathsClash: two globs clash only when one literal prefix contains the other; unparseable clashes with all", () => {
  assert.equal(pathsClash("src/a/*.ts", "src/b/*.ts"), false);
  assert.equal(pathsClash("src/**", "src/b/*.ts"), true);
  assert.equal(pathsClash("src/{a,b.ts", "totally/else.md"), true);
  assert.equal(pathsClash("{a,b}.md", "b.md"), true);
});

test("hotspotClasses: lockfile, migration, generated, barrel, shared config, shared spec", () => {
  assert.deepEqual(hotspotClasses(["package-lock.json"]), ["dependency-manifest"]);
  assert.deepEqual(hotspotClasses(["db/migrations/001_init.sql"]), ["migration-schema"]);
  assert.deepEqual(hotspotClasses(["src/__snapshots__/a.snap"]), ["generated"]);
  assert.deepEqual(hotspotClasses(["src/index.ts"]), ["barrel-export"]);
  assert.deepEqual(hotspotClasses(["tsconfig.json", "plugins/ccf/hooks/hooks.json"]), ["shared-config"]);
  assert.deepEqual(hotspotClasses(["CLAUDE.md", ".claude/rules/x.md", "README.vi.md"]), ["shared-spec"]);
  assert.deepEqual(hotspotClasses(["src/feature/a.ts"]), []);
  for (const g of [undefined, null, 5]) assert.deepEqual(hotspotClasses(g), []);
});

// ---- filesOverlap ------------------------------------------------------------------------------

test("filesOverlap: shared normalized paths; backslashes and ./ prefix do not hide a clash", () => {
  assert.deepEqual(filesOverlap(["a/b.mjs", "c.mjs"], ["./a\\b.mjs", "d.mjs"]), ["a/b.mjs"]);
  assert.deepEqual(filesOverlap(["a"], ["b"]), []);
  assert.deepEqual(filesOverlap(["src/*.ts"], ["src/x.ts"]), ["src/*.ts ~ src/x.ts"]);
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

test("buildSliceRequests: pairs code can decide are NOT asked; every other pair gets dep + contract + shared_state; every task gets a fragment question", () => {
  const all = Object.assign({}, ...buildSliceRequests(TASKS).batches);
  for (const p of PAIR_PREFIXES) assert.ok(!(`${p}_0_1` in all), "tasks 1 and 2 share a.mjs");
  for (const [i, j] of [[0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) {
    for (const p of PAIR_PREFIXES) assert.ok(`${p}_${i}_${j}` in all, `${p} pair ${i},${j}`);
  }
  for (let i = 0; i < 4; i++) assert.ok(`fragment_${i}` in all);
  assert.equal(Object.keys(all).length, 5 * 3 + 4);
  assert.match(all.shared_state_0_2.instructions, /config|schema|migration|dependenc/i);
});

test("buildSliceRequests: a task with no files, or two tasks on one hotspot class, is decided in code and never asked", () => {
  const all = Object.assign({}, ...buildSliceRequests([T("1", []), T("2", ["x.mjs"]), T("3", ["README.md"]), T("4", ["CLAUDE.md"])]).batches);
  for (const p of PAIR_PREFIXES) {
    assert.ok(!(`${p}_0_1` in all) && !(`${p}_0_2` in all), "task 1 has no files");
    assert.ok(!(`${p}_2_3` in all), "3 and 4 share the shared-spec hotspot");
    assert.ok(`${p}_1_2` in all);
  }
});

test("buildSliceRequests: batches never exceed batchSize and lose no question", () => {
  const r = buildSliceRequests(TASKS, { batchSize: 5 });
  assert.deepEqual(r.batches.map((b) => Object.keys(b).length), [5, 5, 5, 4]);
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
/** Every question buildSliceRequests would ask, answered `value`, with overrides on top. */
const answerAll = (tasks, value, overrides = {}) => {
  const answers = {};
  for (const b of buildSliceRequests(tasks).batches) for (const id of Object.keys(b)) answers[id] = n(value);
  return ok({ ...answers, ...overrides });
};
const kinds = (r) => r.edges.map((e) => `${e.from}>${e.to}:${e.kind}`).sort();

test("mergeSliceAnswers: file overlap always yields an edge; Jev edges at or above EDGE_THRESHOLD (0.3)", () => {
  assert.equal(EDGE_THRESHOLD, 0.3);
  const r = mergeSliceAnswers(TASKS, [answerAll(TASKS, 0.1, {
    dep_0_2: n(0.3), contract_0_2: n(0.29), shared_state_2_3: n(0.9),
  })]);
  assert.deepEqual(kinds(r), ["1>2:file-overlap", "1>3:dependency", "3>4:shared-state"]);
  assert.deepEqual(r.edges.find((e) => e.kind === "file-overlap").files, ["a.mjs"]);
  assert.equal(r.edges.find((e) => e.from === "1" && e.to === "3").p, 0.3);
  assert.deepEqual(r.unanswered, []);
});

test("mergeSliceAnswers: code-decided edges for a missing file list and a shared hotspot", () => {
  const tasks = [T("1", []), T("2", ["x.mjs"]), T("3", ["README.md"]), T("4", ["CLAUDE.md"])];
  const r = mergeSliceAnswers(tasks, [answerAll(tasks, 0.1)]);
  assert.deepEqual(kinds(r), ["1>2:unknown-files", "1>3:unknown-files", "1>4:unknown-files", "3>4:hotspot"]);
  assert.deepEqual(r.edges.find((e) => e.kind === "hotspot").hotspots, ["shared-spec"]);
});

test("mergeSliceAnswers: fragments use the fragment threshold (0.5), not the edge threshold", () => {
  const r = mergeSliceAnswers(TASKS, [answerAll(TASKS, 0.1, { fragment_2: n(0.5), fragment_3: n(0.49) })]);
  assert.deepEqual(r.fragments, [{ id: "3", p: 0.5 }]);
});

test("mergeSliceAnswers: waves are topological levels in input order; fully-cleared tasks share a wave and become parallel candidates", () => {
  const r = mergeSliceAnswers(TASKS, [answerAll(TASKS, 0.1, { dep_2_3: n(0.9) })]);
  // edges: 1>2 (overlap), 3>4 (dep) → levels 1:0, 2:1, 3:0, 4:1
  assert.deepEqual(r.waves, [["1", "3"], ["2", "4"]]);
  assert.deepEqual(r.parallel_candidates, [["1", "3"], ["2", "4"]]);
});

test("mergeSliceAnswers: FAIL-CLOSED — no answers at all → every undecided pair is `unanswered` and the plan is fully sequential", () => {
  const r = mergeSliceAnswers(TASKS, []);
  assert.deepEqual(r.waves, [["1"], ["2"], ["3"], ["4"]]);
  assert.deepEqual(r.parallel_candidates, []);
  assert.equal(r.unanswered.length, 5);
  assert.deepEqual(r.unanswered[0], { from: "1", to: "3", questions: ["dep_0_2", "contract_0_2", "shared_state_0_2"] });
});

test("mergeSliceAnswers: a failed batch is skipped and reported; its pairs are unanswered, other batches still count", () => {
  const all = answerAll(TASKS, 0.1).answers;
  const first = {}; const rest = {};
  for (const [k, v] of Object.entries(all)) (k.endsWith("_2_3") ? rest : first)[k] = v;
  rest.dep_2_3 = n(0.9);
  const r = mergeSliceAnswers(TASKS, [{ ok: false, reason: "invalid-request" }, ok(rest)]);
  assert.deepEqual(r.skipped, [{ batch: 0, reason: "invalid-request" }]);
  assert.ok(r.edges.some((e) => e.kind === "dependency" && e.from === "3"));
  assert.deepEqual(r.unanswered.map((u) => `${u.from}>${u.to}`), ["1>3", "1>4", "2>3", "2>4"]);
});

test("mergeSliceAnswers: ONE missing or malformed question makes its pair unanswered; garbage input never throws", () => {
  const r = mergeSliceAnswers(TASKS, [answerAll(TASKS, 0.1, { dep_0_2: { noul: "high" }, contract_0_3: n(2), shared_state_1_2: n(-1), dep_1_3: {}, contract_2_3: null })]);
  assert.deepEqual(r.unanswered.map((u) => `${u.from}>${u.to}:${u.questions.join(",")}`), [
    "1>3:dep_0_2", "1>4:contract_0_3", "2>3:shared_state_1_2", "2>4:dep_1_3", "3>4:contract_2_3",
  ]);
  assert.ok(r.edges.filter((e) => e.kind === "unanswered").length === 5);
  for (const g of [undefined, null, "x", 5, [], [null], [{}]]) {
    const out = mergeSliceAnswers(TASKS, g);
    assert.ok(Array.isArray(out.edges) && Array.isArray(out.waves) && Array.isArray(out.unanswered));
  }
  assert.deepEqual(mergeSliceAnswers(undefined, [ok({})]).waves, []);
});

test("mergeSliceAnswers: a task depending on an earlier one never forms a cycle (edges only run from lower to higher index)", () => {
  const r = mergeSliceAnswers(TASKS, [answerAll(TASKS, 1)]);
  const flat = r.waves.flat();
  assert.equal(new Set(flat).size, flat.length);
  assert.equal(flat.length, 4);
});

// ---- declared dependencies and the offline (no-Jev) mode -----------------------------------------

test("extractDependsOn: ids from the task-template `Depends on` line; none-markers and comments yield nothing", () => {
  assert.deepEqual(extractDependsOn("# T\n- **Depends on:** 001   <!-- exactly ONE predecessor -->\n"), ["001"]);
  assert.deepEqual(extractDependsOn("- **Depends on:** task-002, `003` and 4a\n"), ["002", "003", "4a"]);
  assert.deepEqual(extractDependsOn("- **Depends on:** —\n"), []);
  assert.deepEqual(extractDependsOn("- **Depends on:** none\n"), []);
  assert.deepEqual(extractDependsOn("no such line"), []);
  assert.deepEqual(extractDependsOn(undefined), []);
});

test("mergeSliceAnswers: a declared `Depends on` is a certain edge and is never asked, whichever side declares it", () => {
  const tasks = [T("1", ["a.mjs"]), T("2", ["b.mjs"], { dependsOn: ["1"] }), T("3", ["c.mjs"]), T("4", ["d.mjs"])];
  tasks[0].dependsOn = ["4"];
  const qids = buildSliceRequests(tasks).batches.flatMap((b) => Object.keys(b));
  assert.ok(!qids.some((q) => /_0_1$|_0_3$/.test(q)));
  const r = mergeSliceAnswers(tasks, [], { askedJev: false });
  assert.deepEqual(r.edges.map((e) => [e.from, e.to, e.kind]), [["1", "2", "declared-dependency"], ["1", "4", "declared-dependency"]]);
  assert.deepEqual(r.waves, [["1", "3"], ["2", "4"]]);
});

test("mergeSliceAnswers: askedJev false → only code-decided edges; nothing is unanswered, disjoint tasks share a wave", () => {
  const r = mergeSliceAnswers(TASKS, [], { askedJev: false });
  assert.deepEqual(r.edges.map((e) => e.kind), ["file-overlap"]);
  assert.deepEqual(r.unanswered, []);
  assert.deepEqual(r.waves, [["1", "3", "4"], ["2"]]);
});

test("mergeSliceAnswers: fail-closed survives the offline mode — no file list or an unparseable path still serializes", () => {
  const tasks = [T("1", ["src/{a.mjs"]), T("2", ["b.mjs"]), T("3", [])];
  const r = mergeSliceAnswers(tasks, [], { askedJev: false });
  assert.deepEqual(r.edges.map((e) => [e.from, e.to, e.kind]), [["1", "2", "file-overlap"], ["1", "3", "unknown-files"], ["2", "3", "unknown-files"]]);
  assert.deepEqual(r.waves, [["1"], ["2"], ["3"]]);
});
