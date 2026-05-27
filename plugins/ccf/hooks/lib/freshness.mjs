// CCF freshness heuristic — shared by session-start.mjs and updatespec-nudge.mjs.
// Lightweight mtime comparison (NOT a content diff) used only to NUDGE: is the code
// newer than the spec? Walks the project tree depth-limited so it works for ANY layout,
// instead of assuming a fixed src/ shape. Single source of truth — DRY, don't copy.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Directories never worth scanning for "code" — generated, vendored, or VCS/spec dirs.
// Skipping .claude keeps the code-scan from comparing the spec against itself.
const SKIP_DIRS = new Set(["node_modules", ".git", ".claude", "dist", "build", "coverage"]);
// File extensions that count as "code" — drives the freshness comparison.
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|java|rb|php)$/i;
// File extensions that count as "spec" — markdown rules/docs.
const SPEC_EXT = /\.md$/i;

/**
 * True if some code file is newer than the newest spec file (.md in .claude/rules).
 * Lightweight heuristic — only for nudging, not a hard conclusion.
 * @param {string} root project root (cwd)
 * @param {string} rules path to .claude/rules
 * @returns {boolean}
 */
export function specsOlderThanCode(root, rules) {
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
export function newestMtime(dir, depth, match) {
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
