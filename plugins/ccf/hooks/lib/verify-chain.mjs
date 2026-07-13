// CCF verify-chain helpers — pure logic for the opt-in auto-verify Stop hook (auto-verify.mjs).
// Decides whether a Stop should DRIVE the main loop through the verify chain (ralph-loop:
// decision:"block" + reason), and builds the reason text + reads the test-discipline flag.
// Kept pure + defensive so it is unit-testable with `node --test` and never throws.
//
// All five drive signals are gathered by the hook (from argv / stdin / reused tested helpers):
//   plan.mjs#findActiveTask, verify-trace.mjs#readTranscriptSignals, review-trace.mjs#hasSpecCheckerReview.
// This module only COMBINES them — it does not read the transcript itself (DRY: reuse the tested readers).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {object} DriveSignals
 * @property {boolean} enabled                 the --auto-verify arg is present (opt-in; default off)
 * @property {boolean} stopHookActive          input.stop_hook_active (loop guard within one drive)
 * @property {boolean} hasInReviewTask         PLAN.md has an in-progress/in-review task (the trigger)
 * @property {boolean} editedCodeThisSession   this session edited a code file (anti-plan-only guard)
 * @property {boolean} checkAlreadyRan         a ccf-spec-checker review already ran (cross-Stop guard)
 */

/**
 * Pure decision: drive the verify chain ONLY when the hook is enabled, this is not a re-entrant Stop,
 * there IS an active task to verify, this session actually changed code, and the verify pass has not
 * already run. Coerces untrusted/missing input to a safe `false` — never throws.
 * @param {DriveSignals} signals
 * @returns {boolean}
 */
export function shouldDriveVerify(signals) {
  /** @type {any} */
  const s = signals && typeof signals === "object" ? signals : {};
  const enabled = Boolean(s.enabled);
  const stopHookActive = Boolean(s.stopHookActive);
  const hasInReviewTask = Boolean(s.hasInReviewTask);
  const editedCodeThisSession = Boolean(s.editedCodeThisSession);
  const checkAlreadyRan = Boolean(s.checkAlreadyRan);
  return enabled && !stopHookActive && hasInReviewTask && editedCodeThisSession && !checkAlreadyRan;
}

/**
 * Read whether the project opted into the test-design discipline, from <rulesDir>/testing.md.
 * The opt-in signal (matching the /ccf-init template) is the "Test design discipline" block together
 * with a `Matrix required: yes` line. Best-effort: missing/unreadable file or any error → false.
 * @param {string} rulesDir path to the project's .claude/rules directory
 * @returns {boolean}
 */
export function readDisciplineOn(rulesDir) {
  if (typeof rulesDir !== "string" || !rulesDir) return false;
  const file = join(rulesDir, "testing.md");
  if (!existsSync(file)) return false;
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return false;
  }
  // Require BOTH the block heading and an explicit "Matrix required: yes" — a stray phrase elsewhere
  // must not flip the flag, and "Matrix required: no" must read as off.
  const hasBlock = /Test design discipline/i.test(content);
  const matrixYes = /Matrix\s+required:\s*yes/i.test(content);
  return hasBlock && matrixYes;
}

/**
 * Build the verify-chain reason fed to the main loop via decision:"block". Names the ORDERED steps:
 *   /ccf:ccf-check → /code-review → (run the project's test suite only if disciplineOn) → /ccf:ccf-updatespec.
 * updatespec runs ONLY when check + review are clean (no ❌); any ❌ → STOP + tell the user, do NOT
 * mark done; if /code-review cannot self-invoke, run the rest + ask the user to run it by hand.
 * Pure: garbage input coerces to disciplineOn=false; always returns a non-empty string.
 * @param {{ disciplineOn: boolean }} opts
 * @returns {string}
 */
export function buildVerifyReason(opts) {
  const disciplineOn = Boolean(opts && opts.disciplineOn);
  const testStep = disciplineOn
    ? "3. Then run the project's test command to confirm the contract-level matrix tests pass (this project opted into the test discipline).\n"
    : "";
  return (
    "<ccf-auto-verify>This task is in-review and you changed code this session. Drive the verify chain IN ORDER " +
    "before stopping — do not stop early:\n" +
    "1. Run /ccf:ccf-check (conformance + conventions review of the implementation).\n" +
    "2. Run /code-review on the current diff.\n" +
    testStep +
    "Only when BOTH /ccf:ccf-check and /code-review come back CLEAN (no ❌ findings) run /ccf:ccf-updatespec to " +
    "refresh the spec and mark the task done. If any step reports a ❌ failing finding, STOP, report it to the user, " +
    "and do NOT mark the task done. If /code-review cannot be invoked automatically, run the remaining steps and " +
    "ask the user to run /code-review by hand.</ccf-auto-verify>"
  );
}
