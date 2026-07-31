// Self-consistency test for the ccf-budget label — REPO scope, node --test (no dependency).
//
// Lives OUTSIDE plugins/ccf/** on purpose: `package.json`'s `files` field ships only `plugins/` to
// someone who installs the plugin, and this suite reads THIS repo's own CLAUDE.md + .claude/rules —
// running it from an installed plugin copy would read another project's spec and fail for no reason.
// Run it with: node --test .claude/tests/*.test.mjs (see .claude/rules/testing.md).
//
// Every destructive/mutation case runs on a COPY (mkdtempSync + cpSync), never the real tree — the
// lesson from hooks/lib/io.test.mjs: a killed process skips try/finally, so a real file must never be
// the one being mutated. Several read-only assertions do read the REAL root (guarded by
// looksLikeCcfRepo + t.skip below); only a MUTATION ever runs on a copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPaidClaim,
  measurePaidBytes,
  findLazyExcludedFiles,
  findNestedImportLines,
  extractClaudeMdThresholds,
  looksLikeCcfRepo,
} from "./context-budget.mjs";

// Resolved via import.meta.url, never process.cwd(): .claude/tests/context-budget.test.mjs sits two
// directories below the repo root regardless of the shell's current directory.
const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(HERE, "..", "..");

/**
 * Copy CLAUDE.md + .claude/rules into a fresh mkdtempSync dir, so a mutation test never touches
 * the real tree (see the header comment's io.test.mjs lesson: a killed process skips try/finally).
 * Caller is responsible for `rmSync(dir, { recursive: true, force: true })` in a finally block.
 * @param {string} root the CCF spec tree to copy from (normally REAL_ROOT)
 * @returns {string} path to the fresh temp-dir copy
 */
function copySpecTree(root) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-budget-"));
  cpSync(join(root, "CLAUDE.md"), join(dir, "CLAUDE.md"));
  cpSync(join(root, ".claude/rules"), join(dir, ".claude/rules"), { recursive: true });
  return dir;
}

test("extractPaidClaim: real root has a well-formed ccf-budget label", (t) => {
  if (!looksLikeCcfRepo(REAL_ROOT)) {
    t.skip("resolved root has no CCF repo marker, skipping the real-tree check");
    return;
  }
  const claim = extractPaidClaim(REAL_ROOT);
  assert.ok(Number.isInteger(claim.value) && claim.value > 0);
});

test("measurePaidBytes: self-consistency against the ccf-budget label on the REAL tree", (t) => {
  if (!looksLikeCcfRepo(REAL_ROOT)) {
    t.skip("resolved root has no CCF repo marker, skipping the real-tree check");
    return;
  }
  const claim = extractPaidClaim(REAL_ROOT);
  const measured = measurePaidBytes(REAL_ROOT);
  assert.equal(
    measured.paid,
    claim.value,
    `paid byte total drifted from the ccf-budget label (raw total=${measured.rawTotal}, ` +
      `lazy files=${measured.lazyFiles.join(", ")}); re-measure and update the label, do not assert the raw total`,
  );
});

test("measurePaidBytes: a mutated label on a COPY reads as a mismatch (red on copy, proves the assertion above bites)", () => {
  const dir = copySpecTree(REAL_ROOT);
  try {
    const file = join(dir, ".claude/rules/prompt-standard.md");
    const mutated = readFileSync(file, "utf8").replace(/paid=\d+/, "paid=1");
    writeFileSync(file, mutated, "utf8");
    const claim = extractPaidClaim(dir);
    const measured = measurePaidBytes(dir);
    assert.equal(claim.value, 1);
    assert.notEqual(measured.paid, claim.value);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("extractPaidClaim: a SECOND stray label on a COPY throws (unique-label guard, red on copy)", () => {
  const dir = copySpecTree(REAL_ROOT);
  try {
    const file = join(dir, ".claude/rules/prompt-standard.md");
    const mutated = readFileSync(file, "utf8") + "\n<!-- ccf-budget: paid=1 -->\n";
    writeFileSync(file, mutated, "utf8");
    assert.throws(() => extractPaidClaim(dir), /exactly once/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findLazyExcludedFiles: the file carrying the ccf-budget label is itself in the lazy list (no fixpoint)", (t) => {
  if (!looksLikeCcfRepo(REAL_ROOT)) {
    t.skip("resolved root has no CCF repo marker, skipping the real-tree check");
    return;
  }
  const claim = extractPaidClaim(REAL_ROOT);
  const lazy = findLazyExcludedFiles(REAL_ROOT);
  // basename(), not split("/").pop(): claim.file is built with node:path's join, which on Windows
  // uses backslashes — split("/") would then return the whole path instead of the basename.
  const labelBasename = basename(claim.file);
  assert.ok(
    lazy.includes(labelBasename),
    `${labelBasename} must stay excluded from paid, or editing its own label would move the number it is checked against`,
  );
});

test("findLazyExcludedFiles: @import-ing prompt-standard.md on a COPY removes it from the lazy list (red on copy)", () => {
  const dir = copySpecTree(REAL_ROOT);
  try {
    const claudeMdPath = join(dir, "CLAUDE.md");
    const mutated = readFileSync(claudeMdPath, "utf8") + "\n@.claude/rules/prompt-standard.md\n";
    writeFileSync(claudeMdPath, mutated, "utf8");
    const lazy = findLazyExcludedFiles(dir);
    assert.ok(!lazy.includes("prompt-standard.md"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findNestedImportLines: no rule file starts a line with @ (nested-import guard)", (t) => {
  if (!looksLikeCcfRepo(REAL_ROOT)) {
    t.skip("resolved root has no CCF repo marker, skipping the real-tree check");
    return;
  }
  assert.deepEqual(findNestedImportLines(REAL_ROOT), []);
});

test("extractClaudeMdThresholds: regex matches the real invariant sentence, and yields 200 lines / 12288 bytes", (t) => {
  if (!looksLikeCcfRepo(REAL_ROOT)) {
    t.skip("resolved root has no CCF repo marker, skipping the real-tree check");
    return;
  }
  const { maxLines, maxBytes } = extractClaudeMdThresholds(REAL_ROOT);
  assert.equal(maxLines, 200);
  assert.equal(maxBytes, 12288); // 12KB = 12288 bytes by convention, not a decimal 12000.
});

test("extractClaudeMdThresholds: a COPY with the sentence removed throws (no silent default)", () => {
  const dir = copySpecTree(REAL_ROOT);
  try {
    const claudeMdPath = join(dir, "CLAUDE.md");
    const mutated = readFileSync(claudeMdPath, "utf8").replace(/<\s*200\s+lines AND[^\n]*/i, "");
    writeFileSync(claudeMdPath, mutated, "utf8");
    assert.throws(() => extractClaudeMdThresholds(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLAUDE.md real tree stays under both hard thresholds it teaches", (t) => {
  if (!looksLikeCcfRepo(REAL_ROOT)) {
    t.skip("resolved root has no CCF repo marker, skipping the real-tree check");
    return;
  }
  const { maxLines, maxBytes } = extractClaudeMdThresholds(REAL_ROOT);
  const content = readFileSync(join(REAL_ROOT, "CLAUDE.md"), "utf8");
  const lines = content.split("\n").length;
  const bytes = Buffer.byteLength(content, "utf8");
  assert.ok(lines < maxLines, `CLAUDE.md has ${lines} lines, must stay under ${maxLines}`);
  assert.ok(bytes < maxBytes, `CLAUDE.md has ${bytes} bytes, must stay under ${maxBytes}`);
});

test("looksLikeCcfRepo: a fake root without the CCF marker reads as not-CCF, exercising the t.skip() path", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ccf-budget-fake-"));
  try {
    writeFileSync(join(dir, "CLAUDE.md"), "# Some other project\n", "utf8");
    if (!looksLikeCcfRepo(dir)) {
      t.skip("fake root has no CCF marker, as expected — self-consistency test does not apply here");
      return;
    }
    assert.fail("a fake root without the CCF marker must not read as the CCF repo");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
