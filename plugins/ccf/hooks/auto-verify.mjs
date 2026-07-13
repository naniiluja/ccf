#!/usr/bin/env node
// CCF auto-verify — Stop event, OPT-IN (default no-op), the only CCF Stop hook that can BLOCK.
// Mechanism: the "ralph loop" — when a task is in-review and this session changed code, return
// decision:"block" + a reason that drives the main loop through the verify chain
// (/ccf:check → /code-review → run the project's test suite if discipline → /ccf:updatespec when clean).
// Opt-in: only fires when its hooks.json command carries `--auto-verify` (no arg → exit 0 silently),
// the same toggle pattern as context-guard's `--hard-block`.
// Best-effort: any error → exit 0 (we MUST never break a session). The sibling updatespec-nudge.mjs
// stays purely advisory; this hook is the opt-in blocking driver.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readStdinJson, blockStop } from "./lib/io.mjs";
import { shouldDriveVerify, buildVerifyReason, readDisciplineOn } from "./lib/verify-chain.mjs";
import { findActiveTask } from "./lib/plan.mjs";
import { readTranscriptSignals } from "./lib/verify-trace.mjs";
import { hasSpecCheckerReview, parseJsonl } from "./lib/review-trace.mjs";

try {
  // Opt-in toggle: the hooks.json command must pass `--auto-verify`, else this hook is a no-op.
  const enabled = process.argv.includes("--auto-verify");
  if (!enabled) process.exit(0);

  const input = await readStdinJson();
  const cwd = String(input.cwd ?? process.cwd());
  const rulesDir = join(cwd, ".claude", "rules");
  // Only act in a CCF-managed project (one with .claude/rules).
  if (!existsSync(rulesDir)) process.exit(0);

  const stopHookActive = Boolean(input.stop_hook_active);
  const planFile = join(cwd, ".claude", "plan", "PLAN.md");
  const hasInReviewTask = findActiveTask(planFile) !== null;

  const transcriptPath = String(input.transcript_path ?? "");
  const editedCodeThisSession = readTranscriptSignals(transcriptPath).editedCode;

  // checkAlreadyRan: a ccf-spec-checker review already appears in this transcript (cross-Stop guard).
  let checkAlreadyRan = false;
  if (transcriptPath && existsSync(transcriptPath)) {
    try {
      checkAlreadyRan = hasSpecCheckerReview(parseJsonl(readFileSync(transcriptPath, "utf8")));
    } catch {
      checkAlreadyRan = false; // best-effort: an unreadable transcript means "not yet"
    }
  }

  if (
    shouldDriveVerify({ enabled, stopHookActive, hasInReviewTask, editedCodeThisSession, checkAlreadyRan })
  ) {
    const disciplineOn = readDisciplineOn(rulesDir);
    blockStop(
      buildVerifyReason({ disciplineOn }),
      "CCF auto-verify: blocking stop to run the verify chain (/ccf:check → /code-review → /ccf:updatespec).",
    );
  }
} catch {
  // Never break a session — any unexpected error falls through to a clean exit.
}

process.exit(0);
