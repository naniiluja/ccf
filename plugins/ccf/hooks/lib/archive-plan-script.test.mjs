import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "archive-plan.mjs");
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_NOSYSTEM: "1", HOME: tmpdir(),
};
delete GIT_ENV.CLAUDE_PROJECT_DIR;

const STAGED_MOVE = "R100\t.claude/plan/task-001-a.md\t.claude/plan/archive/task-001-a.md";

const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "ccf-archive-plan-"));
  dirs.push(dir);
  const planDir = join(dir, ".claude", "plan");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(
    join(planDir, "PLAN.md"),
    "# Plan\n\n## Origin: only one\n\n| # | Slice | Status |\n|---|---|---|\n| 001 | s | done |\n",
  );
  writeFileSync(join(planDir, "task-001-a.md"), "# task 001\n");
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "base"]);
  return dir;
}

function spawnScript(args, { cwd, env = GIT_ENV } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env, encoding: "utf8", shell: false });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function assertStagedMove(dir) {
  assert.ok(existsSync(join(dir, ".claude", "plan", "archive", "task-001-a.md")), "task file moved");
  assert.equal(git(dir, ["diff", "--cached", "--name-status", "-M"]).trim(), STAGED_MOVE);
}

test("archive-plan --apply: an absolute --dir stages the task file move", () => {
  const dir = makeRepo();
  const { status, stdout, stderr } = spawnScript(["--dir", dir, "--apply"]);
  assert.equal(status, 0, stdout + stderr);
  assertStagedMove(dir);
});

test("archive-plan --apply: a RELATIVE --dir stages the same move (not a silent unstaged rename)", () => {
  const dir = makeRepo();
  const { status, stdout, stderr } = spawnScript(["--dir", basename(dir), "--apply"], { cwd: dirname(dir) });
  assert.equal(status, 0, stdout + stderr);
  assertStagedMove(dir);
});

test("archive-plan --apply: a relative CLAUDE_PROJECT_DIR is resolved too", () => {
  const dir = makeRepo();
  const env = { ...GIT_ENV, CLAUDE_PROJECT_DIR: basename(dir) };
  const { status, stdout, stderr } = spawnScript(["--apply"], { cwd: dirname(dir), env });
  assert.equal(status, 0, stdout + stderr);
  assertStagedMove(dir);
});

test("archive-plan --apply: no --dir and no env falls back to cwd", () => {
  const dir = makeRepo();
  const { status, stdout, stderr } = spawnScript(["--apply"], { cwd: dir });
  assert.equal(status, 0, stdout + stderr);
  assertStagedMove(dir);
});
