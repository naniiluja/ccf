import { test } from "node:test";
import assert from "node:assert/strict";
import { iterationSlug, worktreeName, worktreesByBranch, applyBlockers, tail, WORKTREE_NAME_MAX } from "./worktree-wave.mjs";
import { taskIdFromBranch } from "./worktree-preflight.mjs";

test("iterationSlug: the first `## Origin` heading, lowercased and dash-joined; no heading → iter", () => {
  assert.equal(iterationSlug("# Plan\n\n## Origin: Parallel Cook + Worktrees\n\n## Origin: later"), "parallel-cook-worktrees");
  assert.equal(iterationSlug("## Origin — review-quality 058→062"), "review-quality-058-062");
  assert.equal(iterationSlug("## Origin: " + "x".repeat(60)), "x".repeat(24));
  assert.equal(iterationSlug("## Origin: —"), "iter");
  assert.equal(iterationSlug(undefined), "iter");
});

test("iterationSlug: dot runs collapse, so the slug is always a valid git branch component", () => {
  const slug = iterationSlug("## Origin: v1...v2 migration");
  assert.ok(!slug.includes(".."), slug);
  assert.equal(slug, "v1-v2-migration");
  const name = worktreeName(slug, "101");
  assert.ok(name && !name.includes(".."), String(name));
});

test("worktreeName: ccf-<slug>-<id>, at most 64 chars, and preflight reads the id back from its branch", () => {
  assert.equal(worktreeName("parallel-cook", "067"), "ccf-parallel-cook-067");
  const long = worktreeName("a".repeat(80), "12345");
  assert.ok(long && long.length <= WORKTREE_NAME_MAX);
  for (const [slug, id] of [["it", "7a"], ["x-", "1"], ["a".repeat(70), "999"]]) {
    const name = worktreeName(slug, id);
    assert.equal(taskIdFromBranch(`worktree-${name}`), id, String(name));
  }
});

test("worktreeName: an id git or preflight cannot carry → null", () => {
  for (const id of ["", "0-1", "a/b", "x".repeat(60), undefined]) assert.equal(worktreeName("it", id), null, String(id));
});

test("worktreesByBranch: branch → path from `git worktree list --porcelain`; detached and bare entries are skipped", () => {
  const porcelain = [
    "worktree /repo", "HEAD abc", "branch refs/heads/main", "",
    "worktree /repo/.claude/worktrees/agent-1", "HEAD def", "branch refs/heads/worktree-ccf-it-101", "",
    "worktree /repo/.claude/worktrees/agent-2", "HEAD 123", "detached", "",
  ].join("\n");
  assert.deepEqual([...worktreesByBranch(porcelain)], [["main", "/repo"], ["worktree-ccf-it-101", "/repo/.claude/worktrees/agent-1"]]);
  assert.deepEqual([...worktreesByBranch(undefined)], []);
});

test("applyBlockers: preflight must be ok and ready; --apply also needs a clean tree and a test command", () => {
  const ready = { ok: true, ready: true };
  assert.deepEqual(applyBlockers({ preflight: ready, apply: false }), []);
  assert.deepEqual(applyBlockers({ preflight: ready, apply: true, cleanTree: true, testCommand: "npm test" }), []);
  assert.deepEqual(applyBlockers({ preflight: { ok: true, ready: false }, apply: false }), ["preflight-not-ready"]);
  assert.deepEqual(applyBlockers({ preflight: { ok: false }, apply: true, cleanTree: false, testCommand: " " }), ["preflight-failed", "dirty-tree", "no-test-command"]);
  assert.deepEqual(applyBlockers(undefined), ["preflight-failed"]);
});

test("tail: keeps the last max characters", () => {
  assert.equal(tail("abcdef", 3), "def");
  assert.equal(tail("ab", 3), "ab");
  assert.equal(tail(undefined), "");
});
