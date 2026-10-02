// Tests for lib/worktree-preflight.mjs — node --test, no dependency.
// Pure decisions behind scripts/worktree-preflight.mjs: map a worktree branch to its task, compare the
// branch's REAL changed files with the task's declared `Files to touch`, and assemble the blocking
// problems of a wave. Git itself is exercised in worktree-preflight-script.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { taskIdFromBranch, isTestPath, outOfScope, assessPreflight } from "./worktree-preflight.mjs";

// ---- taskIdFromBranch --------------------------------------------------------------------------

test("taskIdFromBranch: the last dash segment of worktree-ccf-<iteration>-<id>, iteration may hold dashes", () => {
  assert.equal(taskIdFromBranch("worktree-ccf-review-quality-061"), "061");
  assert.equal(taskIdFromBranch("worktree-ccf-it-7a"), "7a");
  assert.equal(taskIdFromBranch("refs/heads/worktree-ccf-x-12"), "12");
  for (const bad of ["main", "worktree-ccf-061", "feature/ccf-x-1", "worktree-ccf--", "", undefined, null, 5]) {
    assert.equal(taskIdFromBranch(bad), null, String(bad));
  }
});

// ---- isTestPath / outOfScope -------------------------------------------------------------------

test("isTestPath: common test layouts across languages", () => {
  for (const p of ["test/a.js", "src/__tests__/a.ts", "a.test.mjs", "pkg/a_test.go", "tests/test_a.py", "spec/a_spec.rb", "src/a.spec.ts"]) {
    assert.equal(isTestPath(p), true, p);
  }
  for (const p of ["src/a.js", "src/testing.md", "contest/a.js", "latest.json"]) assert.equal(isTestPath(p), false, p);
});

test("outOfScope: real files neither declared (exact, glob or directory) nor tests", () => {
  const declared = ["src/a.js", "docs/", "lib/*.mjs", "src/{b,c}.js"];
  const actual = ["src/a.js", "docs/deep/x.md", "lib/k.mjs", "src/c.js", "test/a.test.js", "README.md", "lib/deep/k.mjs", ".claude/plan/PLAN.md"];
  assert.deepEqual(outOfScope(actual, declared), ["README.md", "lib/deep/k.mjs", ".claude/plan/PLAN.md"]);
  assert.deepEqual(outOfScope([], declared), []);
  for (const g of [undefined, null, 5]) assert.deepEqual(outOfScope(g, declared), []);
  assert.deepEqual(outOfScope(["x.js"], undefined), ["x.js"], "no declaration → everything is out of scope");
});

test("outOfScope: an unparseable declared path covers NOTHING (fail-closed here, unlike pathsClash in slice-check)", () => {
  assert.deepEqual(outOfScope(["anything/else.mjs", "src/a.js"], ["src/{a,b.mjs", "src/a.js"]), ["anything/else.mjs"]);
});

// ---- assessPreflight ---------------------------------------------------------------------------

const B = (id, extra = {}) => ({
  branch: `worktree-ccf-it-${id}`, id, taskFile: `task-${id}-x.md`, declared: [`src/${id}.js`], actual: [`src/${id}.js`], mergeClean: true, ...extra,
});
const kinds = (r) => [...new Set(r.problems.map((p) => p.kind))].sort();

test("assessPreflight: two disjoint, clean, in-scope branches → ready with no problems", () => {
  const r = assessPreflight({ gitOk: true, branches: [B("1"), B("2")], pairs: [{ a: "worktree-ccf-it-1", b: "worktree-ccf-it-2", clean: true }] });
  assert.equal(r.ready, true);
  assert.deepEqual(r.problems, []);
});

test("assessPreflight: every blocking problem kind is reported and makes ready false", () => {
  const r = assessPreflight({
    gitOk: true,
    branches: [
      B("1", { actual: ["src/1.js", "README.md", "src/shared.js"] }),
      B("2", { actual: ["src/2.js", "src/shared.js"], declared: ["src/2.js", "src/shared.js"], mergeClean: false }),
      B("3", { taskFile: null }),
      B("4", { declared: [] }),
      B("4", { branch: "worktree-ccf-other-4" }),
      B("5", { mergeClean: null }),
      B("6", { declared: ["src/6.js", "src/{x,y.js"] }),
    ],
    pairs: [{ a: "worktree-ccf-it-1", b: "worktree-ccf-it-2", clean: false }],
  });
  assert.equal(r.ready, false);
  assert.deepEqual(kinds(r), [
    "actual-overlap", "duplicate-task", "git-error", "merge-conflict", "no-declared-files",
    "out-of-scope", "pair-conflict", "unmatched-branch", "unparseable-declared",
  ].sort());
  assert.deepEqual(r.problems.find((p) => p.kind === "unparseable-declared").files, ["src/{x,y.js"]);
  assert.deepEqual(r.problems.find((p) => p.kind === "out-of-scope").files, ["README.md", "src/shared.js"]);
  assert.deepEqual(r.problems.find((p) => p.kind === "actual-overlap").files, ["src/shared.js"]);
});

test("assessPreflight: no branches, or git too old for merge-tree --write-tree, is never ready", () => {
  assert.deepEqual(kinds(assessPreflight({ gitOk: true, branches: [], pairs: [] })), ["no-branches"]);
  const old = assessPreflight({ gitOk: false, branches: [B("1")], pairs: [] });
  assert.equal(old.ready, false);
  assert.ok(kinds(old).includes("git-too-old"));
});

test("assessPreflight: garbage input never throws and is not ready", () => {
  for (const g of [undefined, null, 5, "x", {}, { branches: "x" }, { branches: [null, 5] }]) {
    const r = assessPreflight(g);
    assert.equal(r.ready, false);
    assert.ok(Array.isArray(r.problems));
  }
});

const UI_EMPTY = "# 7\n- **Touches UI:** yes\n- **Runtime evidence:**\n";

test("assessPreflight: the branch's OWN task file is in scope, another task's file stays out-of-scope", () => {
  const own = assessPreflight({ gitOk: true, branches: [B("7", { actual: ["src/7.js", ".claude/plan/task-7-x.md"] })], pairs: [] });
  assert.deepEqual(own.problems, []);
  const other = assessPreflight({ gitOk: true, branches: [B("7", { actual: ["src/7.js", ".claude/plan/task-8-y.md"] })], pairs: [] });
  assert.deepEqual(other.problems.find((p) => p.kind === "out-of-scope").files, [".claude/plan/task-8-y.md"]);
});

test("assessPreflight: Touches UI is read from uiText, so a branch flipping it to no still blocks", () => {
  const flipped = "# 7\n- **Touches UI:** no\n- **Runtime evidence:**\n";
  const r = assessPreflight({ gitOk: true, branches: [B("7", { taskText: flipped, uiText: UI_EMPTY })], pairs: [] });
  assert.deepEqual(r.problems, [{ kind: "missing-runtime-evidence", branch: "worktree-ccf-it-7", id: "7" }]);
});

test("assessPreflight: Touches UI yes with an empty Runtime evidence blocks as missing-runtime-evidence", () => {
  const r = assessPreflight({ gitOk: true, branches: [B("7", { taskText: UI_EMPTY })], pairs: [] });
  assert.equal(r.ready, false);
  assert.deepEqual(r.problems, [{ kind: "missing-runtime-evidence", branch: "worktree-ccf-it-7", id: "7" }]);
});

test("assessPreflight: ran, not run with a reason, a non-UI task and no task text all pass the evidence check", () => {
  for (const taskText of [
    "- **Touches UI:** yes\n- **Runtime evidence:** npm run dev -> page renders\n",
    "- **Touches UI:** yes\n- **Runtime evidence:** not run: no browser\n",
    "- **Touches UI:** no\n- **Runtime evidence:**\n",
    undefined,
  ]) {
    assert.deepEqual(assessPreflight({ gitOk: true, branches: [B("7", { taskText })], pairs: [] }).problems, [], String(taskText));
  }
});
