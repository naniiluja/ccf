// CCF git-trace helper — pure logic for the plan-status-sync Stop nudge (updatespec-nudge.mjs clause C).
// Decides, from THIS session's transcript (.jsonl), whether the session ran `git commit`. Kept pure +
// defensive so it is unit-testable with `node --test` and never throws — a bad read just means "no commit".
//
// NOTE: the transcript .jsonl format is an UNDOCUMENTED internal Claude Code shape. The reader is
// best-effort only; any parse/shape error returns the safe `false`. The scan is ROLE-GATED (assistant
// `tool_use` only) so a user's typed prose ("i will git commit later") is NOT mistaken for an actual
// commit — mirrors the verify-trace.mjs pattern.

import { existsSync, readFileSync } from "node:fs";

// Tool names that run a shell command (where `git commit` would appear). The harness shell tool is
// HARNESS/OS-DEPENDENT — `Bash` on POSIX, `PowerShell`/`pwsh` on Windows — so accept all of them
// (lower-cased). COPIED locally on purpose (the verify-trace set is module-private; do NOT import).
const SHELL_TOOL_NAMES = new Set(["bash", "shell", "powershell", "pwsh"]);

// A `git commit` invocation (incl. `git commit -m …`, `git commit --amend`). `\b` anchors so
// `git committed-thing` or a substring inside another word does not match.
const GIT_COMMIT_CMD = /\bgit\s+commit\b/;

/**
 * True when a shell command string runs `git commit` (any form: -m, --amend, …).
 * @param {string} command the shell tool command string
 * @returns {boolean}
 */
export function isGitCommitCommand(command) {
  return GIT_COMMIT_CMD.test(String(command ?? ""));
}

/**
 * Scan a transcript .jsonl (best-effort, never throws) for an assistant shell `tool_use` that ran
 * `git commit`. Role-gated: only `assistant` lines are scanned, so user prose containing the words
 * "git commit" does not count. Missing/empty/unreadable/corrupt transcript → `false`.
 * @param {string} transcriptPath path to the session .jsonl transcript
 * @returns {boolean}
 */
export function committedThisSession(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return false;
  let raw;
  try {
    raw = readFileSync(transcriptPath, "utf8");
  } catch {
    return false;
  }
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      continue; // skip a corrupt line, keep scanning
    }
    if (obj?.type !== "assistant") continue; // role-gate: never scan user prose
    const content = obj?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      const name = String(block?.name ?? "").toLowerCase();
      if (!SHELL_TOOL_NAMES.has(name)) continue;
      if (isGitCommitCommand(block?.input?.command)) return true;
    }
  }
  return false;
}
