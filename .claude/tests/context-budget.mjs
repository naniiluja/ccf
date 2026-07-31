// Pure helpers for the ccf-budget self-consistency test — REPO scope, not shipped with the plugin
// (see context-budget.test.mjs's header comment for why this suite lives outside plugins/ccf/**).
//
// The design goal (task 049) is to eliminate the fixpoint trap a naive version of this test would
// create: if the test asserted a byte total against a number written in CLAUDE.md's own prose, then
// fixing a wrong number would BE the edit that makes the test pass, not a real measurement. Instead:
//   - `.claude/rules/prompt-standard.md` carries the ONE machine-readable claim, a
//     `<!-- ccf-budget: paid=NNNNN -->` label.
//   - That file is itself EXCLUDED from the "paid" total it labels (it has `paths:` and is not
//     `@import`-ed from CLAUDE.md), so editing the label never moves the number it is checked against.
//
// Every function here takes `root` as a parameter and does no path resolution of its own — the
// caller (context-budget.test.mjs) decides whether `root` is the real repo or a throwaway copy.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BUDGET_LABEL_RE = /<!--\s*ccf-budget:\s*paid=(\d+)\s*-->/;
const BUDGET_LABEL_RE_GLOBAL = new RegExp(BUDGET_LABEL_RE.source, "g");
// Matches CLAUDE.md's own invariant sentence, e.g. "< 200 lines AND < 12KB, whichever binds first".
const THRESHOLD_RE = /<\s*(\d+)\s+lines\s+AND\s*<\s*(\d+)\s*KB/i;
const CCF_REPO_MARKER = "CCF — Claude Context First";

/**
 * Read the single machine-readable paid-budget claim out of prompt-standard.md.
 * Throws (never defaults) when the label is missing, malformed, OR duplicated — the label is
 * required unique by design, and a second stray label must not pass silently. Same "an assert
 * must fail loud" rule this task applies to the codepoint scan: a default on a regex miss is a
 * false PASS.
 * @param {string} root path to a CCF spec tree (real repo root, or a copy of one)
 * @returns {{ value: number, file: string }}
 */
export function extractPaidClaim(root) {
  const file = join(root, ".claude/rules/prompt-standard.md");
  const content = readFileSync(file, "utf8");
  const matches = [...content.matchAll(BUDGET_LABEL_RE_GLOBAL)];
  if (matches.length !== 1) {
    throw new Error(
      `ccf-budget label must appear exactly once in ${file}, found ${matches.length}`,
    );
  }
  return { value: Number(matches[0][1]), file };
}

/**
 * List the `.md` basenames directly under `<root>/.claude/rules`, shared by every function below
 * that scans the rules directory (avoids repeating the same readdirSync+filter three times).
 * @param {string} root
 * @returns {string[]} basenames, e.g. ["architecture.md", "components.md", ...]
 */
function listRuleFiles(root) {
  const rulesDir = join(root, ".claude/rules");
  return readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
}

/**
 * List the `.claude/rules/*.md` basenames that stay OUTSIDE the per-session paid budget: files that
 * carry `paths:` frontmatter AND are not imported at the top level of CLAUDE.md via an `@path` line.
 * Such an import line loads a rule unconditionally and voids its `paths:` (see prompt-standard.md
 * "Why not at-import"), so only the not-imported set is genuinely lazy.
 * @param {string} root
 * @returns {string[]} basenames, e.g. ["prompt-standard.md"]
 */
export function findLazyExcludedFiles(root) {
  const claudeMd = readFileSync(join(root, "CLAUDE.md"), "utf8");
  const imported = new Set(
    [...claudeMd.matchAll(/^@\.claude\/rules\/([\w.-]+\.md)$/gm)].map((m) => m[1]),
  );
  const rulesDir = join(root, ".claude/rules");
  return listRuleFiles(root).filter((f) => {
    if (imported.has(f)) return false;
    const content = readFileSync(join(rulesDir, f), "utf8");
    return /^paths:/m.test(content);
  });
}

/**
 * Measure the actual per-session-paid byte total: CLAUDE.md plus every `.claude/rules/*.md` file,
 * MINUS the lazy-excluded set from `findLazyExcludedFiles`.
 * @param {string} root
 * @returns {{ paid: number, rawTotal: number, lazyFiles: string[] }}
 */
export function measurePaidBytes(root) {
  const claudeMdBytes = Buffer.byteLength(readFileSync(join(root, "CLAUDE.md"), "utf8"), "utf8");
  const rulesDir = join(root, ".claude/rules");
  const files = listRuleFiles(root);
  const lazyFiles = findLazyExcludedFiles(root);
  let rawTotal = claudeMdBytes;
  let paid = claudeMdBytes;
  for (const f of files) {
    const bytes = Buffer.byteLength(readFileSync(join(rulesDir, f), "utf8"), "utf8");
    rawTotal += bytes;
    if (!lazyFiles.includes(f)) paid += bytes;
  }
  return { paid, rawTotal, lazyFiles };
}

/**
 * Extract CLAUDE.md's own two hard thresholds (max lines, max bytes) from its invariant sentence,
 * so raising the cap requires editing that sentence, not a constant hidden in this test file.
 * Throws (no default) when the sentence is not found — the same fail-loud rule as extractPaidClaim.
 * @param {string} root
 * @returns {{ maxLines: number, maxBytes: number }}
 */
export function extractClaudeMdThresholds(root) {
  const content = readFileSync(join(root, "CLAUDE.md"), "utf8");
  const m = content.match(THRESHOLD_RE);
  if (!m) throw new Error("CLAUDE.md invariant sentence (< N lines AND < NKB) not found");
  // Convention: 12KB = 12288 bytes (binary KB), not a decimal 12000.
  return { maxLines: Number(m[1]), maxBytes: Number(m[2]) * 1024 };
}

/**
 * List any `.claude/rules/*.md` file that itself contains a line starting with `@` — a nested
 * at-import. The single-level import scan in `findLazyExcludedFiles` only reads CLAUDE.md's own
 * import lines, so a rule that re-imports another file would silently re-enter the paid set;
 * this guard keeps that assumption honest (today: zero hits).
 * @param {string} root
 * @returns {string[]} basenames with an offending line
 */
export function findNestedImportLines(root) {
  const rulesDir = join(root, ".claude/rules");
  return listRuleFiles(root).filter((f) => /^@/m.test(readFileSync(join(rulesDir, f), "utf8")));
}

/**
 * Confirm `root` really is the CCF repo (not an unrelated project or a mismatched cache copy) by
 * checking CLAUDE.md's own title marker. Best-effort: a missing/unreadable CLAUDE.md reads as false.
 * @param {string} root
 * @returns {boolean}
 */
export function looksLikeCcfRepo(root) {
  const file = join(root, "CLAUDE.md");
  if (!existsSync(file)) return false;
  try {
    return readFileSync(file, "utf8").includes(CCF_REPO_MARKER);
  } catch {
    return false;
  }
}
