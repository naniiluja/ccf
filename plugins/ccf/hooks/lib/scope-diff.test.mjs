import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredScope, assessScope } from "./scope-diff.mjs";

const INLINE_TASK = [
  "# Task 001 - greet",
  "Files to touch: src/greet.js, test/greet.test.js only.",
  "## Acceptance criteria",
  "- [ ] No file other than src/greet.js and test/greet.test.js is modified",
].join("\n");

const SECTION_TASK = [
  "# Task 002",
  "## Files to touch",
  "- `plugins/ccf/{commands/check,agents/ccf-scope-checker}.md`",
  "## Acceptance criteria",
  "- [ ] Files to touch: this line is a criterion, not the scope",
].join("\n");

test("declaredScope reads an inline Files to touch line", () => {
  assert.deepEqual(declaredScope(INLINE_TASK), ["src/greet.js", "test/greet.test.js"]);
});

test("declaredScope prefers the Files to touch section and expands braces", () => {
  assert.deepEqual(declaredScope(SECTION_TASK), ["plugins/ccf/commands/check.md", "plugins/ccf/agents/ccf-scope-checker.md"]);
});

test("declaredScope accepts a bold inline label and a list bullet", () => {
  assert.deepEqual(declaredScope("- **Files to touch:** `src/a.js`, `src/b.js`"), ["src/a.js", "src/b.js"]);
});

test("declaredScope returns [] for missing or non-string input", () => {
  assert.deepEqual(declaredScope("# no scope here"), []);
  assert.deepEqual(declaredScope(undefined), []);
  assert.deepEqual(declaredScope(null), []);
});

test("assessScope flags an undeclared source file (scope creep)", () => {
  const result = assessScope({ changed: ["src/greet.js", "test/greet.test.js", "src/logger.js"], taskText: INLINE_TASK });
  assert.deepEqual(result.outOfScope, ["src/logger.js"]);
  assert.equal(result.noDeclaredFiles, false);
});

test("assessScope flags an undeclared doc file even when the edit breaks no rule", () => {
  const result = assessScope({ changed: ["README.md", "src/greet.js"], taskText: INLINE_TASK });
  assert.deepEqual(result.outOfScope, ["README.md"]);
});

test("assessScope keeps tests, PLAN.md and the task's own file in scope", () => {
  const result = assessScope({
    changed: ["test/other.test.js", ".claude/plan/PLAN.md", ".claude/plan/task-001-greet.md", "./src/greet.js"],
    taskText: INLINE_TASK,
    taskFile: ".claude/plan/task-001-greet.md",
  });
  assert.deepEqual(result.outOfScope, []);
});

test("assessScope does not exempt another task's file", () => {
  const result = assessScope({ changed: [".claude/plan/task-002-other.md"], taskText: INLINE_TASK, taskFile: ".claude/plan/task-001-greet.md" });
  assert.deepEqual(result.outOfScope, [".claude/plan/task-002-other.md"]);
});

test("assessScope with no declared list flags nothing but says so", () => {
  const result = assessScope({ changed: ["src/x.js"], taskText: "# Task\nno list" });
  assert.deepEqual(result.outOfScope, []);
  assert.equal(result.noDeclaredFiles, true);
});

test("assessScope reports an unparseable declared entry and lets it cover nothing", () => {
  const result = assessScope({ changed: ["src/a.js"], taskText: "## Files to touch\n- src/{a.js" });
  assert.deepEqual(result.unparseable, ["src/{a.js"]);
  assert.deepEqual(result.outOfScope, ["src/a.js"]);
});

test("assessScope tolerates malformed input", () => {
  assert.deepEqual(assessScope(undefined).outOfScope, []);
  assert.deepEqual(assessScope({ changed: "src/a.js", taskText: 5 }).outOfScope, []);
});
