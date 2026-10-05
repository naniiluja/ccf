import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGoal, inlineEligibility, buildInlineRequest, decideTaskModes, INLINE_MAX_FILES, INLINE_THRESHOLD } from "./inline-gate.mjs";

const task = (id, files = ["src/a.js"], extra = {}) => ({ id, title: `t${id}`, goal: "g", files, fileLines: files.map(() => 10), criteria: ["works"], touchesUi: false, ...extra });
const answer = (noul) => ({ noul });

test("extractGoal: the first non-empty line under ## Goal; none → empty", () => {
  assert.equal(extractGoal("# T\n\n## Goal (one sentence)\n\nRename a flag.\n\n## Files to touch\n"), "Rename a flag.");
  assert.equal(extractGoal("## Goal\n\n## Files to touch\n- a.js\n"), "");
  assert.equal(extractGoal("no goal here"), "");
  assert.equal(extractGoal(undefined), "");
});

test("inlineEligibility: 1..INLINE_MAX_FILES concrete paths, not UI; otherwise a fixed reason", () => {
  assert.deepEqual(inlineEligibility(task("1")), { eligible: true, reason: "eligible" });
  assert.equal(inlineEligibility(task("1", Array.from({ length: INLINE_MAX_FILES }, (_, i) => `f${i}.js`))).eligible, true);
  assert.equal(inlineEligibility(task("1", Array.from({ length: INLINE_MAX_FILES + 1 }, (_, i) => `f${i}.js`))).reason, "too-many-files");
  assert.equal(inlineEligibility(task("1", [])).reason, "no-files");
  assert.equal(inlineEligibility(task("1", ["src/{a.js"])).reason, "unparseable-path");
  assert.equal(inlineEligibility(task("1", ["src/*.js"])).reason, "unparseable-path");
  assert.equal(inlineEligibility(task("1", ["src/a.js"], { touchesUi: true })).reason, "touches-ui");
  assert.equal(inlineEligibility(undefined).reason, "no-files");
});

test("buildInlineRequest: asks one noul per eligible task, with title, goal, files + existing lines and criteria as state", () => {
  const r = buildInlineRequest([task("1"), task("2", [])]);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.questions), ["1::small"]);
  assert.equal(r.questions["1::small"].type, "noul");
  assert.deepEqual(r.state, { tasks: [{ id: "1", title: "t1", goal: "g", files: [{ path: "src/a.js", existingLines: 10 }], criteria: ["works"] }] });
});

test("buildInlineRequest: no eligible task → nothing-to-ask; state over the cap → too-large, never truncated", () => {
  assert.deepEqual(buildInlineRequest([task("1", [])]), { ok: false, reason: "nothing-to-ask", state: null, questions: {} });
  assert.equal(buildInlineRequest(undefined).reason, "nothing-to-ask");
  assert.deepEqual(buildInlineRequest([task("1", ["a.js"], { goal: "x".repeat(500) })], 100), { ok: false, reason: "too-large", state: null, questions: {} });
});

test("decideTaskModes: small → inline, large → worktree, the threshold itself counts as small", () => {
  const modes = decideTaskModes([task("1"), task("2"), task("3")], { status: "ok", answers: { "1::small": answer(0.95), "2::small": answer(0.2), "3::small": answer(INLINE_THRESHOLD) } });
  assert.deepEqual(modes.get("1"), { mode: "inline", reason: "jev-small", score: 0.95 });
  assert.deepEqual(modes.get("2"), { mode: "worktree", reason: "jev-large", score: 0.2 });
  assert.equal(modes.get("3").mode, "inline");
});

test("decideTaskModes: Jev missing key, failed, too large or not asked → every task stays in a worktree", () => {
  for (const status of ["not-asked", "no-key", "timeout", "rate-limited", "network", "bad-json", "too-large", undefined]) {
    const modes = decideTaskModes([task("1")], { status, answers: { "1::small": answer(0.99) } });
    assert.equal(modes.get("1").mode, "worktree", String(status));
    assert.equal(modes.get("1").reason, status ?? "not-asked");
  }
  assert.equal(decideTaskModes([task("1")], undefined).get("1").mode, "worktree");
});

test("decideTaskModes: a missing or malformed answer is unanswered → worktree; an ineligible task is never inline even on a yes", () => {
  const modes = decideTaskModes([task("1"), task("2"), task("3", ["a.js"], { touchesUi: true })], { status: "ok", answers: { "2::small": { noul: 1.5 }, "3::small": answer(1) } });
  assert.deepEqual(modes.get("1"), { mode: "worktree", reason: "unanswered", score: null });
  assert.equal(modes.get("2").reason, "unanswered");
  assert.deepEqual(modes.get("3"), { mode: "worktree", reason: "touches-ui", score: null });
});
