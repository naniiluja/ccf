#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyBlockers, tail, worktreesByBranch } from "../hooks/lib/worktree-wave.mjs";

const PREFLIGHT = join(dirname(fileURLToPath(import.meta.url)), "worktree-preflight.mjs");

function done(obj = {}) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(0);
}

function readFlagValue(argv = [""], flag = "") {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

function git(cwd = "", args = [""]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, windowsHide: true });
  return { status: r.error ? null : r.status, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? "") };
}

function runPreflight(dir = "", branches = "") {
  const args = [PREFLIGHT, "--dir", dir, "--into", "HEAD", ...(branches ? ["--branches", branches] : [])];
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", shell: false, windowsHide: true });
  try {
    return JSON.parse(String(r.stdout ?? ""));
  } catch {
    return { ok: false, reason: "preflight-unreadable" };
  }
}

function runTests(dir = "", command = "") {
  const r = spawnSync(command, { cwd: dir, encoding: "utf8", shell: true, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { passed: !r.error && r.status === 0, output: tail(`${r.stdout ?? ""}${r.stderr ?? ""}`) };
}

function cleanUp(dir = "", merged = [""]) {
  const paths = worktreesByBranch(git(dir, ["worktree", "list", "--porcelain"]).stdout);
  const removed = [];
  const kept = [];
  for (const branch of merged) {
    if (git(dir, ["merge-base", "--is-ancestor", branch, "HEAD"]).status !== 0) {
      kept.push({ branch, reason: "not-an-ancestor-of-HEAD" });
      continue;
    }
    const path = paths.get(branch);
    if (path) {
      const r = git(dir, ["worktree", "remove", path]);
      if (r.status !== 0) {
        kept.push({ branch, reason: `worktree-remove-refused: ${r.stderr.trim()}` });
        continue;
      }
    }
    const d = git(dir, ["branch", "-d", branch]);
    if (d.status !== 0) kept.push({ branch, reason: `branch-delete-refused: ${d.stderr.trim()}` });
    else removed.push(branch);
  }
  return { removed, kept };
}

try {
  const argv = process.argv.slice(2);
  const dir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const apply = argv.includes("--apply");
  const testCommand = readFlagValue(argv, "--test") ?? "";
  if (git(dir, ["rev-parse", "--is-inside-work-tree"]).status !== 0) done({ ok: false, reason: "not-a-git-repo" });

  const preflight = runPreflight(dir, readFlagValue(argv, "--branches"));
  const order = Array.isArray(preflight?.branches) ? preflight.branches.map(({ branch = "" }) => String(branch)) : [];
  const cleanTree = git(dir, ["status", "--porcelain", "--untracked-files=no"]).stdout.trim() === "";
  const blockers = applyBlockers({ preflight, cleanTree, testCommand, apply });
  if (!apply || blockers.length) done({ ok: blockers.length === 0, applied: false, blockers, order, preflight });

  const start = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
  const merged = [];
  for (const branch of order) {
    const before = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
    const m = git(dir, ["merge", "--no-ff", "--no-edit", "-m", `merge ${branch} (ccf wave)`, branch]);
    if (m.status !== 0) {
      git(dir, ["merge", "--abort"]);
      done({ ok: false, applied: merged.length > 0, start, merged, failed: { branch, stage: "merge", output: tail(m.stdout + m.stderr) }, note: "Worktrees kept; later branches were not merged." });
    }
    const t = runTests(dir, testCommand);
    if (!t.passed) {
      git(dir, ["reset", "--hard", before]);
      done({ ok: false, applied: merged.length > 0, start, merged, failed: { branch, stage: "test", output: t.output }, note: `HEAD reset to ${before}, the last green merge. Worktrees kept; later branches were not merged.` });
    }
    merged.push({ branch, mergeSha: git(dir, ["rev-parse", "HEAD"]).stdout.trim() });
  }
  const { removed, kept } = cleanUp(dir, merged.map((m) => m.branch));
  done({ ok: true, applied: true, start, merged, removed, kept });
} catch {
  done({ ok: false, reason: "error" });
}
