#!/usr/bin/env node
// CCF worktree-preflight — a human-run CLI SCRIPT (not a hook, not a command). Task 066, step 3 of the
// worktree proposal (task-064-worktree-parallel-research.md under .claude/plan/, or archive/ once retired).
//
// Role: before the branches of a parallel wave are merged, check in CODE that nothing was mixed or
// missed. Each `worktree-ccf-<iteration>-<taskid>` branch (the name `claude -w ccf-<iteration>-<taskid>`
// creates) must map to one task file, its REAL changed files must stay inside that task's declared
// `Files to touch` plus tests, no two branches may change the same real file, and `git merge-tree
// --write-tree` must exit 0 against the integration branch and between every pair. It prints JSON and
// always exits 0; `ready: false` with a `problems` list is the blocking answer.
//
// READ-ONLY: it moves no ref, touches no index or working-tree file, and merges nothing. (`merge-tree
// --write-tree` does store the trial merge's objects in the object database; they are unreferenced and
// git's normal gc removes them.) Merging is step 4 of the proposal and stays a separate, human-run step.
//
// Usage:  node scripts/worktree-preflight.mjs [--dir <repo root>] [--into <ref>] [--branches a,b]
//         --dir defaults to $CLAUDE_PROJECT_DIR or cwd; --into defaults to HEAD; without --branches every
//         local worktree-ccf-* branch is checked. Needs git >= 2.38 (merge-tree --write-tree).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractFiles } from "../hooks/lib/slice-check.mjs";
import { taskIdFromBranch, assessPreflight } from "../hooks/lib/worktree-preflight.mjs";
import { readRuntimeEvidence } from "../hooks/lib/runtime-evidence.mjs";

const NOTE =
  "Only committed work is visible: commit inside each worktree before running this. " +
  "A ready wave still needs the full test suite after EACH merge and one /ccf:check on the merged diff, " +
  "because a textually clean merge can still be semantically wrong.";

/** @param {Record<string, any>} obj */
function done(obj) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(0);
}

/**
 * @param {string[]} argv
 * @param {string} flag
 * @returns {string | undefined}
 */
function readFlagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {{ status: number | null, stdout: string }}
 */
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, windowsHide: true });
  return { status: r.error ? null : r.status, stdout: String(r.stdout ?? "") };
}

/** @param {string} stdout */
const lines = (stdout) => stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/**
 * merge-tree's exit code is the verdict (0 clean, 1 conflict); its conflict listing is not, because the
 * git docs warn an empty list does not guarantee a clean merge.
 * @param {string} cwd
 * @param {string} a
 * @param {string} b
 * @returns {boolean | null}
 */
function mergesCleanly(cwd, a, b) {
  const r = git(cwd, ["merge-tree", "--write-tree", "--no-messages", a, b]);
  return r.status === 0 ? true : r.status === 1 ? false : null;
}

/** @param {string} versionText e.g. "git version 2.43.0" */
function gitSupportsWriteTree(versionText) {
  const m = /(\d+)\.(\d+)/.exec(versionText);
  return !!m && (Number(m[1]) > 2 || (Number(m[1]) === 2 && Number(m[2]) >= 38));
}

try {
  const argv = process.argv.slice(2);
  const dir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const into = readFlagValue(argv, "--into") ?? "HEAD";
  if (git(dir, ["rev-parse", "--is-inside-work-tree"]).status !== 0) done({ ok: false, reason: "not-a-git-repo" });

  const gitOk = gitSupportsWriteTree(git(dir, ["--version"]).stdout);
  const explicit = readFlagValue(argv, "--branches");
  const names = explicit
    ? explicit.split(",").map((s) => s.trim()).filter(Boolean)
    : lines(git(dir, ["for-each-ref", "--format=%(refname:short)", "refs/heads/worktree-ccf-*"]).stdout);

  const planDir = join(dir, ".claude", "plan");
  const planFiles = existsSync(planDir) ? readdirSync(planDir) : [];
  const branches = names.map((branch) => {
    const id = taskIdFromBranch(branch);
    const taskFile = id ? planFiles.find((f) => f.startsWith(`task-${id}-`) && f.endsWith(".md")) ?? null : null;
    const mainText = taskFile ? readFileSync(join(planDir, taskFile), "utf8") : "";
    const declared = taskFile ? extractFiles(mainText) : [];
    const branchText = taskFile ? git(dir, ["show", `${branch}:.claude/plan/${taskFile}`]) : null;
    const taskText = branchText && branchText.status === 0 ? branchText.stdout : mainText;
    const base = lines(git(dir, ["merge-base", into, branch]).stdout)[0];
    // --no-renames: a rename is listed as its deleted source AND its new path, so moving an undeclared
    // file into a declared path cannot hide the source from the scope and overlap checks.
    const actual = base ? lines(git(dir, ["diff", "--name-only", "--no-renames", base, branch]).stdout) : [];
    const mergeClean = gitOk && base ? mergesCleanly(dir, into, branch) : null;
    return { branch, id, taskFile, declared, actual, mergeClean, taskText };
  });

  /** @type {{ a: string, b: string, clean: boolean | null }[]} */
  const pairs = [];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i].branch, b = branches[j].branch;
      pairs.push({ a, b, clean: gitOk ? mergesCleanly(dir, a, b) : null });
    }
  }

  const verdict = assessPreflight({ gitOk, branches, pairs });
  const report = branches.map(({ taskText, ...b }) => ({ ...b, runtimeEvidence: readRuntimeEvidence(taskText) }));
  done({ ok: true, ready: verdict.ready, into, branches: report, pairs, problems: verdict.problems, note: NOTE });
} catch {
  done({ ok: false, reason: "error" });
}
