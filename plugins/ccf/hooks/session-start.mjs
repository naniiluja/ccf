#!/usr/bin/env node
// CCF session-start hook — inject the context-first reminder + a freshness signal.
// Matcher: startup|clear|compact (re-inject after compact/clear).
// The recovery half of the compact-aware mechanism: after compact, re-load the in-progress task from PLAN.md.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitContext } from "./lib/io.mjs";

// Directories never worth scanning for "code" — generated, vendored, or VCS/spec dirs.
// Skipping .claude keeps the code-scan from comparing the spec against itself.
const SKIP_DIRS = new Set(["node_modules", ".git", ".claude", "dist", "build", "coverage"]);
// File extensions that count as "code" — drives the freshness comparison.
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|java|rb|php)$/i;
// File extensions that count as "spec" — markdown rules/docs.
const SPEC_EXT = /\.md$/i;

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
 * Lightweight heuristic — only for nudging, not a hard conclusion. Walks the project tree
 * (depth-limited) instead of assuming a fixed src/ layout, so it works for any project shape.
 * @param {string} root
 * @param {string} rules
 */
function specsOlderThanCode(root, rules) {
  if (!existsSync(rules)) return false;
  const specMtime = newestMtime(rules, 1, SPEC_EXT);
  if (specMtime === 0) return false;
  // Shallow-walk the whole repo for code files (any layout), skipping generated/vendored dirs.
  // Depth 3 reaches nested layouts (packages/x/src, plugins/x/hooks) while staying cheap.
  const codeMtime = newestMtime(root, 3, CODE_EXT);
  return codeMtime > specMtime;
}

/**
 * Largest mtime of files matching `match` in the tree, depth-limited to stay cheap.
 * @param {string} dir
 * @param {number} depth remaining recursion allowance
 * @param {RegExp} match only files whose name matches are counted
 * @returns {number}
 */
function newestMtime(dir, depth, match) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    try {
      if (e.isDirectory()) {
        if (depth > 0) newest = Math.max(newest, newestMtime(full, depth - 1, match));
      } else if (match.test(e.name)) {
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
