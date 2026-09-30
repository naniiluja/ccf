import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts");
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_NOSYSTEM: "1", HOME: tmpdir(), TYPESAFE_API_KEY: "",
};

const dirs = [];
test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(dir, files) {
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
}

const TASK = (id, file, dep = "—") =>
  `# Task ${id}\n\n- **Depends on:** ${dep}\n\n## Acceptance criteria\n- [ ] works\n\n## Files to touch\n- ${file}\n`;

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "ccf-wave-"));
  dirs.push(dir);
  git(dir, ["init", "-q", "-b", "main"]);
  write(dir, {
    ".gitignore": ".claude/worktrees/\n",
    ".claude/plan/PLAN.md": "## Origin: Wave Test\n\n| # | Slice | Status |\n|---|---|---|\n| 101 | a | todo |\n| 102 | b | todo |\n| 103 | c | todo |\n",
    ".claude/plan/task-101-a.md": TASK("101", "src/a.js"),
    ".claude/plan/task-102-b.md": TASK("102", "src/b.js"),
    ".claude/plan/task-103-c.md": TASK("103", "src/c.js", "101"),
    "check.mjs": "import { readFileSync, existsSync } from 'node:fs';\nif (existsSync('src/b.js') && readFileSync('src/b.js', 'utf8').includes('broken')) process.exit(1);\n",
  });
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "-m", "base"]);
  return dir;
}

function worktreeWith(dir, branch, files) {
  const path = join(dir, ".claude", "worktrees", branch);
  git(dir, ["worktree", "add", "-q", "-b", branch, path, "main"]);
  write(path, files);
  git(path, ["add", "-A"]);
  git(path, ["commit", "-q", "-m", branch]);
  return path;
}

function run(script, dir, extra = []) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), "--dir", dir, ...extra], { cwd: dir, env: GIT_ENV, encoding: "utf8", shell: false });
  return { status: r.status, out: JSON.parse(r.stdout || "{}") };
}

test("plan-waves: offline, disjoint tasks share a wave, a declared Depends on waits, worktree names carry the task id", () => {
  const dir = makeRepo();
  const r = run("plan-waves.mjs", dir);
  assert.equal(r.status, 0);
  assert.equal(r.out.ok, true);
  assert.equal(r.out.jev, "not-asked");
  assert.equal(r.out.iteration, "wave-test");
  assert.deepEqual(r.out.waves.map((w) => w.map((t) => t.id)), [["101", "102"], ["103"]]);
  assert.deepEqual(r.out.waves[0].map((t) => t.branch), ["worktree-ccf-wave-test-101", "worktree-ccf-wave-test-102"]);
  assert.equal(run("plan-waves.mjs", dir, ["--jev"]).out.jev, "no-key");
});

test("plan-waves: no PLAN.md → a reason, exit 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-wave-empty-"));
  dirs.push(dir);
  const r = run("plan-waves.mjs", dir);
  assert.equal(r.status, 0);
  assert.equal(r.out.reason, "no-plan");
});

test("integrate-wave: preview merges nothing; --apply merges each branch --no-ff, tests pass, worktrees and branches are removed", () => {
  const dir = makeRepo();
  const a = worktreeWith(dir, "worktree-ccf-wave-test-101", { "src/a.js": "a\n" });
  const b = worktreeWith(dir, "worktree-ccf-wave-test-102", { "src/b.js": "b\n" });
  const head = git(dir, ["rev-parse", "HEAD"]);
  const preview = run("integrate-wave.mjs", dir);
  assert.equal(preview.out.ok, true);
  assert.equal(preview.out.applied, false);
  assert.equal(git(dir, ["rev-parse", "HEAD"]), head);

  const r = run("integrate-wave.mjs", dir, ["--apply", "--test", "node check.mjs"]);
  assert.equal(r.out.ok, true, JSON.stringify(r.out));
  assert.deepEqual(r.out.merged.map((m) => m.branch), ["worktree-ccf-wave-test-101", "worktree-ccf-wave-test-102"]);
  assert.deepEqual(r.out.removed, ["worktree-ccf-wave-test-101", "worktree-ccf-wave-test-102"]);
  assert.equal(git(dir, ["rev-list", "--merges", "--count", `${head}..HEAD`]), "2");
  assert.ok(!existsSync(a) && !existsSync(b));
  assert.equal(git(dir, ["branch", "--list", "worktree-ccf-*"]), "");
});

test("integrate-wave: a red test on the merged result resets to the last green merge and keeps every worktree", () => {
  const dir = makeRepo();
  worktreeWith(dir, "worktree-ccf-wave-test-101", { "src/a.js": "a\n" });
  const b = worktreeWith(dir, "worktree-ccf-wave-test-102", { "src/b.js": "broken\n" });
  const r = run("integrate-wave.mjs", dir, ["--apply", "--test", "node check.mjs"]);
  assert.equal(r.out.ok, false);
  assert.deepEqual(r.out.failed.branch, "worktree-ccf-wave-test-102");
  assert.equal(r.out.failed.stage, "test");
  assert.deepEqual(r.out.merged.map((m) => m.branch), ["worktree-ccf-wave-test-101"]);
  assert.equal(git(dir, ["rev-parse", "HEAD"]), r.out.merged[0].mergeSha);
  assert.ok(existsSync(b));
  assert.equal(git(dir, ["status", "--porcelain", "--untracked-files=no"]), "");
});

test("integrate-wave: the preflight gate blocks --apply (out-of-scope file), and --apply without a test command or on a dirty tree is refused", () => {
  const dir = makeRepo();
  worktreeWith(dir, "worktree-ccf-wave-test-101", { "src/a.js": "a\n", "src/extra.js": "x\n" });
  const head = git(dir, ["rev-parse", "HEAD"]);
  const blocked = run("integrate-wave.mjs", dir, ["--apply", "--test", "node check.mjs"]);
  assert.equal(blocked.out.applied, false);
  assert.deepEqual(blocked.out.blockers, ["preflight-not-ready"]);
  assert.equal(git(dir, ["rev-parse", "HEAD"]), head);

  const clean = makeRepo();
  worktreeWith(clean, "worktree-ccf-wave-test-101", { "src/a.js": "a\n" });
  assert.deepEqual(run("integrate-wave.mjs", clean, ["--apply"]).out.blockers, ["no-test-command"]);
  write(clean, { "check.mjs": "// edited\n" });
  assert.deepEqual(run("integrate-wave.mjs", clean, ["--apply", "--test", "node check.mjs"]).out.blockers, ["dirty-tree"]);
});
