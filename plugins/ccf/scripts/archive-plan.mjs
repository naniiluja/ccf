#!/usr/bin/env node
// CCF archive-plan — a CLI SCRIPT, not a hook and not a command.
//
// Role: retire every fully-closed iteration out of `.claude/plan/PLAN.md` into
// `.claude/plan/ARCHIVE.md`, moving its task files into `.claude/plan/archive/`. This is the
// deterministic half of the retirement step described in `commands/updatespec.md` step 6.
//
// WHY A SCRIPT AND NOT A HOOK: the work is a set of FILE WRITES plus a `git mv`. A hook fires
// automatically with no human in the loop, so a wrong detection there would silently rewrite the
// project's plan and history. So the split is: `hooks/updatespec-nudge.mjs` clause (D) DETECTS and
// nudges (deterministic, harmless), and this script MUTATES only when a human runs it. Same
// detection/action split as `architecture.md`'s "Deterministic part vs prompt part".
//
// Usage (default is read-only):
//   node scripts/archive-plan.mjs            → report what WOULD be retired, write nothing
//   node scripts/archive-plan.mjs --check    → same as above, explicit
//   node scripts/archive-plan.mjs --apply    → perform the retirement
//   ... --dir <path>                         → project root (default: $CLAUDE_PROJECT_DIR or cwd)
//   ... --no-git                             → move task files with fs.rename instead of `git mv`
//
// Exit codes: 0 = success (including "nothing to do"), 1 = a real failure (unreadable/unwritable
// file). Never partially destructive: ARCHIVE.md is written BEFORE PLAN.md is trimmed, so a crash
// in between leaves the history duplicated (recoverable) rather than deleted (not).

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseIterations, isRetirable, retirePlan, insertIntoArchive } from "../hooks/lib/archive.mjs";
import { isClosedStatus } from "../hooks/lib/plan.mjs";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const useGit = !argv.includes("--no-git");
const projectDir = readFlagValue(argv, "--dir") ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

const planDir = join(projectDir, ".claude", "plan");
const planFile = join(planDir, "PLAN.md");
const archiveFile = join(planDir, "ARCHIVE.md");
const archiveDir = join(planDir, "archive");

if (!existsSync(planFile)) {
  console.log(`CCF archive-plan: no plan at ${planFile} — nothing to do.`);
  process.exit(0);
}

let planLines;
try {
  planLines = readFileSync(planFile, "utf8").split(/\r?\n/);
} catch (err) {
  console.error(`CCF archive-plan: cannot read ${planFile} — ${describe(err)}`);
  process.exit(1);
}

const iterations = parseIterations(planLines);
if (iterations.length === 0) {
  console.log(`CCF archive-plan: ${planFile} has no '## Origin' iteration heading — nothing to do.`);
  process.exit(0);
}

// Report every iteration, retirable or not: naming the rows that still hold an iteration open is
// the whole reason someone runs --check.
console.log(`CCF archive-plan: ${iterations.length} iteration(s) in PLAN.md\n`);
for (const it of iterations) {
  const open = it.rows.filter((row) => !isClosedStatus(row.status));
  if (isRetirable(it)) {
    console.log(`  RETIRABLE  ${truncate(it.heading)}`);
    console.log(`             ${it.rows.length} task(s), all closed`);
  } else if (it.rows.length === 0) {
    console.log(`  open       ${truncate(it.heading)}`);
    console.log(`             no task rows yet — never retired automatically`);
  } else {
    console.log(`  open       ${truncate(it.heading)}`);
    console.log(`             ${open.length} of ${it.rows.length} task(s) still open: ${open.map((r) => `${r.id} (${r.status})`).join(", ")}`);
  }
}

const retirableCount = iterations.filter(isRetirable).length;
if (retirableCount === 0) {
  console.log("\nNothing is fully closed yet — no retirement needed.");
  process.exit(0);
}

if (!apply) {
  console.log(`\n${retirableCount} iteration(s) ready to retire. Re-run with --apply to perform it.`);
  process.exit(0);
}

// --- apply ---------------------------------------------------------------------------------------
// Retire from the BOTTOM of the file upwards (oldest first, since this project writes newest-first).
// Each entry is inserted at the top of the archive, so processing oldest→newest leaves the archive
// in newest-first order. Re-parse after every retirement because the line indexes shift.
let retired = 0;
for (;;) {
  const current = parseIterations(planLines);
  const target = [...current].reverse().find(isRetirable);
  if (!target) break;

  const { planText, archiveEntry, taskIds } = retirePlan(planLines, target);

  // ARCHIVE FIRST, PLAN SECOND — see the header note on the failure direction.
  const existingArchive = existsSync(archiveFile) ? safeRead(archiveFile) : "";
  if (existingArchive === null) process.exit(1);
  if (!safeWrite(archiveFile, insertIntoArchive(existingArchive, archiveEntry))) process.exit(1);
  if (!safeWrite(planFile, planText)) process.exit(1);

  planLines = planText.split(/\r?\n/);
  retired += 1;
  console.log(`\nRetired: ${truncate(target.heading)}`);
  moveTaskFiles(taskIds);
}

console.log(`\nDone — ${retired} iteration(s) retired into ${archiveFile}.`);
console.log("Next: trim CLAUDE.md's '## Current plan' to the iteration now in flight.");
if (useGit) console.log("Moved task files are staged in git; nothing was committed.");
process.exit(0);

// --- helpers -------------------------------------------------------------------------------------

/**
 * Move each retired task's file into `.claude/plan/archive/`, preferring `git mv` so the rename is
 * recorded and staged (what `updatespec.md` step 6 prescribes), falling back to a plain fs rename
 * when git is unavailable, the project is not a repo, or `--no-git` was passed. Best-effort per
 * file: a failure is reported and skipped rather than aborting an already-written retirement.
 * @param {string[]} taskIds ids from retirePlan().taskIds
 * @returns {void}
 */
function moveTaskFiles(taskIds) {
  if (taskIds.length === 0) return;
  try {
    mkdirSync(archiveDir, { recursive: true });
  } catch (err) {
    console.error(`  ! cannot create ${archiveDir} — ${describe(err)}; task files left in place`);
    return;
  }
  /** @type {string[]} */
  let entries;
  try {
    entries = readdirSync(planDir);
  } catch (err) {
    console.error(`  ! cannot list ${planDir} — ${describe(err)}; task files left in place`);
    return;
  }
  for (const id of taskIds) {
    const matches = entries.filter((name) => name.startsWith(`task-${id}-`) && name.endsWith(".md"));
    if (matches.length === 0) {
      console.log(`  - task ${id}: no task-${id}-*.md file found (nothing to move)`);
      continue;
    }
    for (const name of matches) {
      const from = join(planDir, name);
      const to = join(archiveDir, name);
      if (existsSync(to)) {
        console.error(`  ! ${name} already exists in archive/ — left in place, resolve by hand`);
        continue;
      }
      if (moveOne(from, to)) console.log(`  - moved ${name} → archive/`);
      else console.error(`  ! could not move ${name} — left in place`);
    }
  }
}

/**
 * Move one file, via `git mv` when allowed and possible, else `fs.renameSync`.
 * @param {string} from absolute source path
 * @param {string} to absolute destination path
 * @returns {boolean} true when the file now lives at `to`
 */
function moveOne(from, to) {
  if (useGit) {
    // shell:false — paths are passed as argv entries, never interpolated into a shell string.
    const res = spawnSync("git", ["mv", from, to], { cwd: projectDir, encoding: "utf8", shell: false });
    if (res.status === 0) return true;
  }
  try {
    renameSync(from, to);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file, reporting and returning null on failure (so the caller can exit cleanly).
 * @param {string} file
 * @returns {string | null}
 */
function safeRead(file) {
  try {
    return readFileSync(file, "utf8");
  } catch (err) {
    console.error(`CCF archive-plan: cannot read ${file} — ${describe(err)}`);
    return null;
  }
}

/**
 * Write a file, reporting on failure.
 * @param {string} file
 * @param {string} content
 * @returns {boolean} true on success
 */
function safeWrite(file, content) {
  try {
    writeFileSync(file, content, "utf8");
    return true;
  } catch (err) {
    console.error(`CCF archive-plan: cannot write ${file} — ${describe(err)}`);
    return false;
  }
}

/**
 * Value of a `--flag value` pair, or null when the flag is absent or has no value after it.
 * @param {string[] } args argv slice
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
 * Shorten a heading for one-line console output.
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
function truncate(text, max = 96) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Human-readable message for an unknown thrown value (catch clauses are `unknown` under strict).
 * @param {unknown} err
 * @returns {string}
 */
function describe(err) {
  return err instanceof Error ? err.message : String(err);
}
