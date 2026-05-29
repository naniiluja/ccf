#!/usr/bin/env node
// CCF Stop nudge — Stop event, PURELY ADVISORY (never blocks).
// Composes TWO INDEPENDENT advisories into the single non-blocking Stop channel (emitSystemMessage):
//   (A) verify-work: this SESSION edited code but ran no test command (session transcript evidence).
//   (B) updatespec : code changed more recently than the spec (cross-history staleness, freshness.mjs).
// Neither clause gates the other; both off → emit nothing, exit 0.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, emitSystemMessage } from "./lib/io.mjs";
import { specsOlderThanCode } from "./lib/freshness.mjs";
import { needsVerifyNudge, readTranscriptSignals } from "./lib/verify-trace.mjs";

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

// Stop has ONE non-blocking channel — fold both advisories into a single message; silent if none.
if (parts.length > 0) {
  emitSystemMessage(parts.join("\n"));
}

process.exit(0);
