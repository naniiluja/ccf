// Tests for lib/worktree-preflight.mjs — node --test, no dependency.
// Pure decisions behind scripts/worktree-preflight.mjs: map a worktree branch to its task, compare the
// branch's REAL changed files with the task's declared `Files to touch`, and assemble the blocking
// problems of a wave. Git itself is exercised in worktree-preflight-script.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { taskIdFromBranch, isTestPath, outOfScope, assessPreflight, normalizedCriteria, criteriaChanged, assertionBalance } from "./worktree-preflight.mjs";

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

const TASK = (criteria) => `# 7\n\n## Goal\nx\n\n## Acceptance criteria (verifiable)\n${criteria}\n\n## Files to touch\n- src/7.js\n`;

test("normalizedCriteria: the section body without list markers, checkbox state or spacing; null without the section", () => {
  assert.deepEqual(normalizedCriteria(TASK("- [ ] It   does  A\n* [x] It does B\n\n1. It does C")), ["It does A", "It does B", "It does C"]);
  assert.equal(normalizedCriteria("# 7\n## Goal\nx\n"), null);
  for (const g of [undefined, null, 5]) assert.equal(normalizedCriteria(g), null);
});

test("criteriaChanged: ticking a box or reflowing is NOT a change; rewording, adding or removing a criterion is", () => {
  const main = TASK("- [ ] It does A\n- [ ] It does B");
  assert.equal(criteriaChanged(main, TASK("- [x] It does A\n- [x] It  does B")), false);
  assert.equal(criteriaChanged(main, TASK("- [ ] It does A\n- [ ] It does B, mostly")), true);
  assert.equal(criteriaChanged(main, TASK("- [ ] It does A")), true);
  assert.equal(criteriaChanged(main, TASK("- [ ] It does A\n- [ ] It does B\n- [ ] It does C")), true);
  assert.equal(criteriaChanged(main, "# 7\n## Goal\nx\n"), true, "the branch dropped the section");
});

test("criteriaChanged: nothing to freeze or nothing to compare is never a change", () => {
  assert.equal(criteriaChanged("# 7\n## Goal\nx\n", TASK("- [ ] anything")), false);
  for (const g of [undefined, null, 5, ""]) assert.equal(criteriaChanged(g, g), false);
  assert.equal(criteriaChanged(TASK("- [ ] A"), undefined), false);
});

test("assessPreflight: a branch that rewrote its own acceptance criteria blocks as criteria-changed", () => {
  const main = TASK("- [ ] It does A");
  const own = { actual: ["src/7.js", ".claude/plan/task-7-x.md"] };
  const r = assessPreflight({ gitOk: true, branches: [B("7", { ...own, uiText: main, taskText: TASK("- [ ] It does less") })], pairs: [] });
  assert.deepEqual(r.problems, [{ kind: "criteria-changed", branch: "worktree-ccf-it-7", id: "7" }]);
  const ticked = assessPreflight({ gitOk: true, branches: [B("7", { ...own, uiText: main, taskText: TASK("- [x] It does A") })], pairs: [] });
  assert.deepEqual(ticked.problems, []);
});

test("assessPreflight: criteria edited on main after the branch forked do not blame a branch that never touched its task file", () => {
  const r = assessPreflight({ gitOk: true, branches: [B("7", { uiText: TASK("- [ ] edited later on main"), taskText: TASK("- [ ] It does A") })], pairs: [] });
  assert.deepEqual(r.problems, []);
});

test("assertionBalance: Rust and Go assertions count; a regex .test(name) call and prose with 'it (' do not", () => {
  assert.deepEqual(assertionBalance(DIFF("-    assert_eq!(a, b);", "-    assert!(ok);", "-    require.Equal(t, a, b)", "-    t.Errorf(\"bad %v\", x)", "-    t.Fatal(err)")), { removed: 5, added: 0 });
  assert.deepEqual(assertionBalance(DIFF("-  if (/x/.test(name)) return;", "-  // it (the helper) returns early", "-  const t = test(name);")), { removed: 0, added: 0 });
  assert.deepEqual(assertionBalance(DIFF("-  it('does a thing', () => {", "-  test(\"another\", async () => {")), { removed: 2, added: 0 });
});

const DIFF = (...lines) => ["diff --git a/test/a.test.js b/test/a.test.js", "--- a/test/a.test.js", "+++ b/test/a.test.js", "@@ -1,3 +1,3 @@", ...lines].join("\n");

test("assertionBalance: counts assertion-like lines removed and added in a unified diff, ignoring file headers", () => {
  assert.deepEqual(assertionBalance(DIFF("-  assert.equal(f(1), 2);", "-  expect(x).toBe(1);", "+  assert.equal(f(1), 3);", "-  const y = 1;")), { removed: 2, added: 1 });
  assert.deepEqual(assertionBalance(DIFF("-test('a', () => {", "+test('a renamed', () => {")), { removed: 1, added: 1 });
  assert.deepEqual(assertionBalance(DIFF("-    assert x == 1")), { removed: 1, added: 0 });
  for (const g of [undefined, null, 5, ""]) assert.deepEqual(assertionBalance(g), { removed: 0, added: 0 });
});

test("assessPreflight: more assertions removed than added in test files blocks as existing-test-weakened", () => {
  const weak = DIFF("-  assert.equal(f(1), 2);", "-  assert.equal(f(2), 4);", "+  assert.equal(f(1), 2);");
  const r = assessPreflight({ gitOk: true, branches: [B("7", { testDiff: weak })], pairs: [] });
  assert.deepEqual(r.problems, [{ kind: "existing-test-weakened", branch: "worktree-ccf-it-7", id: "7", removed: 2, added: 1 }]);
});

test("assessPreflight: a rewritten, renamed or only-extended test is not weakened; neither is deleting a non-assertion line", () => {
  for (const testDiff of [
    DIFF("-  assert.equal(f(1), 2);", "+  assert.equal(f(1), 3);"),
    DIFF("-  assert.equal(f(1), 2);", "+  assert.equal(f(1), 2);", "+  assert.equal(f(2), 4);"),
    DIFF("-  const y = 1;", "+  const y = 2;"),
    "",
    undefined,
  ]) {
    assert.deepEqual(assessPreflight({ gitOk: true, branches: [B("7", { testDiff })], pairs: [] }).problems, [], String(testDiff));
  }
});

test("assertionBalance: unittest self.assert*, XCTAssert*, JUnit and xUnit Assert.* forms count", () => {
  assert.deepEqual(assertionBalance(DIFF("-        self.assertEqual(total(1, 2), 3)", "-        self.assertRaises(ValueError, parse, \"\")", "-    XCTAssertEqual(a, b)", "-    Assert.assertEquals(1, x);", "-    Assert.Equal(1, x);")), { removed: 5, added: 0 });
});

test("assessPreflight: a branch that deleted its own task file loses the frozen criteria and blocks as criteria-changed", () => {
  const r = assessPreflight({ gitOk: true, branches: [B("7", { uiText: TASK("- [ ] It does A"), taskText: TASK("- [ ] It does A"), taskGone: true })], pairs: [] });
  assert.deepEqual(r.problems, [{ kind: "criteria-changed", branch: "worktree-ccf-it-7", id: "7" }]);
  const noCriteria = assessPreflight({ gitOk: true, branches: [B("7", { uiText: "# 7\n", taskGone: true })], pairs: [] });
  assert.deepEqual(noCriteria.problems, []);
});
