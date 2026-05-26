#!/usr/bin/env node
// CCF session-start hook — inject the context-first reminder + a freshness signal.
// Matcher: startup|clear|compact (re-inject after compact/clear).
// The recovery half of the compact-aware mechanism: after compact, re-load the in-progress task from PLAN.md.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";

const input = await readStdinJson();
const cwd = String(input.cwd ?? process.cwd());
const source = String(input.source ?? "");

const planDir = join(cwd, ".claude", "plan");
const planFile = join(planDir, "PLAN.md");
const rulesDir = join(cwd, ".claude", "rules");
const hasClaudeMd = existsSync(join(cwd, "CLAUDE.md"));
const managed = existsSync(planDir) || hasClaudeMd;

let msg =
  "<ccf>This project follows the CCF (Claude Context First) workflow: context-first, spec-driven, " +
  "STRICTLY SEQUENTIAL (one task at a time, no parallel feature development). " +
  "Ground every design decision in Context7 + Microsoft Learn. Keep CLAUDE.md/.claude always fresh.";

if (!managed) {
  msg += " This project is NOT yet CCF-initialized — run /ccf:ccf-init to start.</ccf>";
  emitContext("SessionStart", msg);
}

// --- Already CCF-managed ---

// Freshness signal: spec older than code → nudge updatespec.
if (specsOlderThanCode(cwd, rulesDir)) {
  msg +=
    " The spec looks older than the code — consider running /ccf:ccf-updatespec to refresh context.";
}

// Re-load the in-progress task after compact/clear.
if (source === "compact" || source === "clear") {
  const task = findInProgressTask(planFile);
  if (task) {
    msg +=
      ` You were mid-way through task ${task.id}: ${task.title}.` +
      ` Read .claude/plan/ (task ${task.id}) to resume exactly where you left off instead of re-reading everything.`;
  }
}

msg += "</ccf>";
emitContext("SessionStart", msg);

// ----------------------------------------------------------------------------

/**
 * Compare the newest mtime of source files vs .claude/rules. True if code is newer than spec.
 * Lightweight heuristic — only for nudging, not a hard conclusion.
 * @param {string} root
 * @param {string} rules
 */
function specsOlderThanCode(root, rules) {
  if (!existsSync(rules)) return false;
  const specMtime = newestMtime(rules, 0);
  if (specMtime === 0) return false;
  // Shallow-scan common source directories to avoid walking the whole repo.
  const srcDirs = ["src", "be", "fe", "app", "lib", "packages"].map((d) => join(root, d));
  let codeMtime = 0;
  for (const d of srcDirs) {
    if (existsSync(d)) codeMtime = Math.max(codeMtime, newestMtime(d, 2));
  }
  return codeMtime > specMtime;
}

/**
 * Largest mtime of .md/.ts/.js... files in the tree, depth-limited to stay cheap.
 * @param {string} dir
 * @param {number} depth remaining recursion allowance
 * @returns {number}
 */
function newestMtime(dir, depth) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = join(dir, e.name);
    try {
      if (e.isDirectory()) {
        if (depth > 0) newest = Math.max(newest, newestMtime(full, depth - 1));
      } else {
        newest = Math.max(newest, statSync(full).mtimeMs);
      }
    } catch {
      // skip unreadable files
    }
  }
  return newest;
}

/**
 * Find the first task with status "in-progress" in PLAN.md's task table.
 * Row format: | 001 | Slice title | layers | gate | — | in-progress |
 * (Only cells[0]=id and cells[1]=title are read, so extra columns are harmless.)
 * @param {string} file
 * @returns {{ id: string, title: string } | null}
 */
function findInProgressTask(file) {
  if (!existsSync(file)) return null;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  for (const line of content.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    if (!/in[-\s]?progress/i.test(line)) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length >= 2) {
      return { id: cells[0], title: cells[1] };
    }
  }
  return null;
}
