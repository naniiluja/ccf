// Process-level tests for scripts/worktree-preflight.mjs against a REAL temporary git repository.
// Lives in hooks/lib so the standard `node --test plugins/ccf/hooks/lib/*.test.mjs` run covers it.
// Each case builds branches the way `claude -w ccf-<iteration>-<id>` names them and checks the JSON verdict,
// and that the script changed no ref, index entry or working-tree file (it is read-only by contract).

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "worktree-preflight.mjs");
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_NOSYSTEM: "1", HOME: tmpdir(),
};

/** @type {string[]} */
const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** @param {string} cwd @param {string[]} args */
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/** @param {string} dir @param {Record<string, string>} files */
function write(dir, files) {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
}

/** Main branch with two task files (101 declares src/a.js, 102 declares src/b.js) and a shared file. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "ccf-preflight-"));
  dirs.push(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  write(dir, {
    ".claude/plan/PLAN.md": "| # | Slice | Status |\n|---|---|---|\n| 101 | a | todo |\n| 102 | b | todo |\n",
    ".claude/plan/task-101-a.md": "# 101\n\n## Files to touch\n- src/a.js\n",
    ".claude/plan/task-102-b.md": "# 102\n\n## Files to touch\n- src/b.js\n",
    "src/shared.js": "export const x = 1;\n",
  });
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "base"]);
  return dir;
}

/** @param {string} dir @param {string} branch @param {Record<string, string>} files */
function branchWith(dir, branch, files) {
  git(dir, ["checkout", "-q", "-b", branch, "main"]);
  write(dir, files);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", branch]);
  git(dir, ["checkout", "-q", "main"]);
}

/** @param {string} dir */
function snapshot(dir) {
  return git(dir, ["for-each-ref", "--format=%(refname) %(objectname)"]) + git(dir, ["status", "--porcelain"]) + git(dir, ["rev-parse", "HEAD"]);
}

/** @param {string} dir @param {string[]} [extra] */
function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, "--dir", dir, ...extra], { env: GIT_ENV, encoding: "utf8", shell: false });
  return { status: r.status, out: JSON.parse(r.stdout || "{}"), stderr: r.stderr };
}

const kinds = (out) => [...new Set(out.problems.map((p) => p.kind))].sort();

test("worktree-preflight: two disjoint in-scope branches (tests allowed) → ready, and nothing in the repo changed", () => {
  const dir = makeRepo();
  branchWith(dir, "worktree-ccf-it-101", { "src/a.js": "a\n", "test/a.test.js": "t\n" });
  branchWith(dir, "worktree-ccf-it-102", { "src/b.js": "b\n" });
  const before = snapshot(dir);
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.out.ok, true);
  assert.deepEqual(r.out.problems, []);
  assert.equal(r.out.ready, true);
  assert.deepEqual(r.out.branches.map((b) => `${b.branch}:${b.id}:${b.actual.join(",")}`), [
    "worktree-ccf-it-101:101:src/a.js,test/a.test.js", "worktree-ccf-it-102:102:src/b.js",
  ]);
  assert.match(r.out.note, /commit/);
  assert.equal(snapshot(dir), before, "refs, index and working tree are untouched");
});

test("worktree-preflight: out-of-scope file, shared real file and a pairwise conflict all block", () => {
  const dir = makeRepo();
  branchWith(dir, "worktree-ccf-it-101", { "src/a.js": "a\n", "src/shared.js": "export const x = 2;\n" });
  branchWith(dir, "worktree-ccf-it-102", { "src/b.js": "b\n", "src/shared.js": "export const x = 3;\n" });
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.out.ready, false);
  assert.deepEqual(kinds(r.out), ["actual-overlap", "out-of-scope", "pair-conflict"]);
});

test("worktree-preflight: renaming an undeclared file INTO a declared path is still out-of-scope (renames are not followed)", () => {
  const dir = makeRepo();
  git(dir, ["checkout", "-q", "-b", "worktree-ccf-it-101", "main"]);
  git(dir, ["mv", "src/shared.js", "src/a.js"]);
  git(dir, ["commit", "-q", "-m", "rename"]);
  git(dir, ["checkout", "-q", "main"]);
  const r = run(dir);
  assert.equal(r.out.ready, false);
  assert.deepEqual(r.out.problems.find((p) => p.kind === "out-of-scope").files, ["src/shared.js"]);
});

test("worktree-preflight: a conflict with the integration branch blocks (merge-conflict)", () => {
  const dir = makeRepo();
  branchWith(dir, "worktree-ccf-it-101", { "src/a.js": "a from task\n" });
  write(dir, { "src/a.js": "a from main\n" });
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "main moved"]);
  const r = run(dir);
  assert.ok(kinds(r.out).includes("merge-conflict"));
  assert.equal(r.out.ready, false);
});

test("worktree-preflight: no worktree-ccf branch, an unknown task id, and --branches selection", () => {
  const dir = makeRepo();
  assert.deepEqual(kinds(run(dir).out), ["no-branches"]);
  branchWith(dir, "worktree-ccf-it-999", { "src/z.js": "z\n" });
  branchWith(dir, "worktree-ccf-it-101", { "src/a.js": "a\n" });
  assert.deepEqual(kinds(run(dir).out), ["unmatched-branch"]);
  const only = run(dir, ["--branches", "worktree-ccf-it-101"]);
  assert.equal(only.out.ready, true);
});

test("worktree-preflight: a branch may fill its own task file, and its UI evidence is read from the branch", () => {
  const dir = makeRepo();
  write(dir, { ".claude/plan/task-101-a.md": "# 101\n- **Touches UI:** yes\n- **Runtime evidence:**\n\n## Files to touch\n- src/a.js\n" });
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "101 touches ui"]);
  branchWith(dir, "worktree-ccf-it-101", { "src/a.js": "a\n" });
  const empty = run(dir);
  assert.equal(empty.out.ready, false);
  assert.deepEqual(kinds(empty.out), ["missing-runtime-evidence"]);

  branchWith(dir, "worktree-ccf-it-102", {
    "src/b.js": "b\n",
    ".claude/plan/task-101-a.md": "# 101\n- **Touches UI:** yes\n- **Runtime evidence:** open / -> renders\n\n## Files to touch\n- src/a.js\n",
  });
  git(dir, ["checkout", "-q", "worktree-ccf-it-101"]);
  write(dir, { ".claude/plan/task-101-a.md": "# 101\n- **Touches UI:** yes\n- **Runtime evidence:** not run: no browser\n\n## Files to touch\n- src/a.js\n" });
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "evidence"]);
  git(dir, ["checkout", "-q", "main"]);
  const own = run(dir, ["--branches", "worktree-ccf-it-101"]);
  assert.deepEqual(own.out.problems, []);
  assert.equal(own.out.ready, true);
  const other = run(dir, ["--branches", "worktree-ccf-it-102"]);
  assert.deepEqual(other.out.problems.find((p) => p.kind === "out-of-scope").files, [".claude/plan/task-101-a.md"]);
});

test("worktree-preflight: not a git repository → exit 0 with a reason, never a crash", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-preflight-nogit-"));
  dirs.push(dir);
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.out.ok, false);
  assert.equal(r.out.reason, "not-a-git-repo");
});
