// Process-level tests for scripts/prune-archive.mjs against a REAL temporary git repository (task 070).
// Lives in hooks/lib so the standard `node --test plugins/ccf/hooks/lib/*.test.mjs` run covers it.
// Matrix (contract level): mode {preview, apply git, apply --no-git} x file state {tracked clean,
// untracked, modified}; keep {0 rejected, non-integer rejected, 1, default 10}; a missing archive/ dir.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "prune-archive.mjs");
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

/** @param {string} cwd @param {string[]} args @returns {string} */
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/**
 * A repo whose ARCHIVE.md holds 3 iterations (newest first: 103, 102, 101) and an archive/ dir with
 * one file per iteration plus an orphan (task-001). With --keep 1, 101 and 102 are prunable.
 * @param {{ git?: boolean, archiveDir?: boolean }} [opts]
 * @returns {string}
 */
function makeRepo({ git: useGit = true, archiveDir = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-prune-"));
  dirs.push(dir);
  const planDir = join(dir, ".claude", "plan");
  mkdirSync(planDir, { recursive: true });
  const archive = ["# Archive", ""];
  for (const id of ["103", "102", "101"]) {
    archive.push(`## Origin: it-${id}`, "", "| # | Slice | Status |", "|---|---|---|", `| ${id} | s | done |`, "");
  }
  writeFileSync(join(planDir, "ARCHIVE.md"), archive.join("\n"));
  if (archiveDir) {
    mkdirSync(join(planDir, "archive"));
    for (const f of ["task-101-a.md", "task-102-b.md", "task-103-c.md", "task-001-orphan.md"]) {
      writeFileSync(join(planDir, "archive", f), `# ${f}\n`);
    }
  }
  if (useGit) {
    git(dir, ["init", "-q", "-b", "main"]);
    git(dir, ["add", "-A"]);
    git(dir, ["commit", "-q", "-m", "base"]);
  }
  return dir;
}

/** @param {string} dir @param {string[]} [extra] */
function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [SCRIPT, "--dir", dir, ...extra], { env: GIT_ENV, encoding: "utf8", shell: false });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** @param {string} dir @param {string} name */
const archived = (dir, name) => join(dir, ".claude", "plan", "archive", name);

test("prune-archive preview: lists prune + orphans, writes nothing (git status identical)", () => {
  const dir = makeRepo();
  const before = git(dir, ["status", "--porcelain"]);
  const { status, stdout } = run(dir, ["--keep", "1"]);
  assert.equal(status, 0);
  assert.match(stdout, /task-101-a\.md/);
  assert.match(stdout, /task-102-b\.md/);
  assert.match(stdout, /orphan.*task-001-orphan\.md/i);
  assert.doesNotMatch(stdout, /prune\s+task-103/);
  assert.match(stdout, /2 file\(s\) to prune/);
  assert.match(stdout, /1 orphan/);
  assert.equal(git(dir, ["status", "--porcelain"]), before);
  assert.ok(existsSync(archived(dir, "task-101-a.md")));
});

test("prune-archive --apply (git): stages deletions, creates no commit, keeps kept + orphan files", () => {
  const dir = makeRepo();
  const commits = git(dir, ["rev-list", "--count", "HEAD"]);
  const { status } = run(dir, ["--keep", "1", "--apply"]);
  assert.equal(status, 0);
  const staged = git(dir, ["diff", "--cached", "--name-status"]).trim().split("\n").sort();
  assert.deepEqual(staged, [
    "D\t.claude/plan/archive/task-101-a.md",
    "D\t.claude/plan/archive/task-102-b.md",
  ]);
  assert.equal(git(dir, ["rev-list", "--count", "HEAD"]), commits);
  assert.ok(existsSync(archived(dir, "task-103-c.md")));
  assert.ok(existsSync(archived(dir, "task-001-orphan.md")));
});

test("prune-archive --apply (git): an untracked or modified file is skipped and reported, not deleted", () => {
  const dir = makeRepo();
  appendFileSync(archived(dir, "task-101-a.md"), "local edit\n");
  writeFileSync(archived(dir, "task-102-new.md"), "untracked\n");
  const { status, stdout, stderr } = run(dir, ["--keep", "1", "--apply"]);
  assert.equal(status, 0);
  const out = stdout + stderr;
  assert.match(out, /skipped.*task-101-a\.md/i);
  assert.match(out, /skipped.*task-102-new\.md/i);
  assert.ok(existsSync(archived(dir, "task-101-a.md")), "modified file must survive");
  assert.ok(existsSync(archived(dir, "task-102-new.md")), "untracked file must survive");
  assert.ok(!existsSync(archived(dir, "task-102-b.md")), "the clean tracked file is removed");
  assert.equal(git(dir, ["diff", "--cached", "--name-status"]).trim(), "D\t.claude/plan/archive/task-102-b.md");
});

test("prune-archive --apply --no-git: deletes with fs, no git needed", () => {
  const dir = makeRepo({ git: false });
  const { status } = run(dir, ["--keep", "1", "--apply", "--no-git"]);
  assert.equal(status, 0);
  assert.ok(!existsSync(archived(dir, "task-101-a.md")));
  assert.ok(!existsSync(archived(dir, "task-102-b.md")));
  assert.ok(existsSync(archived(dir, "task-103-c.md")));
  assert.ok(existsSync(archived(dir, "task-001-orphan.md")));
});

test("prune-archive: default keep is 10 → 3 iterations, nothing to prune", () => {
  const dir = makeRepo();
  const { status, stdout } = run(dir);
  assert.equal(status, 0);
  assert.match(stdout, /nothing to prune/i);
});

test("prune-archive: --keep 0 and --keep abc exit 1 with a message", () => {
  const dir = makeRepo();
  for (const bad of ["0", "abc", "1.5", "-2"]) {
    const { status, stderr } = run(dir, ["--keep", bad]);
    assert.equal(status, 1, `--keep ${bad}`);
    assert.match(stderr, /--keep/, `--keep ${bad} must explain itself`);
  }
});

test("prune-archive: a missing archive/ dir exits 0 with 'nothing to do'", () => {
  const dir = makeRepo({ archiveDir: false });
  const { status, stdout } = run(dir, ["--keep", "1", "--apply"]);
  assert.equal(status, 0);
  assert.match(stdout, /nothing to do/i);
});
