// Tests for lib/verify-chain.mjs — node --test, no dependency.
// Covers the three pure helpers that drive the opt-in auto-verify Stop hook:
//   shouldDriveVerify  — full 5-input decision table (each input toggled off blocks the drive).
//   buildVerifyReason  — the ordered verify-chain reason; the run-the-test-suite step is present iff disciplineOn.
//   readDisciplineOn   — reads <rulesDir>/testing.md: discipline on / off / missing file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shouldDriveVerify, buildVerifyReason, readDisciplineOn } from "./verify-chain.mjs";

// All five inputs true → the only combination that drives the verify chain.
const ALL_ON = {
  enabled: true,
  stopHookActive: false,
  hasInReviewTask: true,
  editedCodeThisSession: true,
  checkAlreadyRan: false,
};

test("shouldDriveVerify: all signals favorable → true", () => {
  assert.equal(shouldDriveVerify(ALL_ON), true);
});

test("shouldDriveVerify: not enabled (no --auto-verify) → false", () => {
  assert.equal(shouldDriveVerify({ ...ALL_ON, enabled: false }), false);
});

test("shouldDriveVerify: stop_hook_active → false (loop guard)", () => {
  assert.equal(shouldDriveVerify({ ...ALL_ON, stopHookActive: true }), false);
});

test("shouldDriveVerify: no in-review task → false", () => {
  assert.equal(shouldDriveVerify({ ...ALL_ON, hasInReviewTask: false }), false);
});

test("shouldDriveVerify: edited no code this session → false", () => {
  assert.equal(shouldDriveVerify({ ...ALL_ON, editedCodeThisSession: false }), false);
});

test("shouldDriveVerify: check already ran → false (cross-Stop guard)", () => {
  assert.equal(shouldDriveVerify({ ...ALL_ON, checkAlreadyRan: true }), false);
});

test("shouldDriveVerify: undefined/garbage input → false, never throws", () => {
  assert.equal(shouldDriveVerify(undefined), false);
  assert.equal(shouldDriveVerify(null), false);
  assert.equal(shouldDriveVerify({}), false);
});

test("buildVerifyReason: always names the ordered chain (check → code-review → updatespec)", () => {
  const r = buildVerifyReason({ disciplineOn: false });
  assert.match(r, /\/ccf:check/);
  assert.match(r, /\/code-review/);
  assert.match(r, /\/ccf:updatespec/);
  // updatespec must come AFTER check + review in the ordered chain.
  assert.ok(r.indexOf("/ccf:check") < r.indexOf("/ccf:updatespec"));
  assert.ok(r.indexOf("/code-review") < r.indexOf("/ccf:updatespec"));
});

test("buildVerifyReason: disciplineOn=false → NO test-suite step", () => {
  const r = buildVerifyReason({ disciplineOn: false });
  assert.doesNotMatch(r, /test discipline/i);
});

test("buildVerifyReason: disciplineOn=true → includes the run-the-test-suite step", () => {
  const r = buildVerifyReason({ disciplineOn: true });
  assert.match(r, /test discipline/i);
  // the test-suite step sits between code-review and updatespec.
  const testStepIdx = r.search(/test discipline/i);
  assert.ok(r.indexOf("/code-review") < testStepIdx);
  assert.ok(testStepIdx < r.indexOf("/ccf:updatespec"));
});

test("buildVerifyReason: garbage input → still a non-empty string, no test step", () => {
  const r = buildVerifyReason(undefined);
  assert.equal(typeof r, "string");
  assert.ok(r.length > 0);
  assert.doesNotMatch(r, /test discipline/i);
});

/** Create <rulesDir>/testing.md with the given body (null body → no file). */
function writeTesting(body) {
  const dir = mkdtempSync(join(tmpdir(), "ccf-vchain-"));
  const rulesDir = join(dir, "rules");
  mkdirSync(rulesDir, { recursive: true });
  if (body !== null) writeFileSync(join(rulesDir, "testing.md"), body, "utf8");
  return { dir, rulesDir };
}

test("readDisciplineOn: testing.md with the block + Matrix required: yes → true", () => {
  const { dir, rulesDir } = writeTesting(
    "# Testing\n\n## Test design discipline (when adopted)\n- Matrix required: yes.\n",
  );
  try {
    assert.equal(readDisciplineOn(rulesDir), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readDisciplineOn: testing.md with Matrix required: no → false", () => {
  const { dir, rulesDir } = writeTesting(
    "# Testing\n\n## Test design discipline (when adopted)\n- Matrix required: no.\n",
  );
  try {
    assert.equal(readDisciplineOn(rulesDir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readDisciplineOn: testing.md with no discipline block → false", () => {
  const { dir, rulesDir } = writeTesting("# Testing\n\nNo discipline here.\n");
  try {
    assert.equal(readDisciplineOn(rulesDir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readDisciplineOn: missing testing.md → false, never throws", () => {
  const { dir, rulesDir } = writeTesting(null);
  try {
    assert.equal(readDisciplineOn(rulesDir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readDisciplineOn: garbage rulesDir → false, never throws", () => {
  assert.equal(readDisciplineOn(undefined), false);
  assert.equal(readDisciplineOn(123), false);
});
