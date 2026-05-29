// CCF verify-trace helpers — pure logic for the verify-work Stop nudge (updatespec-nudge.mjs).
// Decides, from THIS session's transcript (.jsonl), whether the session edited a CODE file but
// ran NO test command — the cue to nudge "verify your work" before stopping. Kept pure + defensive
// so it is unit-testable with `node --test` and never throws — a bad read just means "no nudge".
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape. The reader is
// best-effort only; any parse/shape error returns the safe {editedCode:false, ranTests:false}.
// This signal is SESSION evidence (what happened this turn-cycle), NOT the spec-vs-code staleness
// that `freshness.mjs` measures — a different question, composed independently by the caller.

import { existsSync, readFileSync } from "node:fs";

// File extensions that count as "code" — a Write/Edit on one of these means real code changed.
// Mirrors freshness.mjs CODE_EXT (markdown/docs are deliberately excluded).
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|java|rb|php)$/i;

// Substrings that mark a Bash command as a test/verification run. Kept broad but anchored to real
// runners (incl. the project's own `node --test` and the `tsc` type-check used as verification per
// testing.md) so an unrelated command (ls/git) does not count as "verified".
const TEST_CMD = /(?:\bnpm\s+(?:run\s+)?test\b|\byarn\s+test\b|\bpnpm\s+(?:run\s+)?test\b|node\s+--test\b|\bvitest\b|\bjest\b|\bmocha\b|\bpytest\b|\bgo\s+test\b|\bcargo\s+test\b|\bphpunit\b|\brspec\b|\btsc\b)/i;

// Tool names that edit/create a file. The set keeps a future alias a one-line add.
const WRITE_TOOL_NAMES = new Set(["write", "edit", "multiedit"]);
// Tool names that run a shell command (where a test command would appear). The harness shell tool
// is HARNESS/OS-DEPENDENT — `Bash` on POSIX, `PowerShell`/`pwsh` on Windows — so accept all of them
// (lower-cased), else a Windows session that ran tests via PowerShell looks like "no test ran".
const SHELL_TOOL_NAMES = new Set(["bash", "shell", "powershell", "pwsh"]);

/** @typedef {{ editedCode: boolean, ranTests: boolean }} VerifySignals */

/**
 * Pure decision: nudge to verify ONLY when this session edited code AND ran no test command.
 * Coerces untrusted input (missing/null obj or fields) to a safe `false` — never throws.
 * @param {VerifySignals} signals session evidence from the transcript
 * @returns {boolean}
 */
export function needsVerifyNudge(signals) {
  const editedCode = Boolean(signals && signals.editedCode);
  const ranTests = Boolean(signals && signals.ranTests);
  return editedCode && !ranTests;
}

/**
 * True when a path looks like a source-code file (drives the "edited code" signal).
 * @param {string} path file path from a Write/Edit tool input
 * @returns {boolean}
 */
export function isCodeFile(path) {
  return CODE_EXT.test(String(path ?? ""));
}

/**
 * True when a shell command string looks like a test / verification run.
 * @param {string} command the Bash tool command string
 * @returns {boolean}
 */
export function isTestCommand(command) {
  return TEST_CMD.test(String(command ?? ""));
}

/**
 * True when a Write/Edit/MultiEdit tool input touches at least one code file, across the plausible
 * (undocumented, harness-dependent) shapes: a top-level `file_path`, an `edits[]` array of
 * `{ file_path }`, or a `file_paths[]` array. Pure + defensive — any unexpected shape → false.
 * @param {any} input the tool_use `input` object
 * @returns {boolean}
 */
export function editedAnyCodeFile(input) {
  if (!input || typeof input !== "object") return false;
  if (isCodeFile(input.file_path)) return true;
  if (Array.isArray(input.edits) && input.edits.some((/** @type {any} */ e) => isCodeFile(e?.file_path))) return true;
  if (Array.isArray(input.file_paths) && input.file_paths.some((/** @type {any} */ p) => isCodeFile(p))) return true;
  return false;
}

/**
 * Read SESSION signals from a transcript .jsonl file (best-effort, never throws): scan every
 * assistant `tool_use` block for (1) a Write/Edit on a code file, (2) a Bash test command.
 * On a missing/unreadable/empty path → the safe {editedCode:false, ranTests:false}.
 * @param {string} transcriptPath path to the session .jsonl transcript
 * @returns {VerifySignals}
 */
export function readTranscriptSignals(transcriptPath) {
  const safe = { editedCode: false, ranTests: false };
  if (!transcriptPath || !existsSync(transcriptPath)) return safe;
  let raw;
  try {
    raw = readFileSync(transcriptPath, "utf8");
  } catch {
    return safe;
  }
  let editedCode = false;
  let ranTests = false;
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      continue; // skip a corrupt line, keep scanning
    }
    if (obj?.type !== "assistant") continue;
    const content = obj?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      const name = String(block?.name ?? "").toLowerCase();
      const input = block?.input ?? {};
      if (WRITE_TOOL_NAMES.has(name)) {
        // Write/Edit carry the target as `file_path`. MultiEdit's shape is HARNESS-DEPENDENT and
        // undocumented — it may instead carry an `edits[]` (each with its own `file_path`) or a
        // `file_paths[]`. Check every plausible shape so a MultiEdit on code isn't a missed signal.
        if (editedAnyCodeFile(input)) editedCode = true;
      } else if (SHELL_TOOL_NAMES.has(name)) {
        if (isTestCommand(input?.command)) ranTests = true;
      }
    }
    // Both flags found → nothing more can change the result; stop early.
    if (editedCode && ranTests) break;
  }
  return { editedCode, ranTests };
}
