#!/usr/bin/env node
// CCF Stop nudge — Stop event, PURELY ADVISORY (never blocks).
// Composes THREE INDEPENDENT advisories into the single non-blocking Stop channel (emitSystemMessage):
//   (A) verify-work     : this SESSION edited code but ran no test command (session transcript evidence).
//   (B) updatespec      : code changed more recently than the spec (cross-history staleness, freshness.mjs).
//   (C) plan-status-sync: this SESSION ran `git commit` but PLAN.md still has tasks not 'done'.
// No clause gates another; all off → emit nothing, exit 0.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitSystemMessage } from "./lib/io.mjs";
import { specsOlderThanCode } from "./lib/freshness.mjs";
import { needsVerifyNudge, readTranscriptSignals } from "./lib/verify-trace.mjs";
import { findNonDoneTasks } from "./lib/plan.mjs";
import { committedThisSession } from "./lib/git-trace.mjs";

const input = await readStdinJson();

// Avoid loops: if this Stop was triggered by a previous Stop hook, bail out.
if (input.stop_hook_active) {
  process.exit(0);
}

const cwd = String(input.cwd ?? process.cwd());
const rulesDir = join(cwd, ".claude", "rules");

// Only nudge for CCF-managed projects (those with .claude/rules).
if (!existsSync(rulesDir)) {
  process.exit(0);
}

/** @type {string[]} */
const parts = [];

// (A) Verify-work — SESSION evidence (best-effort transcript read, never throws).
// NOTE: clause (A) and clause (C) each scan the transcript independently (readTranscriptSignals vs
// committedThisSession) — a deliberate ~2x read, NOT an oversight. The cost is negligible (<10ms on a
// typical transcript, well inside the 10s hook timeout) and keeping verify-trace (code-edits/test-runs)
// separate from git-trace (commits) is the correct SRP boundary. Fuse only if transcripts get huge.
const transcriptPath = String(input.transcript_path ?? "");
if (needsVerifyNudge(readTranscriptSignals(transcriptPath))) {
  parts.push(
    "<ccf>You edited code this session but no test/verification command ran. " +
      "Verify your work (run the tests / type-check) before considering the task done.</ccf>",
  );
}

// (B) Updatespec — spec-vs-code staleness across history (independent of A).
if (specsOlderThanCode(cwd, rulesDir)) {
  parts.push(
    "<ccf>Code changed this session but the spec wasn't updated. " +
      "Consider running /ccf:ccf-check then /ccf:ccf-updatespec to keep context fresh for future sessions.</ccf>",
  );
}

// (C) Plan-status-sync — committed this session but PLAN.md still has unfinished tasks (independent of A/B).
if (committedThisSession(transcriptPath)) {
  const pending = findNonDoneTasks(join(cwd, ".claude", "plan", "PLAN.md"));
  if (pending.length > 0) {
    const ids = pending.map((t) => t.id).join(", ");
    parts.push(
      `<ccf>You committed code this session but PLAN.md still has ${pending.length} task(s) not 'done' (ids ${ids}). ` +
        "Mark each 'done' only after its /ccf-check + /code-review pass, or fix its status.</ccf>",
    );
  }
}

// Stop has ONE non-blocking channel — fold all advisories into a single message; silent if none.
if (parts.length > 0) {
  emitSystemMessage(parts.join("\n"));
}

process.exit(0);
