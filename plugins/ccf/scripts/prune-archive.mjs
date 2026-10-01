#!/usr/bin/env node
// CCF prune-archive — a CLI SCRIPT, not a hook and not a command.
//
// Role: delete the task files under `.claude/plan/archive/` that belong to an archived iteration
// older than the newest N (default 10) in `.claude/plan/ARCHIVE.md`. ARCHIVE.md itself and git
// history stay the permanent record; only the per-task files of old iterations go.
//
// WHY A SCRIPT AND NOT A HOOK: deleting files is a mutation, so a human runs it. The paired hook,
// `hooks/updatespec-nudge.mjs` clause (E), only DETECTS (via the same `findPrunableTaskFilesIn`) and
// prints this command. Same detection/action split as archive-plan.mjs.
//
// Usage (default is read-only):
//   node scripts/prune-archive.mjs             → list what WOULD be pruned and the orphans, write nothing
//   node scripts/prune-archive.mjs --apply     → `git rm` each prunable file (staged, never committed)
//   ... --keep <N>                             → keep the task files of the newest N iterations (default 10, N >= 1)
//   ... --dir <path>                           → project root (default: $CLAUDE_PROJECT_DIR or cwd)
//   ... --no-git                               → delete with fs.rmSync instead of `git rm`
//
// Orphans (a task file whose id no archived iteration lists) are always kept and only reported.
// A file git refuses to remove (untracked, locally modified) is skipped and reported, never forced.
// Exit codes: 0 = success (including "nothing to do"), 1 = a real failure (bad --keep value).

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findPrunableTaskFilesIn } from "../hooks/lib/archive.mjs";

const DEFAULT_KEEP = 10;

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const useGit = !argv.includes("--no-git");
const projectDir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const keep = parseKeep(argv);
if (keep === null) {
  console.error("CCF prune-archive: --keep needs a whole number of iterations, 1 or more (e.g. --keep 10).");
  process.exit(1);
}

const planDir = join(projectDir, ".claude", "plan");
const archiveDir = join(planDir, "archive");

if (!existsSync(join(planDir, "ARCHIVE.md")) || !existsSync(archiveDir)) {
  console.log(`CCF prune-archive: no ARCHIVE.md or archive/ under ${planDir} — nothing to do.`);
  process.exit(0);
}

const { prune, orphans } = findPrunableTaskFilesIn(planDir, keep);

console.log(`CCF prune-archive: keeping the task files of the newest ${keep} iteration(s) in ARCHIVE.md\n`);
for (const name of prune) console.log(`  prune   ${name}`);
for (const name of orphans) console.log(`  orphan  ${name} (no archived iteration lists this id; kept)`);
console.log(`\n${prune.length} file(s) to prune, ${orphans.length} orphan(s).`);

if (prune.length === 0) {
  console.log("Nothing to prune.");
  process.exit(0);
}

if (!apply) {
  console.log("Re-run with --apply to remove them.");
  process.exit(0);
}

// --- apply ---------------------------------------------------------------------------------------
let removed = 0;
for (const name of prune) {
  const reason = removeOne(join(archiveDir, name));
  if (reason === null) {
    removed += 1;
    console.log(`  removed ${name}`);
  } else {
    console.error(`  ! skipped ${name} — ${reason}`);
  }
}

console.log(`\nDone — ${removed} of ${prune.length} file(s) removed.`);
if (useGit) console.log("Deletions are staged in git; nothing was committed.");
process.exit(0);

// --- helpers -------------------------------------------------------------------------------------

/**
 * Remove one file. With git, `git rm -q` WITHOUT `-f`, so git itself refuses an untracked or
 * locally modified file and the work in it survives; that refusal is reported, not overridden.
 * @param {string} file absolute path
 * @returns {string | null} null on success, else the reason it was skipped
 */
function removeOne(file) {
  if (useGit) {
    // shell:false — the path is an argv entry, never interpolated into a shell string.
    const res = spawnSync("git", ["rm", "-q", "--", file], { cwd: projectDir, encoding: "utf8", shell: false });
    if (res.status === 0) return null;
    return firstLine(res.stderr) || (res.error ? describe(res.error) : `git rm exited ${res.status}`);
  }
  try {
    rmSync(file);
    return null;
  } catch (err) {
    return describe(err);
  }
}

/**
 * The `--keep` value: absent → DEFAULT_KEEP; a positive integer → that; anything else → null.
 * @param {string[]} args argv slice
 * @returns {number | null}
 */
function parseKeep(args) {
  if (!args.includes("--keep")) return DEFAULT_KEEP;
  const i = args.indexOf("--keep");
  const raw = i + 1 < args.length ? args[i + 1] : "";
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

/**
 * Value of a `--flag value` pair, or null when the flag is absent or has no value after it.
 * @param {string[]} args argv slice
 * @param {string} flag e.g. "--dir"
 * @returns {string | null}
 */
function readFlagValue(args, flag) {
  const i = args.indexOf(flag);
  if (i < 0 || i + 1 >= args.length) return null;
  const value = args[i + 1];
  return value.startsWith("--") ? null : value;
}

/**
 * First non-empty line of a process's stderr, trimmed.
 * @param {string | null | undefined} text
 * @returns {string}
 */
function firstLine(text) {
  return (String(text ?? "").split(/\r?\n/).find((line) => line.trim() !== "") ?? "").trim();
}

/**
 * Human-readable message for an unknown thrown value (catch clauses are `unknown` under strict).
 * @param {unknown} err
 * @returns {string}
 */
function describe(err) {
  return err instanceof Error ? err.message : String(err);
}
