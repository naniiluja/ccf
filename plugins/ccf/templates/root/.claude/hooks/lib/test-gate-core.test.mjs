// Tests for lib/test-gate-core.mjs — node --test, no dependency.
// Guards the BLOCKING Stop-gate decision: block the stop when the session edited code AND
// tests either FAILED or were never run. This is the inverse-confidence of verify-trace's
// advisory nudge, but here the decider drives an `exit 2` block in the instantiated hook.

import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldBlockStop, isFailureText } from "./test-gate-core.mjs";

// --- pure decision: shouldBlockStop = editedCode && (testFailed || !ranTests) ---

test("shouldBlockStop: edited code + no tests ran → block", () => {
  assert.equal(shouldBlockStop({ editedCode: true, ranTests: false }), true);
});

test("shouldBlockStop: edited code + tests ran + tests FAILED → block", () => {
  assert.equal(shouldBlockStop({ editedCode: true, ranTests: true, testFailed: true }), true);
});

test("shouldBlockStop: edited code + tests ran + tests PASSED → allow", () => {
  assert.equal(shouldBlockStop({ editedCode: true, ranTests: true, testFailed: false }), false);
});

test("shouldBlockStop: no code edited → allow (regardless of test fields)", () => {
  assert.equal(shouldBlockStop({ editedCode: false, ranTests: false }), false);
  assert.equal(shouldBlockStop({ editedCode: false, ranTests: true, testFailed: true }), false);
  assert.equal(shouldBlockStop({ editedCode: false, ranTests: false, testFailed: true }), false);
});

test("shouldBlockStop: missing/undefined/null fields → allow, never throws", () => {
  // @ts-expect-error testing untrusted input
  assert.equal(shouldBlockStop({}), false);
  // @ts-expect-error testing untrusted input
  assert.equal(shouldBlockStop(null), false);
  // @ts-expect-error testing untrusted input
  assert.equal(shouldBlockStop(undefined), false);
  // edited code but every other field absent → !ranTests is true → block
  // @ts-expect-error testing untrusted input
  assert.equal(shouldBlockStop({ editedCode: true }), true);
});

// --- isFailureText: the highest-risk branch — must flag REAL failures, never a passing summary ---

test("isFailureText: real failures → true", () => {
  assert.equal(isFailureText("Tests: 2 failed, 3 passed"), true);
  assert.equal(isFailureText("1 failed"), true);
  assert.equal(isFailureText("✖ assertion"), true);
  assert.equal(isFailureText("not ok 4 - returns the sum"), true);
  assert.equal(isFailureText("AssertionError [ERR_ASSERTION]"), true);
  assert.equal(isFailureText("src/a.ts(3,1): error TS2304: cannot find name"), true);
  assert.equal(isFailureText("3 failing tests"), true);
  assert.equal(isFailureText("the test suite failed"), true);
});

test("isFailureText: PASSING summaries with the word 'failed' → false (no false block)", () => {
  // The bug this guards: "0 failed" / "5 passed, 0 failed" is a SUCCESS line, must NOT match.
  assert.equal(isFailureText("Tests: 5 passed, 0 failed"), false);
  assert.equal(isFailureText("0 failed"), false);
  assert.equal(isFailureText("Test Suites: 1 passed, 0 failed, 1 total"), false);
  // bare word "FAILED"/"FAIL" alone is intentionally NOT a signal (too noisy)
  assert.equal(isFailureText("the previous deploy FAILED but ignore that"), false);
  assert.equal(isFailureText("FAIL-SAFE mode enabled"), false);
});

test("isFailureText: non-string / empty → false, never throws", () => {
  assert.equal(isFailureText(""), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isFailureText(null), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isFailureText(undefined), false);
  // @ts-expect-error testing untrusted input
  assert.equal(isFailureText(42), false);
});
