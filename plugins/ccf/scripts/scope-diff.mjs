#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findInReviewTask, findActiveTask } from "../hooks/lib/plan.mjs";
import { assessScope } from "../hooks/lib/scope-diff.mjs";

const done = (result = {}) => {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
};

const readFlagValue = (argv = [""], flag = "") => {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};

const git = (cwd = "", args = [""]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, windowsHide: true });
  return { ok: !r.error && r.status === 0, stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? r.error?.message ?? "").trim() };
};

const lines = (stdout = "") => stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const findBase = (dir = "", explicit = "") => {
  const candidates = explicit ? [explicit] : ["main", "master", "origin/main", "origin/master"];
  return candidates.find((ref) => git(dir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).ok) ?? null;
};

const findTaskFile = (dir = "") => {
  const planDir = join(dir, ".claude", "plan");
  const planFile = join(planDir, "PLAN.md");
  const task = findInReviewTask(planFile) ?? findActiveTask(planFile);
  if (!task || !existsSync(planDir)) return null;
  const name = readdirSync(planDir).find((f) => f.startsWith(`task-${task.id}-`) && f.endsWith(".md"));
  return name ? `.claude/plan/${name}` : null;
};

try {
  const argv = process.argv.slice(2);
  const dir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const inside = git(dir, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok) done({ ok: false, reason: "git-error", detail: inside.stderr });

  const base = findBase(dir, readFlagValue(argv, "--base") ?? "");
  if (!base) done({ ok: false, reason: "no-base", detail: "none of main, master, origin/main, origin/master resolves; pass --base <ref>" });
  const mergeBase = git(dir, ["merge-base", String(base), "HEAD"]);
  if (!mergeBase.ok) done({ ok: false, reason: "git-error", base, detail: mergeBase.stderr });

  const committed = git(dir, ["diff", "--name-only", "--no-renames", lines(mergeBase.stdout)[0], "HEAD"]);
  const uncommitted = git(dir, ["diff", "--name-only", "--no-renames", "HEAD"]);
  const untracked = git(dir, ["ls-files", "--others", "--exclude-standard"]);
  if (!committed.ok || !uncommitted.ok || !untracked.ok) {
    done({ ok: false, reason: "git-error", base, detail: [committed, uncommitted, untracked].map((r) => r.stderr).filter(Boolean).join("; ") });
  }
  const changed = [...new Set([...lines(committed.stdout), ...lines(uncommitted.stdout), ...lines(untracked.stdout)])];

  const taskFile = readFlagValue(argv, "--task") ?? findTaskFile(dir);
  if (!taskFile) done({ ok: false, reason: "no-task", base, changed });
  const taskPath = join(dir, String(taskFile));
  if (!existsSync(taskPath)) done({ ok: false, reason: "no-task", base, changed, taskFile });

  const scope = assessScope({ changed, taskText: readFileSync(taskPath, "utf8"), taskFile: String(taskFile) });
  done({ ok: true, base, taskFile, changed, ...scope });
} catch (error) {
  done({ ok: false, reason: "error", detail: String(error instanceof Error ? error.message : error) });
}
