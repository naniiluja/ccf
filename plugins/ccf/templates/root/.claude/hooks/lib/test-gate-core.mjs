// test-gate-core — pure decision for the BLOCKING Stop test-gate (test-gate.mjs).
// Decides, from this session's signals, whether to BLOCK the stop (`exit 2`) because the session
// touched code but the work was NOT verified: tests FAILED, or no test command ran at all.
// Kept pure + defensive so it is unit-testable with `node --test` and never throws — a missing or
// malformed signal object decays to a safe "do not block".
//
// NOTE: this lib is shipped into a TARGET project by /ccf:init and is intentionally self-contained
// (the hook copies the io/transcript-reading pattern in rather than importing from the plugin).

/** @typedef {{ editedCode?: boolean, ranTests?: boolean, testFailed?: boolean }} GateSignals */

/**
 * Pure decision: BLOCK the stop when the session edited code AND it was not verified —
 * i.e. the tests FAILED, or no test command ran at all. Equivalent to
 * `editedCode && (testFailed || !ranTests)`.
 * Coerces untrusted input (missing/null obj or fields) to a safe `false` — never throws.
 * @param {GateSignals} signals session evidence (edited code / ran tests / tests failed)
 * @returns {boolean} true → block the stop (exit 2); false → allow the stop (exit 0)
 */
export function shouldBlockStop(signals) {
  const editedCode = Boolean(signals && signals.editedCode);
  const ranTests = Boolean(signals && signals.ranTests);
  const testFailed = Boolean(signals && signals.testFailed);
  return editedCode && (testFailed || !ranTests);
}

// Substrings in a test/type-check tool_result that signal a real FAILURE. Best-effort across runners.
// CRITICAL: must NOT match a PASSING summary that merely contains the word "failed" — Jest/vitest
// print "5 passed, 0 failed" / "Tests: 0 failed" on success. So a failure COUNT must be >= 1
// (`[1-9]\d*`), never `\d+` (which matches the literal 0); and the bare "FAIL"/"FAILED" word is
// deliberately NOT a signal (it appears in passing summaries and is too noisy). We key on a counted
// or grammatically-anchored failure phrase instead. Lives here (not inlined in the hook) so the regex
// is covered by `node --test` — it is the highest-risk branch in the gate.
const FAIL_SIGNAL =
  /(?:[1-9]\d*\s+failed|\bfailing tests?\b|\b(?:test|spec|suite)s?\s+failed\b|\bnot ok\b|AssertionError|error TS\d+|✖|✗)/i;

/**
 * Pure: does a tool_result's text indicate a real test/type-check FAILURE (vs a passing summary that
 * merely contains the word "failed")? Coerces non-strings to "" — never throws.
 * @param {string} text the flattened tool_result text
 * @returns {boolean}
 */
export function isFailureText(text) {
  return FAIL_SIGNAL.test(String(text ?? ""));
}
