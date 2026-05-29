// CCF freshness heuristic — shared by session-start.mjs and updatespec-nudge.mjs.
// Asks: did the CODE change more recently than the SPEC? Used ONLY to NUDGE
// (advisory), never to block. Primary signal is the git COMMITTER time of the last
// commit touching code vs spec (immune to mtime churn from checkout/pull/clone);
// falls back to a depth-limited mtime walk whenever git can't answer for either
// side (not a git repo, git missing, or a path with no commits). Single source of
// truth — DRY, don't copy.

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Directories never worth scanning for "code" — generated, vendored, or VCS/spec dirs.
// Skipping .claude keeps the code-scan from comparing the spec against itself.
const SKIP_DIRS = new Set(["node_modules", ".git", ".claude", "dist", "build", "coverage"]);
// File extensions that count as "code" — drives the mtime fallback comparison.
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|java|rb|php)$/i;
// File extensions that count as "spec" — markdown rules/docs.
const SPEC_EXT = /\.md$/i;

// git pathspecs for the committer-time probe. Globs are literal args: with
// shell:false git itself (not a shell) expands them, keeping us Windows-clean.
const CODE_PATHSPECS = [
  "*.ts", "*.tsx", "*.js", "*.mjs", "*.cjs", "*.jsx",
  "*.py", "*.go", "*.rs", "*.java", "*.rb", "*.php",
];
const SPEC_PATHSPECS = [".claude/rules/*.md", "CLAUDE.md"];

/**
 * Pure decision core: is code newer than spec? Git committer time is the primary
 * signal; a null git time means "git gave no useful answer for that side", so we
 * fall back to mtime rather than silencing the nudge. Fully unit-tested.
 * @param {{codeGit: number|null, specGit: number|null, codeMtime: number, specMtime: number}} sig
 * @returns {boolean}
 */
export function decideFreshness(sig) {
  // Git wins only when BOTH sides resolve; equal → not newer → no nudge.
  if (sig.codeGit !== null && sig.specGit !== null) {
    return sig.codeGit > sig.specGit;
  }
  // Otherwise git can't compare both sides → mtime is the universal fallback.
  return sig.codeMtime > sig.specMtime;
}

/**
 * Committer time (UNIX seconds) of the last commit touching any of `pathspecs`,
 * or null when git can't answer (not a repo, git missing, error, or no commit
 * touches the path → exit 0 with empty stdout). Best-effort, never throws.
 * @param {string} cwd directory to run git in
 * @param {string[]} pathspecs git pathspecs (literal globs; git expands them)
 * @returns {number|null}
 */
export function gitCommitTime(cwd, pathspecs) {
  try {
    const res = spawnSync(
      "git",
      ["-C", cwd, "log", "-1", "--format=%ct", "--", ...pathspecs],
      { encoding: "utf8", shell: false },
    );
    // status !== 0 covers not-a-repo / git error; empty stdout covers "no commit
    // touches this pathspec" (git exits 0 with no output). Both → null.
    if (res.error || res.status !== 0) return null;
    const out = String(res.stdout ?? "").trim();
    if (!out) return null;
    const n = Number(out);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // spawn failure (e.g. git not on PATH) → fall back to mtime
  }
}

/**
 * True if the code looks newer than the spec. Thin orchestrator: gathers both git
 * committer times AND both mtimes, then delegates to the pure `decideFreshness`.
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
  // Best-effort git committer times — null when git can't answer (→ mtime fallback).
  const codeGit = gitCommitTime(root, CODE_PATHSPECS);
  const specGit = gitCommitTime(root, SPEC_PATHSPECS);
  return decideFreshness({ codeGit, specGit, codeMtime, specMtime });
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
